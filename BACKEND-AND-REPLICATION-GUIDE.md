# Backend and affiliate project replication guide

Reviewed 20 October 2026. Scope: repository implementation, authenticated Cloudflare resource metadata, database schema and aggregate counts, public GET requests, and automated tests. No production lead was submitted, no contact records were exported, and no infrastructure or production configuration was changed.

## 1. What the system is

This is a lead acquisition and delivery system. Next.js serves the website and HTTP API. Cloudflare Workers hosts the application, Cloudflare D1 retains lead and operational records, and Cloudflare Queues runs asynchronous delivery to LeadByte. The same Worker handles HTTP requests, queue messages, and scheduled recovery tasks.

It currently implements one affiliate campaign. It is not yet a configurable multi-company platform, CRM, commission ledger, or sales attribution platform.

The major paths are:

```text
Website form -> POST /api/leads ---------------------------+
Google form -> POST /api/webhooks/google-ads --------------+
Microsoft intermediary -> POST /api/webhooks/microsoft ----+-> Shared ingestion
Meta/TikTok -> authenticated webhook -> D1 inbox -> mapper -+
                                                               |
                                                  D1 lead + delivery outbox
                                                               |
                                                     Cloudflare lead queue
                                                               |
                                                  Worker queue consumer
                                                               |
                                                   LeadByte submission API
                                                               |
                                                 D1 result + attempt history

Scheduled Worker -> unpublished-outbox recovery + social inbox recovery
Daily scheduled Worker -> expired rate-limit cleanup
Operator -> authenticated Wrangler/D1 reports -> LeadByte export reconciliation
```

## 2. Verified live state

- `https://bestcardash.com/` returned HTTP 200.
- `GET /api/leads` returned HTTP 200, `ready: true`, diagnostic `READY`. This is an application readiness check, not a vendor delivery test.
- The active version inspected was `c0aacf9d-c75f-4886-a51c-d350450a19fa`, created 28 September 2026. It exposes fetch, queue and scheduled handlers.
- Its bindings include D1 `DB`, queue `LEAD_QUEUE`, assets, and the Worker self-reference.
- Live settings enable LeadByte delivery and search indexing. Google form mappings are `{}`.
- Remote D1 reports no pending migrations; its schema contains the newer pipeline and social inbox objects.
- Aggregate inspection found 32 submissions, all source `WEBSITE` with processing status `legacy`. It found no social inbox records, no unpublished outbox rows and no recorded dead letters. These counts do not establish sales, accepted leads, or successful operation of the newer queue pipeline.
- Both configured queues exist with consumers: `bestcardash-leads` and `bestcardash-leads-dlq`.
- Listed Worker secret names are `LEAD_HASH_SECRET`, `GOOGLE_ADS_WEBHOOK_KEY`, `MICROSOFT_ADS_WEBHOOK_TOKEN`, and `META_VERIFY_TOKEN`. Secret values were not retrieved.
- Meta app secret/Page retrieval token and TikTok app secret are not listed; required social account/version/mapping variables are absent from the inspected version. Native social delivery is not configured in this deployment.
- The `www` URL failed to fetch from this environment. The source accepts a www origin, but that alone does not configure DNS, TLS or a Worker route for it.
- All 246 automated tests across 14 files passed. These tests do not substitute for authorized platform and affiliate integration tests.

I did not inspect Cloudflare billing, registrar ownership, Git build dashboard settings, external advertising dashboards, real vendor acceptance, or a backup restoration. Repository code is described below separately from what was observed live.

## 3. Hosting and deployment

`wrangler.jsonc` identifies the account, Worker, domain route, asset directory, database binding, producer/consumer queues, schedules and runtime variables. The Worker is `cartrack-dashcam-landingpage`, in the configured ShyInc account. Cloudflare CLI access is available to that account and another account; new projects must select their intended account explicitly.

`next.config.ts` configures Next.js and development integration. `open-next.config.ts` configures the OpenNext adapter. OpenNext builds Next.js into the `.open-next` output that Cloudflare can run.

`worker.mjs` wraps the generated Worker:

- `fetch` forwards requests to the generated Next.js handler.
- `queue` calls `consumeLeads()`.
- `scheduled` calls outbox recovery and social inbox processing; the daily invocation also cleans rate limits.

This is a Workers deployment, not a Cloudflare Pages deployment. The inspected application does not need a conventional VPS, standalone Node server, Postgres connection string, or separate database password: D1 access is injected through the server-side binding. No application R2 bucket is configured. Historical Netlify documentation is not the current backend architecture.

