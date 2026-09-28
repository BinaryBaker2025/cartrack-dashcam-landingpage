# BestCarDash lead ingestion and operations

## Existing application and changes

The repository is branded CarTrack Cameras and uses Next.js 16.3.5 App Router, TypeScript,
React, OpenNext 1.20.6, Wrangler 4.131.2, and Cloudflare Workers (not Pages).
The existing Worker is `cartrack-dashcam-landingpage`. Its D1 database is
`cartrack_dashcam_landing`, bound as `DB`. Keep the existing account and database IDs.

Previously `app/api/leads/route.ts` validated website submissions, claimed a token in
`submissions`, called `lib/leadbyte.ts:submitLead()` synchronously, and saved the result.
Migration 0002 added full lead reporting and migration 0003 added email. No queue existed.
The existing untracked `database-template/` is unrelated and has not been changed.

The new flow is:

```text
Website /api/leads ───────────────────────┐
                                        v
Google /api/webhooks/google-ads → mapper → LeadService → D1 submissions + outbox
                                                           |
                                            Cloudflare Queue (lead ID only)
                                                           |
                                            existing Worker queue handler
                                                           |
                                             existing submitLead() service
                                                           |
                                                    LeadByte API
                                                           |
                                               D1 result + attempt audit
```

Qualification uses the existing `validateLead()` rules. The fixed affiliate campaign
`DASHCAMS`, supplier `27144`, offer `3046`, endpoint allowlist and form-encoded fields
remain intact. Email remains local because the existing API contract does not forward it.
`campaign_id` remains the affiliate campaign; `source_campaign_id` holds the ad campaign.
`created_at` is receipt time; `submitted_at` is the provider's time when available.

Website origin checks, rate limiting, honeypot, body limit and validation remain.
Its success response now means **durable receipt for processing**, not affiliate acceptance.
The existing thank-you experience still works. Old stored receipts still replay; historical
pending/uncertain submissions are not automatically queued. `lib/submissions.ts` remains
for legacy storage compatibility and tests; new requests use `lib/leadService.ts`.

Microsoft intermediary delivery is implemented at `/api/webhooks/microsoft`; see
[MICROSOFT-LEADS.md](MICROSOFT-LEADS.md) for its Bearer token and normalized JSON contract.
It maps into `LeadRequest` and calls `ingestLead()`. [Bing website campaigns](BING-ADS.md)
also capture Microsoft click/campaign IDs through the website route. Native Microsoft and
Meta webhook adapters remain unimplemented pending their actual integration requirements.

## Resources, secrets and deployment

Create only these new queues; reuse the existing Worker and D1:

```sh
npx wrangler login
npx wrangler whoami
npx wrangler queues create bestcardash-leads
npx wrangler queues create bestcardash-leads-dlq
npx wrangler queues update bestcardash-leads --message-retention-period-secs 1209600
npx wrangler queues update bestcardash-leads-dlq --message-retention-period-secs 1209600
npx wrangler secret put GOOGLE_ADS_WEBHOOK_KEY
```

Supply a cryptographically random secret of at least 32 characters at the prompt. Store it
in your password manager and use the same value in Google Ads. Never commit it. Keep the
existing `LEAD_HASH_SECRET` unchanged. Only if it is missing on a new installation:

```sh
npx wrangler secret put LEAD_HASH_SECRET
```

No `AFFILIATE_API_KEY` has been invented: the existing LeadByte integration uses its fixed
campaign/supplier query parameters, not an API-key header. Existing settings are reused:
`LEADBYTE_ENABLED`, `LEADBYTE_ENDPOINT`, `LEADBYTE_CAMPID`, `LEADBYTE_SID`,
`LEADBYTE_OFFER_ID`, `LEADBYTE_TIMEOUT_MS`, `NEXT_PUBLIC_SITE_URL`, `DEPLOY_PLATFORM`,
`DEPLOY_ENV`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_SECONDS`, and operator/privacy settings.
The existing production `LEADBYTE_ENABLED=true` setting is preserved.

New configuration:

| Setting                    | Where                                       | Purpose                                               |
| -------------------------- | ------------------------------------------- | ----------------------------------------------------- |
| `GOOGLE_ADS_WEBHOOK_KEY`   | Worker secret / ignored `.dev.vars`         | Body `google_key` authentication                      |
| `GOOGLE_ADS_FORM_MAPPINGS` | `wrangler.jsonc` vars / ignored `.dev.vars` | JSON object keyed by Google form ID; defaults to `{}` |
| `LEAD_QUEUE`               | Wrangler queue binding                      | Producer for `bestcardash-leads`                      |
| `DB`                       | Existing D1 binding                         | Shared persistence                                    |

Apply migrations and deploy from the repository root:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run test:worker
npx wrangler d1 migrations apply DB --local --config wrangler.jsonc
npm run build:cloudflare
npx wrangler deploy --dry-run
npx wrangler d1 migrations apply DB --remote --config wrangler.jsonc
npx wrangler deploy --config wrangler.jsonc
```