`npm run deploy` validates configuration, builds with OpenNext, applies remote database migrations, deploys, and calls IndexNow. It is a production mutation command and was not run for this review. Build success is not the same as queue delivery success. Because indexing notification comes after deployment, a final indexing error can occur after the code has already been deployed.

Build settings and runtime settings both matter. `scripts/build-cloudflare.mjs` supplies Wrangler variables to the build. Public site metadata can be generated at build time; changing a runtime variable alone may not update generated pages. Secrets must never be placed in `NEXT_PUBLIC_*` values.

## 4. Website submission, step by step

The form sends JSON to `POST /api/leads`, including a submission identifier, contact information, eligibility/consent and attribution. Browser validation improves usability; the server repeats the checks.

The route first obtains valid campaign configuration. It rejects requests with missing/unapproved origins, cross-site fetch metadata or an unsuitable content type. It then applies the shared IP rate limit, reads a body bounded to 16 KB, rejects malformed JSON/non-object payloads, and checks the honeypot field named `website`.

The origin check limits browser cross-site submissions. It is not authentication against a determined non-browser client, which can supply its own headers.

Server qualification currently requires:

- Valid first and last names.
- A valid South African mobile number; accepted numbers are normalized to international format.
- A valid email if one is supplied. The backend allows omission even though the current form collects it.
- Age 18+, access to a vehicle, employed/self-employed, monthly income R10,000+.
- Explicit contact consent.
- If supplied, a future preferred call time within 30 days, interpreted in South African time.

The compact form can submit one eligibility confirmation covering all four facts. Validation then supplies canonical qualifying values for those facts. These are derived from a combined affirmation, not independently collected answers; retain that distinction in reports and future campaign design.

An invalid website lead is rejected before a contact lead is stored. Valid inputs also need the expected submission-ID shape. The route creates a normalized `LeadRequest` with source `WEBSITE`, a consent version and timestamps, qualification values and sanitized attribution. It then calls shared ingestion.

Common responses include 403 for origin mismatch, 415 for content type, 422 for validation, 429 for rate limit, 409 for a conflicting submission token, and 503 for unavailable configuration/storage or disabled delivery.

HTTP 200 means the request was durably received. The visitor does not wait for LeadByte and is not promised vendor acceptance, a sale, or a commission.

## 5. Shared ingestion and duplicate protection

`lib/leadModel.ts` defines the common lead shape used across sources. `assessLead()` applies the campaign rules. Provider parsers translate external fields; they do not independently decide eligibility.

`lib/leadService.ts` computes the lead key. Website submissions use an HMAC of the browser submission identifier with `LEAD_HASH_SECRET`. External sources use a SHA-256 hash of provider plus external lead ID. A unique `(source, external_lead_id)` index provides another database duplicate guard.

This protects against replay of the same token/provider lead. It does not globally deduplicate every new form submission by phone. A person submitting with a fresh browser token can create another row. LeadByte has its own campaign duplicate policy, described in project documentation as 90 days; confirm each new company's actual policy.

Website payloads also get a fingerprint. Reusing the same token with different normalized contact/qualification inputs raises a conflict. Attribution and every consent metadata field are not all part of that fingerprint. External duplicate IDs retain the existing record rather than updating it.

Ingestion stores the lead and, when eligible for delivery, an outbox entry using a D1 batch. The outbox is a durable record that delivery still needs to be published to the queue.

If queue publication fails after storage succeeds, the lead is preserved and scheduled recovery tries again. There is also a possible publish-before-marker failure window, so queue consumers must tolerate repeated messages. This is not an exactly-once external delivery guarantee.

Qualified leads received while `LEADBYTE_ENABLED` is false become `not_sent_disabled`. They are not automatically sent when the toggle is later enabled. A website request can therefore be stored but return 503 to its visitor. Social test leads become `test`; incomplete external leads can become `pending_review`; explicit disqualification/consent refusal can become `rejected`.

The distinction matters: external authenticated payloads and incomplete lead details may be retained even when they are not deliverable. Website rejection-before-storage does not describe every webhook path.

## 6. The database

D1 is the authoritative operational store in this application. Contact data is stored in normal database columns, not only as hashes. HMAC identifiers do not anonymize the retained lead record. Application-level field encryption is not implemented in these source files.

### Core tables

**`submissions`:** one stored submission, with names, normalized/original phone, email, source and external ID, campaign/supplier/offer IDs, qualification and attribution JSON, contact consent, optional marketing consent, consent metadata, timestamps, delivery status, processing status, retry/lease fields, and LeadByte response details.

**`rate_limits`:** atomic counters keyed by hashed client IP and time window.

**`lead_outbox`:** delivery intents, publication timestamps and publish-attempt counters. It bridges database ingestion and queue publication.

**`lead_attempts`:** separate records for attempts to call the affiliate, including start/completion and outcome/result JSON.

**`lead_dead_letters`:** queue messages that reached the failure path, recorded for operator investigation.

**`webhook_events`:** authenticated Google/Microsoft events and social processing events, stored payload, timestamps, state, error and related lead.

**`social_webhook_inbox`:** original authenticated Meta/TikTok notification, processing cursor, retries, next-attempt time and lease. It protects callbacks that were acknowledged before processing finished.

**`leadbyte_codes`:** reference descriptions for numeric LeadByte response codes. Unknown codes can still be retained.

### Views and migrations

`lead_reporting` joins leads with vendor-code descriptions and adds reporting date/attribution fields. `lead_daily_summary` aggregates counts. `microsoft_ads_leads` identifies website leads acquired through Microsoft advertising. Views are derived SQL results, not additional lead copies.

Six migrations build the current schema: original token/rate-limit storage, full reporting records, email, queued pipeline, Microsoft reporting, and social inbox. For a new full copy use all current migrations against a new empty database.

Important: `database-template/schema.sql` explicitly covers only migrations 0001–0003. It does not provide the queue/outbox/social schema required by the current application. Do not use that file alone as the new backend's complete database.

Dates are largely Unix milliseconds; reporting views use UTC+02:00. JSON is stored as TEXT. Indexes cover processing state, source IDs, delivery, created time, phone, vendor lead ID and other query patterns.

## 7. Queue consumer and affiliate delivery

The normal queue message contains `{ leadId }`, rather than the contact payload. The consumer loads the lead from D1.

The consumer acknowledges terminal records without resending them, rejects/retries malformed jobs, and uses an atomic database update to claim eligible records. A claim sets an attempt ID, a two-minute lease and an incremented attempt count. This limits simultaneous consumers delivering the same lead.

Before sending it checks that live delivery is enabled and the record is neither a test nor non-consenting. It writes a `started` attempt, reconstructs the input, and calls `submitLead()` in `lib/leadbyte.ts`.

The current adapter is deliberately restricted to:

- Host/path: `https://returnxdigital.leadbyte.co.uk/api/submit.php`.
- Campaign `DASHCAMS`.
- Supplier `27144`.
- Offer `3046`.

The campaign/supplier parameters are in the request URL. The POST body is URL-encoded and includes `firstname`, `lastname`, `phone1`, `optinurl`, South African `optindate`, `acceptterms=true`, `offer_id`, and optional `preferredtimeofcall`.

The stored email, qualification and attribution are not forwarded as arbitrary extra API fields. Adding a CRM or a new company's required fields needs a documented adapter change.

The client applies a timeout (10 seconds by default) and records/parses the response. Numeric code `1` is accepted; `-2` is duplicate; `-3` and `-100` are temporary errors. Other codes are rejected according to the parser. A malformed response, lost connection or timeout can leave the external result uncertain.

The consumer records the final vendor details on the lead, completes the attempt, updates related webhook event states and acknowledges or retries the job. It stores the returned vendor lead ID, code, response, info, raw response, timing, upstream HTTP status and diagnostics when available.

### Retry behavior and its commercial risk

Recoverable temporary errors use exponential backoff, starting at about 60 seconds and capped at one hour. The application limits actual delivery claims to six. Queue-level delivery retries also apply; queue deliveries and vendor attempts are different counters.

The current source explicitly retries `LEADBYTE_TIMEOUT` and `LEADBYTE_NETWORK_ERROR` even when marked uncertain. Therefore, the old documentation's broad statement that uncertain deliveries are never retried is inaccurate for these cases. The vendor may already have accepted the first request. No upstream idempotency key is sent by this implementation, so a retry may return duplicate instead of preserving proof of the first acceptance.

For a reusable template, define the retry policy per vendor: use documented idempotency where supported; otherwise distinguish a definite pre-send failure from an unknown post-send result and provide reconciliation. A database lease alone cannot guarantee exactly-once delivery across two independent systems.