For subsequent releases, `npm run deploy` builds, applies remote migrations, and deploys.
Migration `0004_lead_pipeline.sql` is additive: it extends `submissions` and creates
`webhook_events`, `lead_outbox`, `lead_attempts`, and `lead_dead_letters`. It adds database
uniqueness on `(source, external_lead_id)` and indexes for status/time and audit lookup.
It does not delete records, replace tables, or queue historical records.

For a backup before migration, run `npx wrangler d1 export DB --remote --output=artifacts/pre-pipeline-backup.sql`
after creating the ignored `artifacts` directory. Keep backups private.

### Cloudflare Dashboard

Under **Workers & Pages → cartrack-dashcam-landingpage**:

1. Confirm the custom domain `bestcardash.com` under **Settings → Domains & Routes**.
   Wrangler now declares this custom domain. The `bestcardash.com` zone must be active in the configured Cloudflare account; deployment attaches the domain and provisions its DNS/certificate. No separate DNS record is needed for the webhook path. This guide uses the domain configured
   in the repository; it does not claim a live domain verification.
2. Under **Settings → Variables and Secrets**, confirm the webhook secret and existing hash secret.
   Wrangler manages the non-secret variables and bindings; dashboard-only variable changes may be overwritten.
3. Confirm D1 `DB`, producer `LEAD_QUEUE`, both queue consumers, and cron triggers after deployment.
   Wrangler configures these automatically. The cron runs outbox recovery every five minutes;
   daily rate-limit cleanup remains at 02:17 UTC.
4. Under **Observability**, inspect Worker logs. Under **Queues**, inspect backlog, retries and failures.
   Set operational alerts for sustained backlog, failed executions and D1 errors.
5. If using Workers Builds, set **Build command** to `npm run build:cloudflare` and
   **Deploy command** to `npm run db:migrate:remote && npx wrangler deploy`.
   The older deploy-only command skips migrations. Use Node 24 for hosted builds.
6. Do not put an interactive Cloudflare Access login or browser challenge on the Google webhook.
   If existing WAF rules challenge Google, make a narrowly scoped exception for this POST path.
   The handler requires HTTPS outside explicit localhost development.

No dashboard configuration is otherwise required beyond the existing domain and access permissions.
Queues must be available in the account. This implementation has not provisioned or deployed remote resources.

## Connect Google Ads

For an ordinary ad sending people to the website, set its destination to:

`https://bestcardash.com/`

For a Google Ads **lead form asset**, after deploying this code:

1. Create the form, privacy-policy link, contact fields, eligibility questions and explicit contact consent.
2. Open the form's lead export/integration settings (**Export leads from Google Ads → Other data integration options**, where available).
3. Set the **Webhook URL** to:

   **`https://bestcardash.com/api/webhooks/google-ads`**

4. Set the **Key** to the exact secret stored as `GOOGLE_ADS_WEBHOOK_KEY`.
5. Use Google's test-data action. Expect HTTP 200, a D1 audit record and `test` status.
   `is_test=true` never reaches LeadByte, even with complete qualification.
6. Inspect raw `user_column_data` privately in D1 to discover the actual field IDs and answer values.
7. Complete the mapping below, deploy it, and validate a controlled real-form submission only with
   campaign-approved test details. Do not send invented personal details to the live affiliate API.

Authentication uses Google's JSON body `google_key`, not a made-up bearer header.
The endpoint returns 400 for malformed bodies, 403 for bad credentials and 503 if it cannot
persist safely. Valid duplicates return 200. Unknown optional fields do not break parsing.
64-bit numeric IDs are read using JSON source context and stored as strings without rounding.