Expired processing leases are marked uncertain by recovery rather than silently treating the attempt as successful. Jobs exhausting retries go to the dead-letter queue and are recorded for investigation. Current consumer code identifies that queue with the literal name `bestcardash-leads-dlq`; renaming only Wrangler queues when cloning will break that branch. Configure the dead-letter identity per project or separate its handler.

## 8. Incoming webhooks

An incoming webhook receives a lead/event from an external system. LeadByte submission is a separate outbound API call. There is no implemented downstream sales/commission callback in this project.

### Google Ads: `/api/webhooks/google-ads`

The receiver expects HTTPS (with a local development exception), JSON and a body `google_key` matching the configured secret. It uses a constant-time comparison of hashes, sanitizes the stored payload, creates an event and maps Google fields into `LeadRequest`.

Form-ID mappings connect question IDs/answer labels to qualification and consent. Missing answers are not permission. Current live mappings are `{}`, so having the secret and endpoint does not demonstrate that real forms are ready for automatic delivery. Provider test flags stop test leads entering live affiliate delivery.

### Microsoft: `/api/webhooks/microsoft`

This expects the application's normalized intermediary JSON contract and Bearer token. It is not presented by the source as a native Microsoft callback format. An external integration must translate its source into fields such as externalLeadId, firstName/lastName, phone/email, campaign details, consent, qualification and test flag.

This is separate from a Bing advertisement sending a visitor to the website. That visitor follows `/api/leads`, remains ingestion source `WEBSITE`, and gets Microsoft acquisition metadata based on URL tracking.

### Meta: `/api/webhooks/meta`

GET handles callback verification with the configured verify token. POST verifies the raw body HMAC signature and expected Page ID. It commits the authenticated notification to the social inbox before acknowledging it.

Processing starts through Next.js `after()` and is recoverable by cron. The processor retrieves full lead answers from the versioned Graph API using the Page token, checks lead/form IDs, applies form mappings and calls shared ingestion.

A working deployment needs app secret, verify token, Page ID, retrieval token, supported Graph version, form mappings, platform permissions and subscription setup. The current deployed verify token alone is insufficient. Verify current platform requirements in the relevant account before implementing a launch.

### TikTok: `/api/webhooks/tiktok`

The source checks the expected advertiser, raw-body timestamped HMAC signature and a five-minute timestamp window, then stores the notification. It maps answers from the callback into shared ingestion. Each deployment currently accepts one configured advertiser; Meta similarly accepts one Page.

The implementation requires external subscription setup and actual payload verification. Code and synthetic tests are evidence of implementation, not proof of platform activation.

Both social paths default to test mode unless `SOCIAL_LEADS_TEST_MODE` is exactly `false`. Notifications deduplicate by provider/body hash and leads by provider/external ID. Processing checkpoints progress within batches and retries errors with backoff; after ten failed processing attempts an inbox item becomes failed and needs investigation.

## 9. Schedules and recovery

Wrangler declares `*/5 * * * *` and `17 2 * * *` in UTC. Every scheduled invocation runs unpublished-outbox recovery and social inbox processing. The daily invocation at 04:17 South African time also removes expired rate-limit counters.

Recovery currently considers up to 100 unpublished leads per invocation. Social processing claims up to three inbox records per pass and processes bounded batches of entries. These bounds should be load-tested before a large campaign.

Lead records are not automatically removed. Processed social inbox notifications are deleted after 30 days when social processing executes; failed notifications remain. Webhook events, attempt history, outbox history and lead rows need an explicit retention policy and cleanup design.

Scheduled handlers exist in the live version, but I did not observe an actual scheduled execution during the review.

## 10. Attribution, reporting and money

The browser retains an allowlisted set of affiliate and UTM values plus Microsoft click/campaign identifiers. Values are sanitized server-side and are untrusted marketing metadata; they cannot change the server's actual delivery offer.

Attribution is session-based. It is not a cross-device identity system or a complete long-window affiliate attribution engine. Website `gclid`, `gbraid`, `wbraid` and `fbclid` can trigger a new-touch reset but are not persisted by the website attribution allowlist. The Google native webhook separately retains `gcl_id` in metadata.

`lib/analytics.ts` defines form events but has no provider/network delivery by default. I found no invocation wiring `configureAnalytics()` to an analytics destination. Defining a success event does not send a conversion to an ad platform. The restrictive browser content-security policy would also need deliberate adjustment for external analytics scripts/connections.

Available operator commands include `report:daily`, `report:issues`, `report:pipeline`, `report:microsoft`, date-range JSON exports and reconciliation against an operator-supplied LeadByte export. They run through authenticated Wrangler/D1 access. Detailed exports contain personal information and should remain in secure ignored storage.

Reconciliation matches vendor lead IDs first and treats phone matches as candidates for review. It does not fetch LeadByte automatically, resend leads or record sales commissions.

The commercial funnel should distinguish: submitted, valid/qualified, stored, queued, vendor accepted, vendor billable, sale confirmed, commission approved, commission paid. The current implementation chiefly tracks through vendor submission result.

A future affiliate reporting layer needs ad spend, payable dispositions, campaign payout rules, refunds/reversals, invoices and payment records. Then compute cost per accepted lead, billable rate, revenue and profit using confirmed commercial states. Never treat every HTTP 200 or LeadByte acceptance as earned revenue.

## 11. Security and operational boundaries

Existing controls include parameterized SQL, source-specific webhook authentication, raw-body signature checks for social providers, body limits, shared rate limits, a honeypot, server validation, non-public reports, redacted diagnostics, security headers, test guards and server-controlled campaign destination.

The website's D1 limiter defaults to ten requests per ten-minute IP window shared across Worker instances. The reviewed webhooks do not use that same website IP limiter; define provider-appropriate abuse controls that preserve legitimate callback retries. Interactive bot challenges should not be placed in front of machine callbacks.

The readiness endpoint checks several database objects, configuration, hash secret and live toggle. It does not check every social/attempt table, queue availability, token expiry, webhook subscriptions, cron health or vendor acceptance. Add separate per-source operational checks before treating readiness as campaign health.

For multiple projects, provision distinct secrets and scope operator access. Keep each existing project's hash secret stable: rotation changes HMAC identifiers and replay/rate-limit continuity. Do not copy customer records, local development credentials, production secrets or the old database binding into a new project.

Add an operator workflow for consent evidence, corrections/deletions across related payload/history tables, paused campaigns, uncertain delivery review, dead-letter handling and vendor reconciliation. This guide describes technical behavior and operational needs, not legal approval of campaign wording.

## 12. Recommended multi-company structure

Use a shared maintained template/codebase with one production deployment bundle per company: its own domain, Worker, D1 database, primary queue, dead-letter queue, secrets, campaign configuration and staging equivalents. Shared code avoids drift; separate resources reduce accidental cross-company routing and data exposure.

Do not build a single pooled database by merely adding several domains. Current schema and application paths lack tenant scoping. Before pooling, company/project identifiers would need to scope source-ID uniqueness, lead keys, outbox/queue routing, provider credentials, reporting, consent, operator authorization and deletion. That is a larger platform project.

Extract three explicit layers:

1. **Shared engine:** ingestion, durable storage/outbox, queue claims, attempt history, retry state machine, reporting and diagnostics.
2. **Campaign definition:** identity, domain, qualification schema/rules, country/timezone, consent version, supplier/offer/campaign IDs, source mappings and retention settings.
3. **Delivery adapter:** trusted endpoint, authentication, field mapping, response semantics, idempotency and retry policy for that particular affiliate/network/CRM.

The campaign definition is a proposed refactor, not a file or API already available in the repository. Keep trusted endpoint selection on the server; browser parameters must not choose arbitrary delivery destinations.

Hardcoded items needing changes include `lib/config.ts`, `lib/leadService.ts`, `lib/leadbyte.ts`, `lib/validation.ts`, `lib/leadModel.ts`, the dead-letter queue comparison, browser storage keys, legal/consent copy, metadata, reporting timezone, Wrangler resource names and IndexNow configuration. Replacing `.env` campaign IDs alone will fail: current configuration intentionally rejects a different campaign/supplier/offer and restricts the destination host/path.

## 13. New-company onboarding checklist