### Finish the mapping when your form exists

Copy `config/google-ads-mappings.example.json` to a working configuration file. Replace:

- `REPLACE_WITH_ACTUAL_GOOGLE_FORM_ID` with the actual form ID.
- Each `columnId` with the exact ID from Google's `user_column_data`.
- Each `REPLACE_WITH_*` answer key with the exact transmitted answer text.
- `consentText` and `consentVersion` with the published notice and its version.

The replacement markers are intentional configuration points, not production defaults.
The example is not loaded automatically. Set `GOOGLE_ADS_FORM_MAPPINGS` in `wrangler.jsonc`
to the JSON-encoded contents of your completed mapping file. JSON minification/escaping example:

```sh
node -e "const fs=require('node:fs'); console.log(JSON.stringify(JSON.stringify(JSON.parse(fs.readFileSync('config/google-ads-mappings.example.json','utf8')))))"
```

Use the resulting quoted string as the variable value, with your completed file substituted.
For local development, put the compact JSON on the `GOOGLE_ADS_FORM_MAPPINGS=` line in `.dev.vars`.
Do not put the webhook secret in the mapping. Map each form explicitly; there is no wildcard.

Standard contact IDs default to `FIRST_NAME`, `LAST_NAME`, `EMAIL`, `PHONE_NUMBER`.
`FULL_NAME` fallback keeps everything after the first name as the surname; single names remain
incomplete. Custom contact column IDs can be configured in `fields`.

Accepted internal qualification values are the existing campaign values:
`age=18_plus`, `vehicle=yes`, `employment=employed|self_employed`, and
`income=10000_plus|10000_19999|20000_39999|40000_plus`.
Map known negative answers too, using the example's non-qualifying values.
Answer lookup trims outer whitespace but otherwise requires an exact, case-sensitive match.
Missing, unknown and unmapped answers do not mean yes.

`contactConsent` is required to deliver this requested offer. `marketingConsent` is separate
and is not inferred from contact consent. Unknown values remain NULL; explicit false remains false.
Missing notice text/version also blocks automatic ad-lead delivery. Consent time uses the provider's
submission timestamp if present; receipt time is not fabricated as a consent timestamp.
No source-provided timestamp means `submitted_at`/`consent_timestamp` remain NULL.
The existing affiliate opt-in date falls back to receipt time when Google supplies no submission time;
the stored audit makes that distinction visible.

If Google's available form fields cannot capture the required evidence, use a website-destination
ad or keep those leads in review. Do not configure a generic answer as consent just to bypass the gate.
Changing a mapping affects new lead IDs only: duplicate delivery does not overwrite saved evidence
or release held leads. Existing review records require an explicit operator review/reprocessing change;
no public admin/release endpoint is added in this implementation.

## Meta and Microsoft

Meta or Microsoft ads linking to the website can use the website URL immediately.
For the implemented Microsoft click attribution and reporting, follow [BING-ADS.md](BING-ADS.md).
Their native lead forms do not use Google's webhook endpoint. Meta Instant Forms need a separate
verified Meta webhook subscription, Page/app permissions and an access token to retrieve lead details.
Those Meta credentials and handlers have not been configured here. Microsoft intermediary delivery
uses [our normalized contract](MICROSOFT-LEADS.md), not Google's schema or an assumed native
Microsoft contract. The intermediary must provide a supported upstream lead source.

## Local development and safe tests

```sh
npm ci
npm run setup:local
npm run dev
```

Setup generates ignored local secrets, preserves unrelated values, disables live delivery and applies
local D1 migrations. `next dev` supports Next routes/local bindings but does **not** run the exported
Worker queue/scheduled handlers. For full Worker behavior:

```sh
npm run build:cloudflare
npx wrangler dev --local --port 8787 --test-scheduled
```

Keep `.dev.vars` `LEADBYTE_ENABLED=false`. In this production-mode preview set
`NEXT_PUBLIC_SITE_URL=https://bestcardash.com`, `DEPLOY_ENV=development`,
and use that origin header for website POST tests. The development environment permits the
localhost Google webhook over HTTP. Never use `wrangler dev --remote` for synthetic tests.

Example fake Google test request (Bash; on Windows use `curl.exe` with the equivalent JSON file):

```sh
curl -i http://localhost:8787/api/webhooks/google-ads \
  -H 'Content-Type: application/json' \
  --data-binary @google-test.json
```

Create `google-test.json` **outside the repository**, substituting your local key:

```json
{
  "lead_id": "synthetic-google-test-001",
  "google_key": "YOUR_LOCAL_KEY_FROM_DEV_VARS",
  "is_test": true,
  "form_id": "100",
  "campaign_id": "200",
  "lead_submit_time": "2026-09-20T10:00:00Z",
  "user_column_data": [
    { "column_id": "FIRST_NAME", "string_value": "Test" },
    { "column_id": "LAST_NAME", "string_value": "Testing" },
    { "column_id": "EMAIL", "string_value": "test@example.com" },
    { "column_id": "PHONE_NUMBER", "string_value": "0821234567" }
  ]
}
```

Expected: HTTP 200, one `test` submission, credential-redacted audit, no affiliate call.
Repeat it: still one lead, another `DUPLICATE` event. Wrong key: 403. Body `{`: 400.
For a review-path test, omit `is_test` while keeping mappings `{}` and live delivery disabled.

Inspect local records without printing contact details:

```sh
npx wrangler d1 execute DB --local --command "SELECT source,processing_status,COUNT(*) AS leads FROM submissions GROUP BY source,processing_status"
npx wrangler d1 execute DB --local --command "SELECT id,processing_status,error_message,lead_id FROM webhook_events ORDER BY received_at DESC LIMIT 20"
npx wrangler d1 execute DB --local --command "SELECT lead_id,published_at,publish_attempts FROM lead_outbox"
curl 'http://localhost:8787/__scheduled?cron=*/5%20*%20*%20*%20*'
```

For the complete queue-to-affiliate path **without contacting LeadByte**:

```sh
npm test
npm run test:worker
```

Vitest runs real SQLite migrations and production queries, tests the website route, and mocks only
network/queue boundaries. The runtime test uses real workerd, in-memory D1 and Queues, the production
Worker queue wrapper, and the existing affiliate service with intercepted outbound HTTP. Its Next
fetch dispatcher is replaced by the Google handler; full Next/OpenNext routing is checked by the build/preview.
It does not read local secrets, use the production database or allow external traffic.

## Duplicates, retries and failure recovery

- Database uniqueness on `(source, external_lead_id)` and the stable internal submission key
  prevent duplicate leads. Website tokens retain their original HMAC key for compatibility.
- Each authenticated Google delivery receives its own audit row; duplicate receipts are marked
  `DUPLICATE` and never replace the original lead. Authentication failures do not retain the body.
- Lead and outbox writes share a D1 transaction. HTTP 200 is safe after that commit even if immediate
  queue publishing fails: cron retries unpublished jobs every five minutes, up to 100 per run.
- A crash after publishing but before marking the outbox may produce a duplicate queue message.
  The consumer atomically claims the lead. Concurrent consumers cannot both send it.
- Already accepted/duplicate/rejected/test/review/uncertain/dead-letter records are acknowledged safely.
- HTTP 429 and 5xx, network errors/timeouts, and LeadByte codes -3/-100 are retried.
  Delay grows from 60 to 120, 240, 480, 960 and at most 3,600 seconds. Main queue allows five
  retries; D1 also caps affiliate calls at six total, including duplicate queue messages.
- Other HTTP 4xx and explicit validation/business rejections are saved and acknowledged.
  Malformed/oversized responses and unexpected interrupted sends become `uncertain` for reconciliation.
- Claims have a two-minute lease. An expired in-flight claim is marked uncertain, not taken over
  for another send. This prevents blindly repeating a call after a Worker crash or lost D1 result write.
- **Downstream exactly-once delivery is not guaranteed.** LeadByte's current contract has no
  idempotency-key field. A timeout/network retry can repeat an already accepted request. The existing
  LeadByte 90-day duplicate rule helps, but is not a transactional guarantee. A documented vendor
  idempotency contract is required to remove this ambiguity; no unsupported field is sent.

Cloudflare moves exhausted messages to `bestcardash-leads-dlq`. Its consumer archives the message ID,
lead ID and safe failure reason in `lead_dead_letters`, marks applicable leads/events failed, then
acknowledges. Consequently the queue itself may be empty while D1 retains the investigation record.
If archival fails, the DLQ consumer retries (100 retries configured). Queue retention is finite;
monitor D1/consumer outages rather than treating either queue as permanent storage.