1. Obtain approved offer details: legal identity, product, domain, qualification, target country, consent text/version, required fields, documented delivery API, supplier/campaign/offer identifiers, payout definition, duplicate policy, caps and a permitted vendor test procedure.
2. Create the company from a cleaned template. Exclude local env files, build output, Wrangler local state, report exports and all customer data.
3. Select the intended Cloudflare account. Decide agency-owned versus client-owned infrastructure and who controls DNS, billing, credentials and handover.
4. Provision a new Worker, D1 database and both queues. Configure self-reference, asset binding, domain routes, schedules and unique resource names. Keep code binding names `DB` and `LEAD_QUEUE` consistent unless deliberately refactored.
5. Apply all current migrations to local/staging empty databases. Do not apply the old consolidated schema plus the original migrations to the same database.
6. Install separate stable production hash secret and source-specific authentication secrets. Configure identity, exact HTTPS origin, form mappings, adapter and qualification. Keep staging delivery/indexing disabled.
7. Adapt and verify the vendor request/response contract using mocks. Check required fields, rejected/duplicate responses, rate limits, timeout uncertainty and idempotency behavior.
8. Run typecheck, lint, tests, browser checks and the Cloudflare build/preview. Include a renamed-queue test, replay/concurrency tests, outbox publication recovery and an affiliate response lost after acceptance.
9. Deploy staging against staging resources. Confirm machine callbacks work without browser challenges and no staging request can reach the production vendor.
10. Configure only the ad sources being used. Verify actual question IDs, answer labels, consent, account ownership, subscription and token lifetime with platform test tools.
11. Conduct one explicitly permitted vendor integration test. Verify database lead, queue attempt, actual vendor record and reconciled result; never submit synthetic fixture contacts to a live vendor without its approved procedure.
12. Establish monitoring, retention, secure exports, backup/restore practice and an incident owner. Verify both apex and www DNS/TLS/routing if both are advertised.
13. Enable live delivery only when ready, then enable indexing where wanted. Confirm the first authorized real lead end to end and reconcile regularly.

The existing commands are useful building blocks: `npm ci`, `npm run setup:local`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build:cloudflare`, `npm run preview` and `npm run deploy`. Provisioning commands and deploy must target the new company's configuration; this document does not execute them.

## 14. Monitoring, backups and costs

Monitor oldest unpublished outbox age, queued/retry/uncertain/dead-letter counts, delivery latency, acceptance/duplicate/rejection trends, social inbox errors, callback failures, rate limiting, storage growth and vendor caps. Set source-specific alerts rather than relying only on the public readiness endpoint.

Plan an outage procedure: pause new delivery, preserve records, investigate attempts and external acceptance, reconcile uncertain cases, repair credentials/mappings, then replay only the appropriate records. An empty outbox is not proof that all downstream deliveries succeeded.

Cloudflare documents D1 point-in-time recovery of seven days on Free and 30 days on Paid. Test restoration and maintain a longer-term export/archive process where required. R2 would be an optional export destination, not an existing app dependency. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).

At the documentation check, Workers Paid has a $5 monthly subscription with included usage and metered overages. It is not automatically $5 for each website on the same account. D1 and queue charges depend on actual usage and account allowances. This is provider pricing context, not a quotation for the current account. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

D1 Paid includes 25 billion rows read/month, 50 million rows written/month and 5 GB storage; listed excess rates are $0.001 per million reads, $1 per million writes and $0.75 per GB-month. These are account allowances, not a fresh allocation per company/database. Index updates and multi-step state handling mean one lead causes multiple writes. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

Queues Paid includes one million standard operations/month, then $0.40/million. Normal delivery generally uses three operations; retries and dead-letter movement add more. [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/).

Measure real traffic/CPU/database operations before forecasting. Costs also include domains, build/log usage where applicable, advertising, vendor services, reporting and operational time. A separate database per company does not require a separate server, but separate Cloudflare accounts may have separate subscription costs. D1's documented Paid maximum is 10 GB per database; raw payload retention and history should be monitored. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

## 15. Priority work before making this the master template

1. Extract server-owned campaign configuration and replace hardcoded IDs consistently in validation, storage and delivery.
2. Make dead-letter detection independent of the current company's literal queue name.
3. Define vendor-specific retry/idempotency/reconciliation behavior, especially network and timeout retries.
4. Replace the outdated database template with the complete six-migration pipeline schema or use migrations as the single source of truth.
5. Resolve merge markers in README.md and CLOUDFLARE.md; distinguish historical synchronous flow from queued flow and correct stale live-disabled statements.
6. Add per-source health/activation checks, monitoring and a repeatable provisioning checklist or generator.
7. Add actual attribution/conversion integrations and confirmed billability reporting if the business needs profitability measurement.
8. Document retention/deletion and backup/restore procedures across every PII-containing table.

The backend has useful reusable infrastructure. The safest next engineering step is to turn this single-campaign implementation into a configurable starter, then launch one second company through it to validate the template before replicating widely.