Paused delivery: newly received eligible leads are saved as `not_sent_disabled` and are not
automatically released when the flag changes. Already queued messages retry while disabled and
can reach the DLQ; pause the consumer in Cloudflare for a longer maintenance window.

## View failures and investigate

```sh
npm run report:pipeline
npx wrangler tail cartrack-dashcam-landingpage --format json
npx wrangler d1 execute DB --remote --command "SELECT message_id,lead_id,received_at,reason FROM lead_dead_letters ORDER BY received_at DESC LIMIT 50"
npx wrangler d1 execute DB --remote --command "SELECT processing_status,COUNT(*) AS leads FROM submissions GROUP BY processing_status"
```

For a specific internal ID, use parameter-appropriate private D1 console queries on `submissions`,
`webhook_events` (`lead_id`), and `lead_attempts` (`lead_id`). `npm run report` exports now include source,
qualification/consent and pipeline status fields. Existing reporting views still work.

Console events include `WEBHOOK_RECEIVED`, `WEBHOOK_REJECTED`, `LEAD_CREATED`, `LEAD_DUPLICATE`,
`LEAD_QUEUED`, `LEAD_QUEUE_DEFERRED`, and `AFFILIATE_SUBMISSION_*`. Correlation uses generated IDs;
no names, phone numbers, emails, credentials or raw payloads are logged. Private D1 audit/response
records contain personal data. Access and retention remain operator-managed, matching existing lead
reporting behavior. The Google payload retains unknown fields but redacts secret-like keys and the
configured key value; request headers are not stored.

Do not blindly requeue `uncertain` or `dead_letter` leads. Check the attempt history and reconcile
with LeadByte first. Do not clear keys, delete rows, rotate the hash secret or invent new provider
IDs as a retry mechanism. This release has no automatic operator replay or review-approval UI.

## Implementation inventory

Verification completed locally: 170 Vitest tests passed, ESLint passed, the Next.js/OpenNext
Cloudflare production build (including TypeScript checks) passed, migration 0004 applied to local
D1, and the isolated workerd/D1/Queue runtime test passed. Wrangler deployment dry-run accepted
the bindings/configuration. Existing Windows/OpenNext and Node experimental-module warnings
remain. Production migration/deployment and live Google/affiliate verification were not run.

Created: `migrations/0004_lead_pipeline.sql`, `lib/leadModel.ts`, `lib/leadBindings.ts`,
`lib/leadService.ts`, `lib/googleLeadMapper.ts`, `lib/googleWebhook.ts`, `lib/leadConsumer.ts`,
`app/api/webhooks/google-ads/route.ts`, `config/google-ads-mappings.example.json`,
`reports/pipeline-issues.sql`, `tests/leadPipeline.test.ts`, `scripts/test-lead-worker.mjs`, this guide.

Modified: `app/api/leads/route.ts`, `app/terms/page.tsx`, `lib/database.ts`, `lib/leadbyte.ts`,
`lib/logger.ts`, `worker.mjs`, `wrangler.jsonc`, `package.json`, `.env.example`, `.dev.vars.example`,
`scripts/setup-local.mjs`, `scripts/query-report.mjs`, `scripts/export-report.mjs`,
`tests/d1Fixture.ts`, `tests/route.test.ts`, `tests/leadRecording.test.ts`, `README.md`,
`CLOUDFLARE.md`, `LEAD-REPORTING.md`.

Manual work remaining: create the queues, set the secret, deploy/migrate production, create the Google
form, fill its real mapping/evidence configuration, and run campaign-approved live verification.
No production deployment, ad-account connection, live lead submission, or Meta/Microsoft hosted-form
integration has been performed. Microsoft website attribution and intermediary ingestion are
implemented as documented in [BING-ADS.md](BING-ADS.md) and [MICROSOFT-LEADS.md](MICROSOFT-LEADS.md).

References checked against the installed runtime/schema:
[Google webhook contract](https://developers.google.com/google-ads/webhook/docs/implementation),
[Google samples](https://developers.google.com/google-ads/webhook/docs/samples),
[Cloudflare queue configuration](https://developers.cloudflare.com/queues/configuration/configure-queues/),
[Cloudflare DLQs](https://developers.cloudflare.com/queues/configuration/dead-letter-queues/).
