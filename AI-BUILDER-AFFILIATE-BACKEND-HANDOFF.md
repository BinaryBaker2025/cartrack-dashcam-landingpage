# AI BUILDER HANDOFF ? REUSABLE AFFILIATE LEAD BACKEND

## Start here: instructions for the AI builder

Build and configure a complete working affiliate lead backend for the target company using this single file. This is a self-contained implementation reference and deployment runbook, not an already-provisioned service. The source snapshot implements a Cartrack campaign; generalize it before using it for another company. Preserve the target site's existing design unless the owner requests changes.

Read this whole file before implementation. It includes the architecture review, complete reference source files, all six database migrations, test fixtures and tests, reporting utilities, environment examples, a sanitized Cloudflare configuration and acceptance criteria. No access to the original repository is required to read the included source. Binary assets, installed dependencies, generated output, production credentials and customer data are intentionally excluded. Supply the target company's approved images/fonts when using any reference UI, or connect the backend to the target site's existing UI.

Treat filenames in source headings as relative paths. Extract their fenced contents exactly when recreating the reference. The SHA-256 values identify included content after sanitization; they do not promise parity with a currently deployed build. Retain directory structure for relative imports. The dependency lockfile is not included: install from package.json to generate a new lockfile, review compatibility, and commit it. Use npm ci only after a matching lockfile exists. Package versions are the reviewed project's baseline, not a claim that those releases remain suitable indefinitely. Read installed Next.js documentation before changing code, as required by the included AGENTS.md.

### Target project intake ? obtain actual values; do not invent them

- Project slug, company/product name, operator legal name and privacy contact.
- Target site's repository/framework, production HTTPS origin, domain/DNS access and desired hosting account ownership.
- Cloudflare account ID and authenticated provisioning/deployment access.
- Destination vendor/API documentation, approved HTTPS endpoint, authentication method and credentials.
- Actual campaign ID, supplier ID and offer ID, if that vendor uses them.
- Required contact fields, qualification rules, country, phone policy, timezone and preferred-call rules.
- Approved consent text/version, contact recipients, retention/deletion policy and reporting access.
- Vendor duplicate window, idempotency support, retry rules, caps, billability definition and permitted integration-test procedure.
- Enabled sources: website, Google native forms, Microsoft intermediary, Meta and/or TikTok. Configure only requested sources.
- For enabled platforms: account/Page/advertiser IDs, form IDs, actual question IDs/answer labels, permissions, supported API version, webhook credentials and subscriptions.

Proceed with implementation and local mock verification while missing external inputs are gathered. Keep delivery and indexing disabled until real configuration is supplied. Do not claim deployment or integration success without executing and checking it. Report exact remaining account actions if credentials or external permissions prevent completion.

### Mandatory implementation changes before another company goes live

1. Replace the hardcoded campaign/offer/supplier and endpoint rules with validated server-owned campaign configuration. Update BOTH stored database values and outbound payload mapping. Never let browser query parameters select the vendor, offer, endpoint or credentials.
2. Create a delivery adapter for the target vendor's actual contract. If it is not LeadByte, do not assume LeadByte field names, numeric codes or duplicate semantics. Preserve raw result evidence privately and normalize outcomes for the engine.
3. Replace Cartrack qualification and country/timezone assumptions consistently in browser validation, shared validation, webhook mappings, vendor payloads and reporting SQL.
4. Parameterize the dead-letter queue identity. The supplied consumer compares batch.queue to bestcardash-leads-dlq; simply renaming Wrangler queues is insufficient.
5. Use a fresh Worker, D1 database, main queue, dead-letter queue and secrets per company/environment. Never target the original campaign's resources. Keep DB and LEAD_QUEUE binding names consistent with the application.
6. Apply all six numbered migrations to a new database. The older database-template/schema.sql is deliberately not included because it stops at migration 0003 and is incomplete for this pipeline.
7. Choose the vendor retry policy explicitly. The reference retries network/timeouts even when uncertain. Use vendor idempotency when documented, or route ambiguous post-send failures to review/reconciliation instead of blindly claiming exactly-once delivery.
8. Preserve test-mode guards, real consent checks, replay protection, outbox recovery, atomic claim leases and attempt history. Do not auto-send not_sent_disabled historical records when enabling delivery.
9. Replace source branding, consent/legal copy, browser storage namespaces, canonical URLs, indexing verification and metadata. Do not copy the original operator identity as a default for a different business.
10. Add source-specific readiness and monitoring. The reference /api/leads check does not prove queue delivery, subscriptions, token validity or vendor acceptance.

### Hosting integration choices

For a new Next.js site, use the supplied Next.js/OpenNext/Worker layout with the target company's UI. For an existing non-Next site, either keep its frontend and deploy this backend as an isolated Cloudflare service, or implement an equivalent standalone Worker from these modules. A standalone Worker needs explicit HTTP routing and replacement of Next.js-specific bindings/after()/Response helpers. Do not paste Next.js route modules into another framework and assume they run.

The reference browser endpoint accepts same-origin requests. For a separate frontend origin, explicitly design an exact frontend allowlist, backend URL configuration and CORS/OPTIONS handling. Do not use wildcard CORS as a shortcut. Preserve webhook authentication independently; machine callbacks do not depend on browser CORS. A same-origin reverse-proxy arrangement can avoid cross-origin browser integration, but must be implemented and tested.

### Provisioning and launch sequence

Run commands from the NEW target project with its new configuration. These commands create infrastructure and can incur charges. Use the owner's authorized account; never execute the original production deployment as a setup shortcut.

1. Install the supported Node version and dependencies. The baseline package requires Node >=22.12; the original developer guide recommends Node 22.13+ or 24. Generate/retain the dependency lockfile.
2. Authenticate with Cloudflare and verify the account: npx wrangler login; npx wrangler whoami. Select the intended account explicitly in configuration/environment.
3. Create the NEW D1 database: npx wrangler d1 create TARGET_DATABASE_NAME. Save its returned ID in the new wrangler.jsonc.
4. Create queues: npx wrangler queues create TARGET_LEAD_QUEUE and npx wrangler queues create TARGET_DEAD_LETTER_QUEUE. Keep configuration and consumer dead-letter detection aligned.
5. Replace the sanitized Wrangler placeholders. Configure the exact target domain, Worker self-reference, asset binding, DB, queues, schedules and target campaign settings. Use the currently supported compatibility date/flags for the installed adapter.
6. Generate separate cryptographically random local and production secrets, at least 32 characters for the reference hash/auth tokens. Install production secrets using prompted npx wrangler secret put NAME --config wrangler.jsonc; never place values in this handoff, public variables, logs or Git. Keep the production hash secret stable across deployments.
7. Set up local resources with npm run setup:local. Review the script's disabled-delivery defaults. Keep local .env.local/.dev.vars private.
8. Run typecheck, lint, unit/database tests, worker integration tests and relevant browser checks. Build with npm run build:cloudflare and verify using npm run preview. The worker test script's hardcoded queue names must be adapted along with the consumer.
9. Deploy first to staging resources with delivery/indexing disabled. The supplied npm run deploy builds, applies REMOTE migrations, deploys and runs IndexNow. Configure every step for the new project first; understand that IndexNow can fail after deployment already succeeded.
10. Install only requested external subscriptions and exact form mappings. Verify real signed platform test callbacks with social test mode enabled. Test leads must not reach the vendor.
11. Confirm an authorized vendor test end to end: ingestion, stored record, outbox, queue, attempt, vendor receipt and stored outcome. Do not use random real-looking fixture phone numbers against a live campaign.
12. Enable delivery only after configuration and authorized integration checks pass. Enable indexing only for the intended production domain. Confirm apex/www behavior if both are advertised. Record active version and resource names without secrets.

### Acceptance criteria and required final builder report

- Eligible consented input is durably saved and eventually delivered using the correct company/vendor mapping.
- Invalid website inputs are rejected; authenticated incomplete platform leads retain explicit review/rejection states without delivery.
- Same token/provider lead ID is replay-safe; changed website token payload conflicts; concurrent duplicate jobs do not create parallel delivery attempts.
- Database success plus queue publication failure is recovered from the outbox.
- Network failures, vendor rejection/duplicate, response loss after possible acceptance and exhausted jobs follow the documented target-vendor policy.
- Renamed queues correctly reach the target dead-letter handler. Missing/stale credentials produce visible operational failures without leaking secrets.
- Website/API, native callbacks, scheduled recovery, reports, consent storage and retention policy are verified separately.
- Staging cannot send production leads. Test leads cannot reach the vendor. Public responses/logs do not reveal full contact records or credentials.
- Reports distinguish received, accepted, billable and paid; unsupported commercial states are not invented.
- Deliver the implemented files, generated lockfile, account/resource inventory, public URLs, test/build results, actual deployment status, missing external actions and operations runbook. Never say all running when only a build or readiness GET passed.

### Reference browser request contract

POST JSON to /api/leads with a stable UUID-shaped submissionId, firstname, lastname, phone, optional email, actual qualification answers or the reference eligibilityConfirmed affirmation, terms boolean, optional preferredtimeofcall, empty website honeypot and optional attribution object. Reuse the same submission ID for retries of the same payload. Generate a new ID when a genuinely new edited submission is intended. The included LeadForm component demonstrates the complete reference contract; replace its company-specific wording and context integration for the target site.

Reference HTTP outcomes: 200 durable receipt; 400 malformed input/honeypot/ID; 403 origin; 409 conflicting token; 415 content type; 422 qualification/validation; 429 rate limit; 503 unavailable/disabled. A 200 is not a commission event. A 503 disabled-delivery response may still have retained a not_sent_disabled record.

## Part A ? complete backend explanation and operations review

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


## Part B ? sanitized deployment starting configuration

Replace every REPLACE_ value. This configuration deliberately disables delivery/indexing. Keep the existing application configuration guards in mind: it must be generalized before a different campaign works. This file is JSONC; comments/trailing commas are allowed by Wrangler, but the supplied custom deployment scripts use a simpler parser.

### File: wrangler.jsonc

````jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "REPLACE_TARGET_WORKER_NAME",
  "account_id": "REPLACE_CLOUDFLARE_ACCOUNT_ID",
  "main": "worker.mjs",
  "compatibility_date": "2026-09-15",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "workers_dev": true,
  "preview_urls": false,
  "routes": [
    {
      "pattern": "REPLACE_TARGET_DOMAIN",
      "custom_domain": true,
    },
  ],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS",
  },
  "services": [
    {
      "binding": "WORKER_SELF_REFERENCE",
      "service": "REPLACE_TARGET_WORKER_NAME",
    },
  ],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "REPLACE_TARGET_DATABASE_NAME",
      "database_id": "REPLACE_NEW_D1_DATABASE_ID",
      "migrations_dir": "migrations",
    },
  ],
  "queues": {
    "producers": [
      {
        "binding": "LEAD_QUEUE",
        "queue": "REPLACE_TARGET_LEAD_QUEUE",
      },
    ],
    "consumers": [
      {
        "queue": "REPLACE_TARGET_LEAD_QUEUE",
        "max_batch_size": 5,
        "max_batch_timeout": 1,
        "max_retries": 5,
        "retry_delay": 60,
        "dead_letter_queue": "REPLACE_TARGET_DEAD_LETTER_QUEUE",
      },
      {
        "queue": "REPLACE_TARGET_DEAD_LETTER_QUEUE",
        "max_batch_size": 10,
        "max_retries": 100,
        "retry_delay": 300,
      },
    ],
  },
  "triggers": {
    "crons": ["17 2 * * *", "*/5 * * * *"],
  },
  "observability": {
    "enabled": true,
  },
  "vars": {
    "DEPLOY_PLATFORM": "cloudflare",
    "DEPLOY_ENV": "production",
    "NEXT_PUBLIC_SITE_URL": "https://REPLACE_TARGET_DOMAIN",
    "SITE_INDEXABLE": "false",
    "LEADBYTE_ENABLED": "false",
    "GOOGLE_ADS_FORM_MAPPINGS": "{}",
    "RATE_LIMIT_MAX": "10",
    "RATE_LIMIT_WINDOW_SECONDS": "600",
  },
}

````

### File: config/indexnow.json

Generate the corresponding public key-verification text file on the new site if IndexNow is used. This key is public verification material, not a Worker secret.

````json
{
  "origin": "https://REPLACE_TARGET_DOMAIN",
  "key": "REPLACE_PUBLIC_INDEXNOW_VERIFICATION_KEY",
  "urls": [
    "https://REPLACE_TARGET_DOMAIN/"
  ]
}
````

## Part C ? complete reference implementation

These are the existing reference sources, not a completed target-company refactor. Cartrack identifiers within the code and synthetic tests are retained to show actual behavior and must be adapted as described above. Example env campaign IDs are historical reference values, not authorization to submit to that campaign. All source files below are complete.


### File: .dev.vars.example

SHA-256: `526c727f7a820bb7c264d34cb345c8ffb65e8abaf50f736a173627d8faa6df2e`

````text
NEXTJS_ENV=development
DEPLOY_PLATFORM=cloudflare
DEPLOY_ENV=development
NEXT_PUBLIC_SITE_URL=http://localhost:3000
LEADBYTE_ENABLED=false
SITE_INDEXABLE=false
# Generate locally; use the same local value in .env and .dev.vars.
LEAD_HASH_SECRET=
# Generate a separate random 32+ character local secret. Never use the production key.
GOOGLE_ADS_WEBHOOK_KEY=
# Form-ID keyed JSON; see config/google-ads-mappings.example.json and LEAD-PIPELINE.md.
GOOGLE_ADS_FORM_MAPPINGS={}
# Separate 32+ character token for authenticated intermediary delivery (MICROSOFT-LEADS.md).
MICROSOFT_ADS_WEBHOOK_TOKEN=
# Native social lead callbacks. See SOCIAL-LEADS.md. Keep secrets out of git.
META_APP_SECRET=
META_VERIFY_TOKEN=
META_PAGE_ID=
META_PAGE_ACCESS_TOKEN=
META_GRAPH_VERSION=
META_FORM_MAPPINGS={}
TIKTOK_APP_SECRET=
TIKTOK_ADVERTISER_ID=
TIKTOK_FORM_MAPPINGS={}
SOCIAL_LEADS_TEST_MODE=true

````

### File: .env.example

SHA-256: `556f13a3c950ed7010109ca2510bcb4ea698ba730268ba51b4db12d4f35ee185`

````text
NEXT_PUBLIC_SITE_URL=http://localhost:3000
DEPLOY_PLATFORM=cloudflare
DEPLOY_ENV=development
SITE_INDEXABLE=false
# Optional public verification codes from Bing Webmaster Tools / Google Search Console.
# Provide at build time, then rebuild and deploy. See SEARCH-INDEXING.md.
BING_SITE_VERIFICATION=
GOOGLE_SITE_VERIFICATION=
LEADBYTE_ENABLED=false
LEADBYTE_ENDPOINT=https://returnxdigital.leadbyte.co.uk/api/submit.php
LEADBYTE_CAMPID=DASHCAMS
LEADBYTE_SID=27144
LEADBYTE_OFFER_ID=3046
LEADBYTE_TIMEOUT_MS=10000
RATE_LIMIT_MAX=10
RATE_LIMIT_WINDOW_SECONDS=600
CAMPAIGN_OPERATOR_NAME=REPLACE_TARGET_OPERATOR
PRIVACY_CONTACT_EMAIL=REPLACE_TARGET_PRIVACY_EMAIL
# Generate a random secret of at least 32 characters. Do not commit it.
LEAD_HASH_SECRET=
# Runtime binding values belong in .dev.vars / Cloudflare (never NEXT_PUBLIC_*).
# GOOGLE_ADS_WEBHOOK_KEY: random secret, 32+ characters
# GOOGLE_ADS_FORM_MAPPINGS: see config/google-ads-mappings.example.json
# MICROSOFT_ADS_WEBHOOK_TOKEN: separate random 32+ character runtime secret; see MICROSOFT-LEADS.md
# Native Meta / TikTok lead webhooks use Cloudflare runtime bindings in .dev.vars.
# See .dev.vars.example and SOCIAL-LEADS.md; never use NEXT_PUBLIC_* for secrets.

````

### File: .gitignore

SHA-256: `8367da5fdfa133bb6280da5cc78370bcda872a2740bf7181d9eea3639214ca20`

````text
node_modules/
.next/
.env
.env.local
.env.production
*.tsbuildinfo
prisma/*.db*
test-results/
playwright-report/
reference.html
artifacts/
.netlify/
.open-next/
.wrangler/
.dev.vars
.dev.vars.*
!.dev.vars.example
.env.*
!.env.example

````

### File: AGENTS.md

SHA-256: `63f2c50380ed6303237cce215ce27af1d620d094c215e28d1b1538a3c070e3bb`

````markdown
<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

````

### File: app/api/leads/route.ts

SHA-256: `88252e8aba81a803a939c6279533f58a2f4c89f3772089534e7658507b1d6c93`

````typescript
import { randomUUID } from 'node:crypto';
import { validateLead } from '@/lib/validation';
import { rateLimit } from '@/lib/rateLimit';
import { ingestLead, LeadConflict } from '@/lib/leadService';
import { leadBindings } from '@/lib/leadBindings';
import { submissionConfig, CONSENT_VERSION } from '@/lib/config';
import { digest, log } from '@/lib/logger';
import { ConfigurationError } from '@/lib/diagnostics';
import { checkDatabase } from '@/lib/database';
import { microsoftWebsiteDetails } from '@/lib/microsoftAds';
export const runtime = 'nodejs';
export const maxDuration = 30;
function jsonResponse(body: unknown, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}
const failure = {
  state: 'temporary_error',
  message: "We couldn't submit your request right now. Please try again shortly.",
};
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Empty body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 16384) {
      await reader.cancel();
      throw new Error('Body too large');
    }
    chunks.push(part.value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function POST(request: Request) {
  const requestId = randomUUID();
  function json(body: Record<string, unknown>, status = 200, headers = {}) {
    const defaults: Record<number, string> = {
      400: 'REQUEST_INVALID',
      403: 'ORIGIN_MISMATCH',
      415: 'CONTENT_TYPE_INVALID',
      422: 'VALIDATION_FAILED',
      429: 'RATE_LIMITED',
      409: 'SUBMISSION_CONFLICT',
      503: 'SUBMISSIONS_DISABLED',
    };
    const diagnostics = body.diagnostics || { code: defaults[status] || 'REQUEST_OK', requestId };
    if (status >= 400)
      log('lead_response_error', {
        id: requestId,
        diagnosticCode: (diagnostics as { code: string }).code,
      });
    return jsonResponse({ ...body, diagnostics }, status, {
      'X-Request-ID': requestId,
      ...headers,
    });
  }
  try {
    const { site, allowedOriginsList } = submissionConfig();
    const origin = request.headers.get('origin');
    if (
      !origin ||
      !allowedOriginsList.includes(origin) ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      return json(
        { state: 'api_rejected', message: 'Please submit your request from our website.' },
        403,
      );
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      return json({ state: 'api_rejected', message: 'Please submit using the quote form.' }, 415);
    const limit = await rateLimit(request);
    if (!limit.allowed)
      return json(
        {
          state: 'temporary_error',
          message: 'You’ve made several requests. Please wait a few minutes before trying again.',
        },
        429,
        { 'Retry-After': String(limit.retryAfter) },
      );
    let raw: Record<string, unknown>;
    try {
      raw = await readBody(request);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid body');
    } catch {
      return json(
        { state: 'api_rejected', message: 'Please check your information and try again.' },
        400,
      );
    }
    if (raw.website)
      return json({ state: 'api_rejected', message: 'We’re unable to process this request.' }, 400);
    const now = new Date();
    const validation = validateLead(raw, now);
    const { input, reasons, errors } = validation;
    if (!validation.valid) {
      if (reasons.length) {
        log('qualification_failed', { id: requestId, reasons });
      }
      return json(
        {
          state: reasons.length ? 'qualification_failed' : 'validation_failed',
          message: reasons.length
            ? 'Unfortunately, you don’t meet the requirements for this offer.'
            : 'Please check the highlighted fields.',
          errors,
          reasons,
        },
        422,
      );
    }
    if (typeof raw.submissionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(raw.submissionId))
      return json(
        { state: 'api_rejected', message: 'Please refresh the page and try again.' },
        400,
      );
    const saved = await ingestLead(
      await leadBindings(),
      {
        source: 'WEBSITE',
        externalLeadId: raw.submissionId,
        firstname: input.firstname,
        lastname: input.lastname,
        email: input.email,
        phone: input.phone,
        contactConsent: input.terms,
        marketingConsent: null,
        consentVersion: CONSENT_VERSION,
        consentSource: 'WEBSITE',
        consentTimestamp: now.toISOString(),
        submittedAt: now.toISOString(),
        receivedAt: now.toISOString(),
        qualification: {
          age: input.age,
          vehicle: input.vehicle,
          employment: input.employment,
          income: input.income,
        },
        preferredtimeofcall: input.preferredtimeofcall,
        attribution: raw.attribution,
        eligibilityConfirmed: input.eligibilityConfirmed,
        ...microsoftWebsiteDetails(raw.attribution),
      },
      site,
    );
    if (saved.legacyResult) {
      if (saved.legacyResult.result)
        return json(JSON.parse(saved.legacyResult.result), saved.legacyResult.http_status || 200);
      return json(
        {
          ...failure,
          message:
            'Your earlier request requires a delivery check. Please wait before trying again.',
        },
        409,
      );
    }
    if (saved.status === 'not_sent_disabled')
      return json(
        { ...failure, message: 'Quote requests are not available yet. Please try again later.' },
        503,
      );
    // Success here means durable receipt, never a claim of affiliate acceptance.
    return json(
      {
        state: 'success',
        message:
          'Your request has been received for processing. A representative may contact you about your quote.',
        diagnostics: { code: 'LEAD_RECEIVED', requestId },
      },
      200,
    );
  } catch (error) {
    if (error instanceof LeadConflict)
      return json(
        {
          state: 'api_rejected',
          message: 'This request has already been used. Please refresh the page.',
        },
        409,
      );
    const code = error instanceof ConfigurationError ? error.code : 'INTERNAL_ERROR';
    log('lead_request_error', { id: requestId, diagnosticCode: code });
    return json({ ...failure, diagnostics: { code, requestId } }, 503);
  }
}

// Readiness only: never sends a lead, consumes no rate-limit attempt and reveals no env values.
export async function GET() {
  const requestId = randomUUID();
  try {
    submissionConfig();
    digest('readiness');
    await checkDatabase();
    const enabled = process.env.LEADBYTE_ENABLED === 'true';
    return jsonResponse(
      {
        ready: enabled,
        diagnostics: { code: enabled ? 'READY' : 'SUBMISSIONS_DISABLED', requestId },
      },
      enabled ? 200 : 503,
    );
  } catch (error) {
    return jsonResponse(
      {
        ready: false,
        diagnostics: {
          code: error instanceof ConfigurationError ? error.code : 'INTERNAL_ERROR',
          requestId,
        },
      },
      503,
    );
  }
}

````

### File: app/api/webhooks/google-ads/route.ts

SHA-256: `7e3bbd26821c92407d20253187a964b60441abff6bd3cfc1c84a62a92353e3c5`

````typescript
import { leadBindings } from '@/lib/leadBindings';
import { googleWebhook } from '@/lib/googleWebhook';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    return await googleWebhook(request, await leadBindings());
  } catch {
    return Response.json(
      { message: 'Service unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

````

### File: app/api/webhooks/meta/route.ts

SHA-256: `9d16a8e6c2f9a226cf304eeec050f8e560be042b82708c7b1e3006c2d8e77ee9`

````typescript
import { after } from 'next/server';
import { leadBindings } from '@/lib/leadBindings';
import { metaChallenge, receiveSocialWebhook, socialReply } from '@/lib/socialWebhooks';
import { processSocialInbox } from '@/lib/socialLeadProcessor';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    return metaChallenge(request, await leadBindings());
  } catch {
    return socialReply(503);
  }
}
export async function POST(request: Request) {
  try {
    const env = await leadBindings();
    const response = await receiveSocialWebhook(request, env, 'META_ADS');
    if (response.ok) after(() => processSocialInbox(env));
    return response;
  } catch {
    return socialReply(503);
  }
}

````

### File: app/api/webhooks/microsoft/route.ts

SHA-256: `78e0adf49d76048b7668f74848e6fa014e6ca91692cafe65d46dc57fca92d0a5`

````typescript
import { leadBindings } from '@/lib/leadBindings';
import { microsoftWebhook } from '@/lib/microsoftWebhook';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    return await microsoftWebhook(request, await leadBindings());
  } catch {
    return Response.json(
      { message: 'Service unavailable' },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}

````

### File: app/api/webhooks/tiktok/route.ts

SHA-256: `402a51d6024ea3015c02fcb8fd1974a8691a1e9da77192377755b1a06e67b7c8`

````typescript
import { after } from 'next/server';
import { leadBindings } from '@/lib/leadBindings';
import { receiveSocialWebhook, socialReply } from '@/lib/socialWebhooks';
import { processSocialInbox } from '@/lib/socialLeadProcessor';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const env = await leadBindings();
    const response = await receiveSocialWebhook(request, env, 'TIKTOK_ADS');
    if (response.ok) after(() => processSocialInbox(env));
    return response;
  } catch {
    return socialReply(503);
  }
}

````

### File: app/favicon.ico/route.ts

SHA-256: `5dabb366f93dee332fee0487015f9303cfb6b9b33f6bd98b2dc8b1f23d95847c`

````typescript
// Reuse the supplied brand asset; no invented favicon artwork.
export function GET() {
  return new Response(null, {
    status: 307,
    headers: { Location: '/assets/cartrack-logo.jpg', 'Cache-Control': 'public, max-age=86400' },
  });
}

````

### File: app/globals.css

SHA-256: `a55d14b8b102f2c8d2f606617abe3c741acb26c1bdcf6e8dfa60e8b6f247588a`

````css
@import 'tailwindcss';
:root {
  --orange: #f87c3c;
  --orange-text: #aa420d;
  --ink: #171717;
  --grey: #f1f4f9;
  --font-sans: var(--font-montserrat);
}
@theme inline {
  --font-sans: var(--font-montserrat);
}
.thank-you-page {
  min-height: 100vh;
  background: white;
}
.thank-you-header {
  height: 150px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px 20px 30px;
}
.thank-you-header img {
  width: 346px;
  height: auto;
}
.thank-you-content {
  min-height: 555px;
  padding: 107px 24px 80px;
  background: #f1f4f9;
  text-align: center;
}
.thank-you-content h1 {
  font-size: 42px;
  font-weight: 400;
  line-height: 1.3;
  letter-spacing: 0;
  color: #080808;
  margin: 0 auto;
  max-width: 1000px;
}
.thank-you-content h1:focus {
  outline: none;
}
.quote-confirmations {
  margin-top: 22px;
}
.quote-confirmations + .submit-button {
  margin-top: 22px;
}
@media (max-width: 767px) {
  .thank-you-header {
    height: 125px;
    padding-top: 23px;
  }
  .thank-you-header img {
    width: 260px;
  }
  .thank-you-content {
    min-height: 480px;
    padding: 75px 24px;
  }
  .thank-you-content h1 {
    font-size: 28px;
    line-height: 1.45;
  }
}
* {
  box-sizing: border-box;
}
html {
  scroll-behavior: smooth;
  scroll-padding-top: 24px;
}
body {
  margin: 0;
  color: var(--ink);
  background: #fff;
  font-family: var(--font-montserrat), Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
}
button,
input,
select {
  font: inherit;
}
a {
  color: inherit;
}
button,
a,
input,
select,
summary {
  -webkit-tap-highlight-color: transparent;
}
:focus-visible {
  outline: 3px solid #174f8b;
  outline-offset: 4px;
}
button {
  cursor: pointer;
}
button:disabled {
  cursor: default;
  opacity: 0.7;
}
.page-width {
  width: min(1160px, calc(100% - 64px));
  margin-inline: auto;
}
.site-header {
  height: 102px;
  padding-top: 17px;
}
.brand-logo {
  width: 233px;
  height: 63px;
  object-fit: contain;
}
.hero {
  padding: 20px 0 70px;
}
.hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  gap: 70px;
  align-items: start;
}
.hero-copy {
  padding: 35px 0 0 40px;
}
.hero h1 {
  font-size: clamp(40px, 4.2vw, 60px);
  font-weight: 700;
  line-height: 1.14;
  letter-spacing: -1.5px;
  margin: 0 0 32px;
}

.hero-rule {
  width: 82%;
  height: 2px;
  background: var(--orange);
  margin-bottom: 24px;
}
.hero-description {
  font-size: 24px;
  max-width: 510px;
  line-height: 1.5;
  margin: 0;
}
.quote-panel {
  scroll-margin-top: 24px;
  background: white;
  border-radius: 23px;
  box-shadow: -5px 12px 14px #0003;
  padding: 25px 24px 18px;
  font-family: var(--font-poppins), Arial, sans-serif;
  width: 100%;
  border: 1px solid #eee;
}
.quote-panel h2 {
  font-size: 25px;
  font-weight: 700;
  text-align: center;
  margin: 0 0 5px;
}
.form-intro {
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
  color: #555;
  margin: 0 0 18px;
}
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 12px;
  min-width: 0;
}
.field label {
  font-size: 12px;
  font-weight: 700;
  line-height: 1.45;
}
.field input,
.field select {
  width: 100%;
  min-width: 0;
  height: 44px;
  padding: 10px;
  border: 1px solid #d4d4d4;
  border-radius: 4px;
  background: #f4f4f5;
  color: #202020;
  font-size: 12px;
}
.field input::placeholder {
  color: #666;
}
.field input[aria-invalid='true'],
.field select[aria-invalid='true'] {
  border-color: #b3261e;
  background: #fff8f7;
}
.name-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.field-error {
  display: block;
  color: #a32019;
  font-size: 11px;
  line-height: 1.45;
}
.call-time {
  font-size: 12px;
  margin: 2px 0 15px;
}
.call-time summary {
  cursor: pointer;
  min-height: 32px;
  padding-top: 5px;
}
.call-time summary span {
  color: #666;
}
.call-time .field {
  margin-top: 8px;
}
.field small {
  font-size: 10px;
  color: #555;
}
.consent {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  font-size: 10px;
  line-height: 1.65;
  color: #444;
  margin: 8px 0 14px;
}
.consent input {
  flex-shrink: 0;
  width: 17px;
  height: 17px;
  margin: 2px 0 0;
  accent-color: #a74210;
}
.consent a {
  text-decoration: underline;
  text-underline-offset: 2px;
}
.cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 54px;
  padding: 13px 33px;
  border: 0;
  border-radius: 32px;
  background: var(--orange);
  color: #191919;
  text-decoration: none;
  font-family: var(--font-questrial), Arial, sans-serif;
  font-size: 23px;
  line-height: 1.25;
  transition:
    background 0.15s,
    transform 0.15s;
}
.cta:hover {
  background: #ef6b24;
}
.cta:active {
  transform: translateY(1px);
}
.submit-button {
  display: flex;
  margin: 18px auto 0;
  min-height: 50px;
  width: min(260px, 100%);
  font-size: 17px;
  font-weight: 700;
}
.form-note {
  color: #666;
  text-align: center;
  font-size: 9px;
  line-height: 1.6;
  margin: 12px 0 0;
}
.form-status {
  font-size: 12px;
  line-height: 1.6;
  color: #8d281a;
}
.form-status.has-message {
  margin-top: 16px;
  padding: 12px;
  background: #fff4e9;
  border-radius: 6px;
}
.honeypot {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.benefits {
  background: var(--grey);
  padding: 62px 0 65px;
  text-align: center;
}
.benefits h2 {
  font-size: clamp(30px, 3.4vw, 44px);
  line-height: 1.2;
  font-weight: 700;
  margin: 0 auto 25px;
  letter-spacing: -1px;
}
.benefits-intro {
  max-width: 1040px;
  line-height: 1.5;
  margin: 0 auto 40px;
}
.benefits-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 40px;
  margin: 0 auto 35px;
  max-width: 1050px;
}
.product-image {
  width: 100%;
  height: auto;
  object-fit: contain;
}
.benefit-list {
  text-align: left;
  padding: 0;
  list-style: none;
  line-height: 1.6;
  font-size: 16px;
  margin: 0;
}
.benefit-list li {
  display: flex;
  gap: 8px;
  margin: 10px 0;
}
.benefit-list span {
  flex-shrink: 0;
}
.did-you-know h3 {
  color: var(--orange-text);
  font:
    42px/1.2 var(--font-handwriting),
    cursive;
  margin: 0 0 16px;
}
.did-you-know p {
  font-size: 20px;
  line-height: 1.5;
  max-width: 1000px;
  margin: 0 auto 32px;
}
.did-you-know strong {
  color: var(--orange-text);
  font-weight: 700;
}
.benefits-cta {
  min-width: 310px;
}
.closing {
  background: #2a2a2a;
  text-align: center;
  color: white;
  min-height: 334px;
  padding: 58px 24px 80px;
  font-family: var(--font-poppins), Arial, sans-serif;
}
.closing h2 {
  font-size: 40px;
  line-height: 1.2;
  font-weight: 700;
  margin: 0 0 42px;
}
.closing .cta {
  border-radius: 0;
  min-width: 335px;
  min-height: 70px;
  font-family: var(--font-poppins), Arial, sans-serif;
  font-size: 22px;
}
.footer {
  display: flex;
  justify-content: space-between;
  padding: 24px max(24px, calc((100vw - 1080px) / 2));
  font-size: 12px;
  color: #555;
  gap: 24px;
}
.footer p {
  margin: 0;
}
.footer nav {
  display: flex;
  gap: 24px;
}
.success-panel {
  padding: 25px 0 30px;
  text-align: center;
  min-height: 400px;
}
.success-panel h3 {
  font-weight: 700;
  font-size: 23px;
  margin: 20px 0 15px;
}
.success-panel p {
  font-size: 14px;
  line-height: 1.8;
}
.success-mark {
  display: inline-flex;
  width: 70px;
  height: 70px;
  background: #edf5eb;
  color: #2e672b;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  font-size: 34px;
}
.muted {
  color: #666;
}
.skip-link {
  position: absolute;
  left: 20px;
  top: -80px;
  z-index: 10;
  padding: 12px;
  background: white;
}
.skip-link:focus {
  top: 12px;
}
.legal {
  max-width: 760px;
  margin: 50px auto;
  padding: 0 24px 60px;
}
.legal h1 {
  font-size: 38px;
  line-height: 1.2;
  font-weight: 700;
  margin: 35px 0 24px;
}
.legal h2 {
  font-size: 22px;
  font-weight: 700;
  margin: 28px 0 12px;
}
.legal p {
  margin: 16px 0;
  line-height: 1.8;
}
.legal a {
  text-decoration: underline;
}
.legal ul {
  padding-left: 24px;
  list-style: disc;
}
.legal li {
  margin: 10px 0;
}
@media (min-width: 1280px) {
  .hero-grid {
    padding-right: 35px;
  }
  .hero-copy {
    padding-top: 50px;
  }
}
@media (max-width: 1023px) {
  .hero-grid {
    grid-template-columns: minmax(0, 1fr) 370px;
    gap: 30px;
  }
  .hero-copy {
    padding-left: 0;
  }
  .hero-description {
    font-size: 20px;
  }
  .page-width {
    width: calc(100% - 48px);
  }
  .quote-panel {
    padding: 23px 20px;
  }
  .benefits-grid {
    gap: 25px;
  }
  .benefit-list {
    font-size: 14px;
  }
}
@media (max-width: 767px) {
  .page-width {
    width: calc(100% - 40px);
  }
  .site-header {
    height: 94px;
    padding-top: 14px;
  }
  .site-header .page-width {
    text-align: center;
  }
  .brand-logo {
    margin: auto;
    width: 210px;
    height: auto;
  }
  .hero {
    padding: 10px 0 48px;
  }
  .hero-grid {
    display: flex;
    flex-direction: column;
    gap: 32px;
    align-items: center;
  }
  .hero-copy {
    text-align: center;
    padding: 14px 0 0;
    width: 100%;
    max-width: 480px;
  }
  .hero h1 {
    font-size: 40px;
    line-height: 1.15;
    margin: 0 0 20px;
    letter-spacing: -1px;
  }
  .hero h1 br {
    display: none;
  }

  .hero-rule {
    width: 86%;
    margin: 0 auto 19px;
  }
  .hero-description {
    font-size: 19px;
    line-height: 1.5;
    margin: 0 auto;
    max-width: 360px;
  }
  .quote-panel {
    max-width: 430px;
    padding: 23px 20px 18px;
  }
  .quote-panel h2 {
    font-size: 25px;
  }
  .benefits {
    padding: 44px 0 48px;
  }
  .benefits h2 {
    font-size: 32px;
    max-width: 430px;
    margin-bottom: 24px;
  }
  .benefits-intro {
    font-size: 15px;
    line-height: 1.65;
    max-width: 500px;
    margin-bottom: 30px;
  }
  .benefits-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 30px;
  }
  .product-image {
    max-width: 519px;
  }
  .benefit-list {
    font-size: 14px;
    align-self: center;
  }
  .benefit-list li {
    margin: 11px 0;
  }
  .did-you-know h3 {
    font-size: 42px;
  }
  .did-you-know p {
    font-size: 17px;
    margin-bottom: 29px;
  }
  .benefits-cta {
    min-width: 0;
    width: min(320px, 100%);
    font-size: 23px;
  }
  .closing {
    min-height: 290px;
    padding: 49px 20px 60px;
  }
  .closing h2 {
    font-size: 31px;
    max-width: 360px;
    margin: 0 auto 32px;
  }
  .closing .cta {
    min-width: 0;
    width: min(335px, 100%);
    min-height: 64px;
  }
  .footer {
    flex-direction: column;
    text-align: center;
    align-items: center;
    gap: 12px;
  }
  .success-panel {
    min-height: 350px;
  }
}
.benefits-intro {
  max-width: 800px;
  margin-bottom: 50px;
}
.benefits-grid {
  grid-template-columns: 440px minmax(0, 1fr);
  grid-template-rows: auto auto auto;
  text-align: left;
  align-items: start;
  gap: 50px 40px;
  max-width: 1050px;
  margin-bottom: 0;
}
.benefit-list {
  grid-column: 1;
  grid-row: 1;
}
.product-image {
  grid-column: 2;
  grid-row: 1 / 3;
}
.did-you-know {
  grid-column: 1;
  grid-row: 2;
}
.did-you-know p {
  margin: 0;
}
.benefits-cta {
  grid-column: 1 / -1;
  grid-row: 3;
  justify-self: center;
}
.closing .cta {
  border-radius: 36px;
}
@media (min-width: 768px) and (max-width: 1100px) {
  .hero h1 {
    white-space: normal;
    font-size: 43px;
  }
  .hero-grid {
    grid-template-columns: minmax(0, 1fr) 370px;
    gap: 35px;
  }
  .benefits-grid {
    grid-template-columns: 1fr 1fr;
    gap: 35px;
  }
  .hero-copy {
    padding-left: 0;
  }
  .hero-description {
    font-size: 19px;
  }
}
@media (max-width: 767px) {
  .site-header {
    height: 150px;
    padding-top: 28px;
  }
  .hero h1 {
    white-space: normal;
    font-size: 40px;
    max-width: 360px;
    margin-inline: auto;
  }
  .hero-copy {
    padding-top: 8px;
  }

  .hero-rule {
    margin-top: 26px;
  }
  .hero-description {
    font-size: 19px;
  }
  .hero-grid {
    gap: 35px;
  }
  .benefits-grid {
    display: flex;
    gap: 0;
    text-align: center;
  }
  .benefit-list {
    order: 0;
    align-self: center;
    text-align: left;
    margin-bottom: 40px;
  }
  .benefits-cta {
    order: 1;
    align-self: center;
    margin-bottom: 60px;
  }
  .did-you-know {
    order: 2;
  }
  .did-you-know p {
    margin-bottom: 40px;
  }
  .product-image {
    order: 3;
    align-self: center;
    margin-bottom: 30px;
  }
  .benefits-intro {
    margin-bottom: 30px;
  }
  .hero {
    padding-bottom: 70px;
  }
  .name-fields {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  * {
    transition: none !important;
  }
}
@media (max-width: 767px) {
  .field input,
  .field select {
    font-size: 16px;
  }
  .consent {
    font-size: 12px;
  }
  .form-note {
    font-size: 10px;
  }
}

/* Supplied Cartrack reference: airy split hero and compact contact form. */
.site-header {
  height: 150px;
  padding-top: 18px;
}
.site-header .page-width {
  text-align: center;
}
.brand-logo {
  width: clamp(210px, 13vw, 250px);
  height: auto;
  margin-inline: auto;
}
.hero {
  padding: 0 0 44px;
}
.hero-grid {
  width: min(1110px, calc(100% - 96px));
  grid-template-columns: minmax(0, 620px) 370px;
  gap: 24px;
  justify-content: center;
  padding-right: 0;
}
.hero-copy {
  padding: 0;
}
.hero h1 {
  color: #111927;
  font-size: clamp(46px, 3.3vw, 57px);
  letter-spacing: -1.3px;
  line-height: 1.15;
  white-space: nowrap;
  margin: 0;
}
.hero-price {
  margin-top: 27px;
}
.price-intro {
  font-family: var(--font-handwriting), cursive;
  font-size: 33px;
  line-height: 1;
  margin: 0 0 15px;
}
.price-amount {
  display: flex;
  align-items: baseline;
  line-height: 1;
  margin: 0;
  font-weight: 700;
  letter-spacing: -4px;
}
.price-amount > span {
  font-size: clamp(70px, 4.6vw, 84px);
  color: #ed702e;
  text-shadow: 0 3px 2px #0008;
}
.price-amount small {
  font-size: 45px;
  color: #080808;
  letter-spacing: -2px;
}
.hero-rule {
  width: 250px;
  height: 5px;
  margin: 14px 0 35px;
}
.hero-description {
  font-size: 21px;
  line-height: 1.42;
  max-width: 535px;
  margin: 0;
}
.quote-panel {
  padding: 22px 19px 17px;
  border: 0;
  border-radius: 30px;
  box-shadow:
    -7px 15px 12px #0009,
    0 0 12px #00000008;
  color: #111927;
}
.quote-panel h2 {
  font-size: 25px;
  line-height: 1.45;
  margin: 0 0 25px;
}
.contact-field {
  margin: 0 0 12px;
}
.contact-field:last-child {
  margin-bottom: 0;
}
.contact-field input {
  height: 44px;
  border: 1px solid transparent;
  border-radius: 0;
  padding: 16px 18px;
  background: #f4f4f6;
  font-size: 14px;
  color: #111927;
}
.contact-field input::placeholder {
  color: #172539;
  opacity: 1;
}
.contact-field input:focus {
  outline-offset: 0;
}
.phone-input {
  display: flex;
  align-items: center;
  background: #efeff2;
}
.phone-input input {
  background: transparent;
  flex: 1;
  width: 0;
}
.phone-prefix {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 12px;
  font-size: 14px;
  flex-shrink: 0;
  border-right: 1px solid #dedee4;
}
.quote-panel .submit-button {
  margin-top: 30px;
  width: min(225px, 100%);
  min-height: 50px;
  font-size: 18px;
  color: white;
  background: #ed702e;
  font-weight: 700;
}
.quote-panel .form-note {
  font-size: 10px;
  margin: 14px 0 0;
}
.quote-panel .form-intro {
  margin-top: -15px;
}
.back-to-details {
  border: 0;
  background: transparent;
  padding: 0 0 18px;
  font-size: 13px;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.quote-panel [hidden] {
  display: none;
}
.quote-panel .consent {
  font-size: 12px;
}
@media (max-width: 1350px) and (min-width: 768px) {
  .hero-grid {
    width: calc(100% - 64px);
    grid-template-columns: minmax(0, 1fr) 380px;
    gap: 24px;
  }
  .hero h1 {
    white-space: normal;
    font-size: 46px;
  }
  .hero-description {
    font-size: 21px;
  }
  .price-amount > span {
    font-size: 80px;
  }
  .price-amount small {
    font-size: 42px;
  }
  .hero-rule {
    width: 280px;
  }
  .hero-price {
    margin-top: 28px;
  }
}
@media (max-width: 767px) {
  .site-header {
    height: 112px;
    padding-top: 22px;
  }
  .brand-logo {
    width: 233px;
  }
  .hero {
    padding-bottom: 48px;
  }
  .hero-grid {
    width: calc(100% - 40px);
    gap: 18px;
  }
  .hero-copy {
    padding: 0;
  }
  .hero h1 {
    white-space: normal;
    font-size: 40px;
    margin-inline: auto;
  }
  .hero-price {
    margin-top: 18px;
  }
  .price-intro {
    font-size: 31px;
    margin-bottom: 9px;
  }
  .price-amount {
    justify-content: center;
  }
  .price-amount > span {
    font-size: 78px;
  }
  .price-amount small {
    font-size: 42px;
  }
  .hero-rule {
    width: 265px;
    height: 4px;
    margin: 14px auto 20px;
  }
  .hero-description {
    font-size: 19px;
    max-width: 355px;
    margin-inline: auto;
  }
  .quote-panel {
    padding: 26px 20px 22px;
    border-radius: 25px;
  }
  .quote-panel h2 {
    font-size: 28px;
    margin-bottom: 24px;
  }
  .contact-field input {
    font-size: 16px;
  }
  .quote-panel .submit-button {
    margin-top: 32px;
    font-size: 23px;
  }
}

````

### File: app/layout.tsx

SHA-256: `77d29933722ec6243c0cb0ad573d3882fe4316996969a084c5e7d1ceb513f5e7`

````tsx
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { siteUrl } from '@/lib/config';
import { isIndexable } from '@/lib/hosting';
import './globals.css';
const montserrat = localFont({
  src: [
    { path: '../public/assets/fonts/montserrat-0.ttf', weight: '400' },
    { path: '../public/assets/fonts/montserrat-1.ttf', weight: '700' },
  ],
  variable: '--font-montserrat',
  display: 'swap',
});
const poppins = localFont({
  src: [
    { path: '../public/assets/fonts/poppins-0.ttf', weight: '400' },
    { path: '../public/assets/fonts/poppins-1.ttf', weight: '700' },
  ],
  variable: '--font-poppins',
  display: 'swap',
});
const questrial = localFont({
  src: '../public/assets/fonts/questrial-0.ttf',
  variable: '--font-questrial',
  display: 'swap',
  preload: false,
});
const handwriting = localFont({
  src: '../public/assets/fonts/nanum-pen-script-0.ttf',
  variable: '--font-handwriting',
  display: 'swap',
  preload: false,
});
const indexable = isIndexable();
export const metadata: Metadata = {
  icons: { icon: '/assets/cartrack-logo.jpg' },
  metadataBase: new URL(siteUrl()),
  title: 'CarTrack Cameras | Get a Free Quote',
  description:
    'Protect your vehicle and capture every moment with CarTrack’s dashcam. Check your eligibility and request a free call back.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'CarTrack Cameras | Get a Free Quote',
    description: 'Request a call about CarTrack Cameras for your vehicle.',
    url: '/',
    type: 'website',
    locale: 'en_ZA',
    images: [
      { url: '/assets/dashcam-product.jpeg', width: 519, height: 258, alt: 'CarTrack dashcam' },
    ],
  },
  robots: { index: indexable, follow: indexable },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION?.trim() || undefined,
    other: process.env.BING_SITE_VERIFICATION?.trim()
      ? { 'msvalidate.01': process.env.BING_SITE_VERIFICATION.trim() }
      : undefined,
  },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZA">
      <body
        suppressHydrationWarning
        className={`${montserrat.variable} ${poppins.variable} ${questrial.variable} ${handwriting.variable}`}
      >
        {children}
      </body>
    </html>
  );
}

````

### File: app/page.tsx

SHA-256: `09e04a6f357cbf8d69cd44a2d35b0e107990e1bf051d82ff560f67ee5d9077d5`

````tsx
import Image from 'next/image';
import Link from 'next/link';
import LeadForm from '@/components/form/LeadForm';
import QuoteExperience from '@/components/QuoteExperience';
export default function Home() {
  return (
    <QuoteExperience>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="page-width">
          <Link href="/" aria-label="CarTrack Cameras home">
            <Image
              src="/assets/cartrack-logo.jpg"
              alt="Cartrack"
              width={233}
              height={63}
              priority
              className="brand-logo"
            />
          </Link>
        </div>
      </header>
      <main id="main">
        <section className="hero">
          <div className="page-width hero-grid">
            <div className="hero-copy">
              <h1>Protect your vehicle</h1>
              <div className="hero-price" aria-label="From as little as R7 per day. Terms apply.">
                <p className="price-intro">from as little as</p>
                <p className="price-amount">
                  <span>R7</span>
                  <small>/day*</small>
                </p>
              </div>
              <div className="hero-rule" />
              <p className="hero-description">
                Protect your vehicle and capture every moment with Cartrack&apos;s dashcam
              </p>
            </div>
            <LeadForm />
          </div>
        </section>
        <section className="benefits" aria-labelledby="benefits-title">
          <div className="page-width">
            <h2 id="benefits-title">Why you need a car dashcam</h2>
            <p className="benefits-intro">
              Accidents, potholes, insurance disputes, or even just reckless drivers, these are
              everyday risks on our roads. A Cartrack Dashcam puts you in control by documenting
              everything that happens.
            </p>
            <div className="benefits-grid">
              <Image
                className="product-image"
                loading="eager"
                src="/assets/dashcam-product.jpeg"
                alt="Driver with a Cartrack dashcam installed on the windscreen"
                width={519}
                height={258}
                sizes="(max-width: 767px) calc(100vw - 40px), 519px"
              />
              <ul className="benefit-list">
                {[
                  'Deterring car break-ins and vandalism',
                  'Peace of mind on the road',
                  'Easy, hassle-free installation process',
                  'GPS capabilities',
                ].map((text) => (
                  <li key={text}>
                    <span aria-hidden="true">✅</span>
                    {text}
                  </li>
                ))}
              </ul>
              <aside className="did-you-know">
                <h3>Did you know?</h3>
                <p>
                  Insurance companies in South Africa are becoming{' '}
                  <strong>more open to offering favourable premiums</strong> to drivers who use
                  dashcams, as they provide concrete evidence that can expedite insurance claims.
                </p>
              </aside>
              <a className="cta benefits-cta" href="#quote">
                Get a free call back
              </a>
            </div>
          </div>
        </section>
        <section className="closing">
          <h2>Get your free quote today</h2>
          <a className="cta" href="#quote">
            Get your quote
          </a>
        </section>
      </main>
      <footer className="footer">
        <p>CarTrack Cameras · *From R7 per day. Terms apply.</p>
        <nav aria-label="Legal">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy notice</a>
        </nav>
      </footer>
    </QuoteExperience>
  );
}

````

### File: app/privacy/page.tsx

SHA-256: `026e73a3efb8fcd66e2f47dcb166f8cfeb968921b14f39ff5e827dac03c99ac6`

````tsx
import Link from 'next/link';
import { campaignIdentity } from '@/lib/config';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Privacy notice | CarTrack Cameras',
  alternates: { canonical: '/privacy' },
  robots: { index: false, follow: false },
};
export default function Privacy() {
  const identity = campaignIdentity();
  return (
    <main className="legal">
      <Link href="/">← Back to your quote</Link>
      <h1>Privacy notice</h1>
      <p>
        When you request a quote, this site collects your name, email address, South African mobile
        number, eligibility answers, contact consent and, if provided, preferred call time.
      </p>
      <h2>How your details are used</h2>
      <p>
        Your eligibility answers determine whether you meet this campaign’s initial requirements.
        Qualified requests are sent to LeadByte, the campaign’s lead processing service, for
        processing and contact by CarTrack and its campaign service providers. Your full phone
        number is sent securely to that service. We also retain your completed, qualified request in
        our database, including your name, email address, mobile number, eligibility answers,
        consent and preferred call time. These records help us report on requests and check delivery
        against LeadByte. A request may be recorded even if delivery is unavailable or rejected.
      </p>
      <h2>What this site retains</h2>
      <p>
        Your browser temporarily stores campaign attribution, a submission identifier, attempt times
        and a submission result. These records do not contain your name or mobile number.
        Attribution may include the referring affiliate, transaction ID, UTM campaign parameters,
        Microsoft Advertising click ID and campaign, ad group and ad identifiers.
      </p>
      <p>
        Our database also records campaign attribution, the submitted details, submission times, the
        consent notice version and LeadByte delivery results, including reference IDs and rejection
        reasons. Access to these records and reports is restricted to authorised operators. We use
        pseudonymous network identifiers to limit repeated requests. Diagnostic logs use request IDs
        and redacted messages rather than full contact details.
      </p>
      <h2>Retention and your choices</h2>
      <p>
        Browser result records expire after 30 minutes and are removed when the site next accesses
        storage. Session storage generally ends when the tab closes, although browser session
        restore may preserve it. Lead records are retained for reporting and delivery
        reconciliation; they are not automatically deleted after 30 days. You can contact the
        operator below about access, correction or deletion. Network rate-limit records expire at
        the end of their configured window and are removed by daily cleanup. Hosting logs follow the
        operator’s hosting retention settings. CarTrack and its service providers apply their own
        retention policies to the details they receive. You may decline a call or ask the
        representative to stop further contact. No purchase is required to submit this form.
      </p>
      <h2>Privacy enquiries</h2>
      <p>{identity.name}</p>
      {identity.email && (
        <p>
          For access, correction, deletion or contact preferences, email{' '}
          <a href={`mailto:${identity.email}`}>{identity.email}</a>.
        </p>
      )}
    </main>
  );
}

````

### File: app/robots.ts

SHA-256: `6d0b3412d502cfc591ef71dd13d6e5539e9db4eea222a536cd07aadc4856e6f8`

````typescript
import type { MetadataRoute } from 'next';
import { isIndexable } from '@/lib/hosting';
import { siteUrl } from '@/lib/config';
export default function robots(): MetadataRoute.Robots {
  const allow = isIndexable();
  return {
    rules: { userAgent: '*', ...(allow ? { allow: '/', disallow: ['/api/'] } : { disallow: '/' }) },
    ...(allow ? { sitemap: `${siteUrl()}/sitemap.xml` } : {}),
  };
}

````

### File: app/sitemap.ts

SHA-256: `cdbdbbb78cf3739b6e299a13e3053959a28cc37bb305500e098f4edb30fbfabd`

````typescript
import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/config';
import { isIndexable } from '@/lib/hosting';

export default function sitemap(): MetadataRoute.Sitemap {
  // Legal pages explicitly opt out of indexing; advertise only the landing page.
  return isIndexable() ? [{ url: `${siteUrl()}/` }] : [];
}

````

### File: app/terms/page.tsx

SHA-256: `3c59e3fe1216e4076eb3d4addd591cae2fb16c6761e0ea19880e95fc3af4ddb4`

````tsx
import Link from 'next/link';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Terms | CarTrack Cameras',
  alternates: { canonical: '/terms' },
  robots: { index: false, follow: false },
};
export default function Terms() {
  return (
    <main className="legal">
      <Link href="/">← Back to your quote</Link>
      <h1>Quote request terms</h1>
      <p>
        This form is a request to be contacted about CarTrack Cameras. Submitting a request does not
        enter you into a purchase contract and does not guarantee acceptance, a particular price,
        installation or insurance benefits.
      </p>
      <h2>Who can request a call?</h2>
      <p>
        This campaign is for South African residents aged 18 or older who have access to a vehicle,
        are employed or self-employed, and earn at least R10,000 per month. Please provide accurate
        information and use your own mobile number.
      </p>
      <h2>Your request</h2>
      <p>
        By accepting the form’s consent statement, you agree that your details may be shared with
        CarTrack and the campaign’s service providers to process your request and contact you about
        CarTrack Cameras. Any preferred call time is a request and is subject to availability.
      </p>
      <p>
        A successful submission means we have saved your request for processing. CarTrack will
        explain any applicable product terms and pricing before you decide whether to proceed.
      </p>
      <h2>Contact preferences</h2>
      <p>
        You may decline the offer or ask the representative not to contact you again. Read the{' '}
        <a href="/privacy">privacy notice</a> for information about how your request is handled.
      </p>
    </main>
  );
}

````

### File: components/QuoteExperience.tsx

SHA-256: `d7f344eb266e45d002dde913c4ad42656af3c968fbf44a543cf6f98d24460773`

````tsx
'use client';

import Image from 'next/image';
import { createContext, useEffect, useRef, useState, type ReactNode } from 'react';

export const QuoteSuccessContext = createContext<(() => void) | null>(null);

function ThankYou() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = 'Thank you | CarTrack Cameras';
    window.scrollTo({ top: 0, behavior: 'instant' });
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="thank-you-page">
      <header className="thank-you-header">
        <Image
          src="/assets/cartrack-logo.jpg"
          alt="Cartrack"
          width={346}
          height={94}
          loading="eager"
        />
      </header>
      <main className="thank-you-content">
        <h1 tabIndex={-1} ref={heading}>
          Thank you for your application.
          <br />
          We’ll be in touch shortly.
        </h1>
      </main>
    </div>
  );
}

export default function QuoteExperience({ children }: { children: ReactNode }) {
  const [accepted, setAccepted] = useState(false);
  return (
    <QuoteSuccessContext.Provider value={() => setAccepted(true)}>
      {accepted ? <ThankYou /> : children}
    </QuoteSuccessContext.Provider>
  );
}

````

### File: components/form/LeadForm.tsx

SHA-256: `e62d88e863b4845ed64c6778dfefebd45d4e198b228515edf88d43e3bcda1a3e`

````tsx
'use client';
import { useContext, useEffect, useRef, useState, type FormEvent } from 'react';
import { validateLead, type FieldErrors } from '@/lib/validation';
import { sessionAttribution } from '@/lib/attribution';
import { track } from '@/lib/analytics';
import { submissionKey } from '@/lib/submissionKey';
import { browserAttempt, browserReceipt, saveBrowserReceipt } from '@/lib/browserState';
import { reportDiagnostic } from '@/lib/diagnostics';
import { QuoteSuccessContext } from '@/components/QuoteExperience';
type State =
  | 'idle'
  | 'validating'
  | 'submitting'
  | 'success'
  | 'qualification_failed'
  | 'duplicate'
  | 'api_rejected'
  | 'temporary_error';
export default function LeadForm() {
  const [state, setState] = useState<State>('idle');
  const onSuccess = useContext(QuoteSuccessContext);
  useEffect(() => {
    if (state === 'success') onSuccess?.();
  }, [state, onSuccess]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');
  const busy = useRef(false);
  const started = useRef(false);
  const viewed = useRef(false);
  const submission = useRef({ id: '', payload: '' });
  const status = useRef<HTMLDivElement>(null);
  useEffect(() => {
    sessionAttribution();
    if (!viewed.current) {
      track('landing_page_view');
      viewed.current = true;
    }
  }, []);
  const locked = state === 'submitting' || state === 'validating';
  function begin() {
    if (!started.current) {
      started.current = true;
      track('form_started');
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || locked) return;
    busy.current = true;
    setState('validating');
    setMessage('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const raw = {
      ...Object.fromEntries(data),
      terms: true,
      eligibilityConfirmed: true,
    };
    const validation = validateLead(raw);
    setErrors(validation.errors);
    if (!validation.valid) {
      setState(validation.reasons.length ? 'qualification_failed' : 'idle');
      setMessage(
        validation.reasons.length
          ? 'Unfortunately, you don’t meet the requirements for this offer.'
          : 'Please check the highlighted fields.',
      );
      track(validation.reasons.length ? 'qualification_failed' : 'form_validation_failed', {
        reasons: validation.reasons,
        fields: Object.keys(validation.errors),
      });
      busy.current = false;
      const firstError = Object.keys(validation.errors)[0];
      requestAnimationFrame(() =>
        form.querySelector<HTMLElement>(`[name="${firstError}"]`)?.focus(),
      );
      return;
    }
    const payload = JSON.stringify(validation.input);
    // Reuse the same key after uncertain network outcomes. Changed data gets a new key.
    setState('submitting');
    try {
      if (submission.current.payload !== payload)
        submission.current = { id: await submissionKey(payload), payload };
      const saved = browserReceipt(submission.current.id);
      if (saved) {
        setState(saved.state);
        setMessage(saved.message);
        requestAnimationFrame(() => status.current?.focus());
        return;
      }
      const attempt = browserAttempt();
      if (!attempt.allowed) {
        setState('temporary_error');
        setMessage(
          `Please wait ${Math.ceil(attempt.retryAfter / 60)} minute(s) before trying again.`,
        );
        return;
      }
      track('lead_submit_started');
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validation.input,
          submissionId: submission.current.id,
          attribution: sessionAttribution(),
        }),
      });
      let result;
      try {
        result = await response.json();
      } catch {
        reportDiagnostic({ code: 'API_NON_JSON_RESPONSE' }, response.status);
        setState('temporary_error');
        setMessage('We could not read the server response. Please try again shortly.');
        track('lead_submit_error');
        return;
      }
      reportDiagnostic(result?.diagnostics, response.status);
      const states: State[] = [
        'success',
        'qualification_failed',
        'duplicate',
        'api_rejected',
        'temporary_error',
      ];
      const next: State =
        states.includes(result.state) && (result.state !== 'success' || response.ok)
          ? result.state
          : 'api_rejected';
      setState(next);
      setMessage(
        typeof result.message === 'string'
          ? result.message
          : 'Please check your information and try again.',
      );
      if (result.errors) setErrors(result.errors);
      if (next === 'duplicate') {
        const duplicateFields = Array.isArray(result.duplicateFields)
          ? result.duplicateFields.filter(
              (field: unknown): field is keyof FieldErrors =>
                ['firstname', 'lastname', 'phone', 'email'].includes(String(field)),
            )
          : ['phone'];
        setErrors((current) => ({
          ...current,
          ...Object.fromEntries(
            duplicateFields.map((field: keyof FieldErrors) => [
              field,
              'This detail has already been submitted.',
            ]),
          ),
        }));
      }
      if (next === 'success' || next === 'duplicate')
        saveBrowserReceipt(
          submission.current.id,
          { state: next, message: result.message },
          sessionAttribution(),
        );
      if (result.retryable === true)
        submission.current = { id: await submissionKey(payload, true), payload };
      track(
        next === 'success'
          ? 'lead_submit_success'
          : next === 'temporary_error'
            ? 'lead_submit_error'
            : next === 'qualification_failed'
              ? 'qualification_failed'
              : 'lead_submit_rejected',
        { state: next },
      );
      requestAnimationFrame(() => status.current?.focus());
    } catch {
      reportDiagnostic({ code: 'BROWSER_REQUEST_FAILED' });
      setState('temporary_error');
      setMessage('We couldn’t confirm your request. Check your connection, then try again.');
      track('lead_submit_error');
    } finally {
      busy.current = false;
    }
  }
  function fieldError(name: keyof FieldErrors) {
    return errors[name] ? (
      <span className="field-error" id={`${name}-error`}>
        {errors[name]}
      </span>
    ) : null;
  }
  function input(
    name: 'firstname' | 'lastname' | 'phone' | 'email',
    label: string,
    autocomplete: string,
  ) {
    return (
      <div className="field contact-field">
        <label className="sr-only" htmlFor={name}>
          {label}
        </label>
        <div className={name === 'phone' ? 'phone-input' : undefined}>
          {name === 'phone' && (
            <span className="phone-prefix" aria-hidden="true">
              <svg width="20" height="14" viewBox="0 0 30 20" focusable="false">
                <path fill="#de3831" d="M0 0h30v10H0z" />
                <path fill="#002395" d="M0 10h30v10H0z" />
                <path fill="#fff" d="m0 0 12 7h18v6H12L0 20z" />
                <path fill="#007a4d" d="m0 0 13 8h17v4H13L0 20z" />
                <path fill="#ffb612" d="m0 3 11 7L0 17z" />
                <path fill="#141414" d="m0 5 8 5-8 5z" />
              </svg>
              <span>+27</span>
            </span>
          )}
          <input
            id={name}
            name={name}
            type={name === 'phone' ? 'tel' : name === 'email' ? 'email' : 'text'}
            inputMode={name === 'phone' ? 'tel' : name === 'email' ? 'email' : 'text'}
            autoComplete={autocomplete}
            maxLength={name === 'phone' ? 30 : name === 'email' ? 254 : 80}
            required
            aria-invalid={!!errors[name]}
            aria-describedby={errors[name] ? `${name}-error` : undefined}
            placeholder={name === 'phone' ? 'Phone *' : `${label} *`}
            onChange={() => {
              if (errors[name])
                setErrors((current) => {
                  const next = { ...current };
                  delete next[name];
                  return next;
                });
              if (message) setMessage('');
            }}
          />
        </div>
        {fieldError(name)}
      </div>
    );
  }
  return (
    <section className="quote-panel" id="quote" aria-labelledby="quote-title">
      <h2 id="quote-title">{state === 'success' ? 'Thank you!' : 'Get a Quote'}</h2>
      {state === 'success' ? (
        <div className="success-panel" tabIndex={-1} ref={status} role="status">
          <span className="success-mark" aria-hidden="true">
            ✓
          </span>
          <h3>Your request is in.</h3>
          <p>{message}</p>
          <p className="muted">Keep your phone nearby. There’s nothing else you need to submit.</p>
        </div>
      ) : (
        <>
          <form onSubmit={submit} onFocus={begin} noValidate aria-busy={state === 'submitting'}>
            <fieldset disabled={locked}>
              <legend className="sr-only">Your details and eligibility</legend>
              <div className="contact-fields">
                {input('firstname', 'First name', 'given-name')}
                {input('lastname', 'Last name', 'family-name')}
                {input('phone', 'South African mobile number', 'tel')}
                {input('email', 'Email address', 'email')}
              </div>
              <div className="quote-confirmations">
                <div className="honeypot" aria-hidden="true">
                  <label htmlFor="website">Leave this field empty</label>
                  <input name="website" id="website" tabIndex={-1} autoComplete="off" />
                </div>
              </div>
              <button className="cta submit-button" type="submit" disabled={locked}>
                {state === 'submitting'
                  ? 'SENDING REQUEST…'
                  : state === 'validating'
                    ? 'CHECKING DETAILS…'
                    : 'CALL ME BACK'}
              </button>
              <p className="form-note">
                By submitting this form, I confirm that I am 18 or older, have access to a vehicle
                and am employed. I accept the{' '}
                <a href="/terms">terms</a> and{' '}
                <a href="/privacy">privacy notice</a>, and consent to my details being shared with
                the service provider and its authorized partners so that a representative may
                contact me regarding the requested or future products and services.
              </p>
            </fieldset>
            <div
              className={`form-status ${message ? 'has-message' : ''}`}
              role="status"
              aria-live="polite"
              tabIndex={-1}
              ref={status}
            >
              {message}
            </div>
          </form>
        </>
      )}
    </section>
  );
}

````

### File: config/google-ads-mappings.example.json

SHA-256: `551498366c2741ce16a7ad7833d3fa07f7d89b0bff9d9a2ad0d8311ba04efcaa`

````json
{
  "REPLACE_WITH_ACTUAL_GOOGLE_FORM_ID": {
    "fields": {
      "firstname": "FIRST_NAME",
      "lastname": "LAST_NAME",
      "email": "EMAIL",
      "phone": "PHONE_NUMBER"
    },
    "answers": {
      "age": {
        "columnId": "REPLACE_WITH_AGE_COLUMN_ID",
        "values": { "REPLACE_WITH_EXACT_YES": "18_plus", "REPLACE_WITH_EXACT_NO": "under_18" }
      },
      "vehicle": {
        "columnId": "REPLACE_WITH_VEHICLE_COLUMN_ID",
        "values": { "REPLACE_WITH_EXACT_YES": "yes", "REPLACE_WITH_EXACT_NO": "no" }
      },
      "employment": {
        "columnId": "REPLACE_WITH_EMPLOYMENT_COLUMN_ID",
        "values": {
          "REPLACE_WITH_EMPLOYED": "employed",
          "REPLACE_WITH_SELF_EMPLOYED": "self_employed",
          "REPLACE_WITH_UNEMPLOYED": "unemployed"
        }
      },
      "income": {
        "columnId": "REPLACE_WITH_INCOME_COLUMN_ID",
        "values": { "REPLACE_WITH_EXACT_YES": "10000_plus", "REPLACE_WITH_EXACT_NO": "under_10000" }
      },
      "contactConsent": {
        "columnId": "REPLACE_WITH_CONTACT_CONSENT_COLUMN_ID",
        "values": { "REPLACE_WITH_EXACT_YES": true, "REPLACE_WITH_EXACT_NO": false }
      },
      "marketingConsent": {
        "columnId": "REPLACE_WITH_MARKETING_CONSENT_COLUMN_ID",
        "values": { "REPLACE_WITH_EXACT_YES": true, "REPLACE_WITH_EXACT_NO": false }
      }
    },
    "consentText": "",
    "consentVersion": ""
  }
}

````

### File: config/social-form-mappings.example.json

SHA-256: `6d8ca3902bf01e257a561cfeeb77c2c78c5eeaad8e282cf566a01719484b92b3`

````json
{
  "YOUR_FORM_ID": {
    "fields": {
      "firstname": "first_name",
      "lastname": "last_name",
      "email": "email",
      "phone": "phone_number"
    },
    "answers": {
      "age": { "columnId": "age", "values": { "18 or older": "18_plus", "Under 18": "under_18" } },
      "vehicle": { "columnId": "vehicle", "values": { "Yes": "yes", "No": "no" } },
      "employment": {
        "columnId": "employment",
        "values": {
          "Employed": "employed",
          "Self employed": "self_employed",
          "Unemployed": "unemployed"
        }
      },
      "income": {
        "columnId": "income",
        "values": { "R10000 or more": "10000_plus", "Below R10000": "under_10000" }
      },
      "contactConsent": {
        "columnId": "contact_permission",
        "values": { "Yes": true, "No": false }
      },
      "marketingConsent": {
        "columnId": "marketing_permission",
        "values": { "Yes": true, "No": false }
      }
    },
    "consentText": "REPLACE with the exact contact permission displayed in this form",
    "consentVersion": "REPLACE with your form consent version"
  }
}

````

### File: eslint.config.mjs

SHA-256: `e0668fcdf419b86c39b3956226325d34830ee3672ab34e8ce7de0c69cd7666b9`

````javascript
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    '.open-next/**',
    '.wrangler/**',
    'cloudflare-env.d.ts',
    'artifacts/**',
    'next-env.d.ts',
    'playwright-report/**',
    'test-results/**',
  ]),
]);

````

### File: lib/analytics.ts

SHA-256: `da9714d7fd9d802d3c7d0abcc7b10d1f1df2383272e3e0c24f0c712610b0f438`

````typescript
export type AnalyticsEvent =
  | 'landing_page_view'
  | 'form_started'
  | 'qualification_failed'
  | 'form_validation_failed'
  | 'lead_submit_started'
  | 'lead_submit_success'
  | 'lead_submit_rejected'
  | 'lead_submit_error';
export type AnalyticsProperties = { reasons?: string[]; fields?: string[]; state?: string };
type Adapter = (event: AnalyticsEvent, properties: AnalyticsProperties) => void;
let adapter: Adapter | undefined;
export function configureAnalytics(next: Adapter) {
  adapter = next;
}
export function track(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  // Intentionally no PII, attribution identifiers, network request or provider by default.
  try {
    adapter?.(event, properties);
  } catch {
    /* Analytics must never interrupt a lead. */
  }
}

````

### File: lib/attribution.ts

SHA-256: `0dbe51a578a32a0bcbebf4d933e64c62a0ee7d33c391148707a91d29304365ef`

````typescript
import { cleanText } from './validation';
export const attributionKeys = [
  'affiliate_id',
  'offer_id',
  'transaction_id',
  'aff_sub',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'msclkid',
  'ms_campaign_id',
  'ms_adgroup_id',
  'ms_ad_id',
] as const;
export type Attribution = Partial<Record<(typeof attributionKeys)[number], string>>;
const microsoftKeys = ['msclkid', 'ms_campaign_id', 'ms_adgroup_id', 'ms_ad_id'] as const;
function attributionValue(key: (typeof attributionKeys)[number], value: unknown) {
  if (typeof value !== 'string') return '';
  // Reject rather than truncate identifiers or accept unresolved ad URL macros.
  const trimmed = value.trim();
  if (key === 'msclkid')
    return /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(trimmed)
      ? trimmed
      : '';
  if (key.startsWith('ms_')) return /^\d{1,20}$/.test(trimmed) ? trimmed : '';
  return cleanText(value, 200);
}
export function sanitizeAttribution(raw: unknown): Attribution {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(
    attributionKeys
      .map((key) => [key, attributionValue(key, (raw as Record<string, unknown>)[key])])
      .filter(([, value]) => value),
  );
}
export function captureAttribution(search: string, previous: Attribution = {}): Attribution {
  const params = new URLSearchParams(search);
  const incoming = sanitizeAttribution(Object.fromEntries(params));
  if (!incoming.affiliate_id && params.has('aff_id'))
    incoming.affiliate_id = cleanText(params.get('aff_id'), 200);
  const retained = sanitizeAttribution(previous);
  // Keep attribution across ordinary navigation, but never attach a previous
  // Microsoft click/campaign to a new paid click or a different campaign.
  const newTouch = [
    'utm_source',
    'utm_campaign',
    'gclid',
    'gbraid',
    'wbraid',
    'fbclid',
    ...microsoftKeys,
  ].some((key) => params.has(key));
  if (newTouch) {
    for (const key of [
      ...microsoftKeys,
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
    ] as const)
      delete retained[key];
  }
  return { ...retained, ...incoming };
}
let memory: Attribution = {};
export function sessionAttribution(search?: string): Attribution {
  if (typeof window === 'undefined') return {};
  try {
    memory = sanitizeAttribution(
      JSON.parse(sessionStorage.getItem('cartrack-attribution') || '{}'),
    );
  } catch {
    /* Storage may be disabled. */
  }
  memory = captureAttribution(search ?? window.location.search, memory);
  try {
    sessionStorage.setItem('cartrack-attribution', JSON.stringify(memory));
  } catch {
    /* Memory fallback. */
  }
  return memory;
}

````

### File: lib/browserState.ts

SHA-256: `17b801a85e4499b20051d37ff24902c38f0c7404a1f15a7a00f987c5ebd79c0f`

````typescript
import type { Attribution } from './attribution';
const WINDOW = 10 * 60 * 1000;
const TTL = 30 * 60 * 1000;
const KEY = 'cartrack-temporary-state';
type Receipt = {
  state: 'success' | 'duplicate';
  message: string;
  createdAt: number;
  attribution: Attribution;
};
type State = { attempts: number[]; receipts: Record<string, Receipt> };
let memory: State = { attempts: [], receipts: {} };
function read(now: number): State {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (
      parsed &&
      Array.isArray(parsed.attempts) &&
      parsed.receipts &&
      typeof parsed.receipts === 'object'
    )
      memory = parsed;
  } catch {
    /* Disabled or corrupt storage uses the memory fallback. */
  }
  memory.attempts = memory.attempts.filter(
    (t) => typeof t === 'number' && t <= now && t > now - WINDOW,
  );
  memory.receipts = Object.fromEntries(
    Object.entries(memory.receipts).filter(
      ([, r]) =>
        r &&
        (r.state === 'success' || r.state === 'duplicate') &&
        typeof r.message === 'string' &&
        r.createdAt <= now &&
        r.createdAt > now - TTL,
    ),
  );
  return memory;
}
function save() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* In-memory fallback. */
  }
}
export function browserAttempt(now = Date.now()) {
  const state = read(now);
  if (state.attempts.length >= 5)
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((state.attempts[0] + WINDOW - now) / 1000)),
    };
  state.attempts.push(now);
  save();
  return { allowed: true, retryAfter: 0 };
}
export function browserReceipt(id: string, now = Date.now()) {
  const value = read(now).receipts[id];
  save();
  return value;
}
export function saveBrowserReceipt(
  id: string,
  result: Pick<Receipt, 'state' | 'message'>,
  attribution: Attribution,
  now = Date.now(),
) {
  const state = read(now);
  state.receipts[id] = { ...result, createdAt: now, attribution };
  // Bound storage even if a session remains open for a long time.
  state.receipts = Object.fromEntries(Object.entries(state.receipts).slice(-20));
  save();
}

````

### File: lib/config.ts

SHA-256: `ab5dbd633c792de0f0ea982a8a42ef8b1635accfe5b4af678a43b11913aa4462`

````typescript
import { ConfigurationError } from './diagnostics';
export const OFFER_ID = '3046';
export const CONSENT_VERSION = '2026-09-15-v4';
// Public operator details supplied by the campaign owner, not API credentials.
export function campaignIdentity() {
  return {
    name: process.env.CAMPAIGN_OPERATOR_NAME?.trim() || 'SHYINC',
    email: process.env.PRIVACY_CONTACT_EMAIL?.trim() || 'admin@shyinc.com',
  };
}
export function siteUrl() {
  const value =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV !== 'production'
      ? 'http://localhost:3000'
      : 'https://unconfigured.invalid');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigurationError('CONFIG_SITE_URL_INVALID');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new ConfigurationError('CONFIG_SITE_URL_INVALID');
  return url.origin;
}
export function allowedOrigins() {
  const site = siteUrl();
  const origin = new URL(site);
  const hosts = new Set([site]);
  const apex = origin.hostname.startsWith('www.') ? origin.hostname.slice(4) : origin.hostname;
  const www = apex === origin.hostname ? `www.${origin.hostname}` : origin.hostname;
  hosts.add(`https://${apex}`);
  hosts.add(`https://${www}`);
  return [...hosts];
}
export function submissionConfig() {
  const site = siteUrl();
  const allowedOriginsList = allowedOrigins();
  const identity = campaignIdentity();
  if (
    process.env.NODE_ENV === 'production' &&
    (!site.startsWith('https://') ||
      /localhost|127\.0\.0\.1|your-domain\.co\.za|unconfigured\.invalid/.test(site))
  )
    throw new ConfigurationError('CONFIG_SITE_URL_REQUIRED');
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.LEADBYTE_ENABLED === 'true' &&
    !identity.name
  )
    throw new ConfigurationError('CONFIG_OPERATOR_NAME_REQUIRED');
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.LEADBYTE_ENABLED === 'true' &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email)
  )
    throw new ConfigurationError('CONFIG_PRIVACY_EMAIL_REQUIRED');
  if (process.env.LEADBYTE_OFFER_ID && process.env.LEADBYTE_OFFER_ID !== OFFER_ID)
    throw new ConfigurationError('CONFIG_OFFER_MISMATCH');
  let endpoint: URL;
  try {
    endpoint = new URL(
      process.env.LEADBYTE_ENDPOINT || 'https://returnxdigital.leadbyte.co.uk/api/submit.php',
    );
  } catch {
    throw new ConfigurationError('CONFIG_ENDPOINT_INVALID');
  }
  if (
    endpoint.protocol !== 'https:' ||
    endpoint.hostname !== 'returnxdigital.leadbyte.co.uk' ||
    endpoint.pathname !== '/api/submit.php'
  )
    throw new ConfigurationError('CONFIG_ENDPOINT_INVALID');
  if (
    (process.env.LEADBYTE_CAMPID || 'DASHCAMS') !== 'DASHCAMS' ||
    (process.env.LEADBYTE_SID || '27144') !== '27144'
  )
    throw new ConfigurationError('CONFIG_CAMPAIGN_MISMATCH');
  endpoint.search = new URLSearchParams({
    campid: 'DASHCAMS',
    sid: '27144',
    returnjson: 'yes',
  }).toString();
  return { endpoint, site, allowedOriginsList };
}

````

### File: lib/database.ts

SHA-256: `88d56b965346c8286ea68066dc17042ceecf74f7bd18142761f05ef375114791`

````typescript
import type { D1Database } from '@cloudflare/workers-types';
import { ConfigurationError } from './diagnostics';

export async function database(): Promise<D1Database> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as unknown as { DB?: D1Database }).DB;
    if (!db) throw new Error('Missing DB binding');
    return db;
  } catch {
    throw new ConfigurationError('DATABASE_UNAVAILABLE');
  }
}

export async function checkDatabase() {
  const db = await database();
  // Check both migrations and binding connectivity without exposing stored data.
  await db.batch([
    db.prepare(
      'SELECT request_id, delivery_status, leadbyte_code, email FROM lead_reporting LIMIT 0',
    ),
    db.prepare('SELECT bucket_key FROM rate_limits LIMIT 0'),
    db.prepare('SELECT source, processing_status FROM submissions LIMIT 0'),
    db.prepare('SELECT lead_id FROM lead_outbox LIMIT 0'),
    db.prepare('SELECT id FROM webhook_events LIMIT 0'),
  ]);
}

````

### File: lib/databaseMaintenance.ts

SHA-256: `0a25734141309d9b972e9cd94c58a0b9ada5963c2ff335fad8ab2ab57e9a4a3d`

````typescript
import type { D1Database } from '@cloudflare/workers-types';

export async function cleanupDatabase(db: D1Database, now = Date.now()) {
  await db.batch([db.prepare('DELETE FROM rate_limits WHERE expires_at <= ?').bind(now)]);
}

````

### File: lib/diagnostics.ts

SHA-256: `4e07f504d3d4a3be496192f1c7eb7c2684ad8ca63b65fc9f1ed2cd4b6288417c`

````typescript
export class ConfigurationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'ConfigurationError';
  }
}
export type Diagnostics = {
  code: string;
  requestId?: string;
  leadByteCode?: number;
  upstreamStatus?: number;
};
// Only allowlisted scalars go to the console, never the response body or contact fields.
export function reportDiagnostic(raw: unknown, httpStatus?: number) {
  const d = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const safe: Record<string, string | number> = {
    code:
      typeof d.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(d.code)
        ? d.code
        : 'API_UNEXPECTED_RESPONSE',
  };
  if (typeof d.requestId === 'string' && /^[a-f0-9-]{36}$/i.test(d.requestId))
    safe.requestId = d.requestId;
  if (typeof d.leadByteCode === 'number' && Number.isInteger(d.leadByteCode))
    safe.leadByteCode = d.leadByteCode;
  if (typeof d.upstreamStatus === 'number') safe.upstreamStatus = d.upstreamStatus;
  if (httpStatus !== undefined) safe.httpStatus = httpStatus;
  console.info('[CarTrack lead diagnostic]', safe);
}

````

### File: lib/googleLeadMapper.ts

SHA-256: `741e74e4beab35d3cc105d128df7fb211e0a612add703ecd7572289b92e51815`

````typescript
import type { LeadRequest } from './leadModel';

type AnswerMapping = { columnId: string; values: Record<string, string | boolean> };
export type GoogleFormMapping = {
  fields?: Partial<Record<'firstname' | 'lastname' | 'email' | 'phone', string>>;
  answers?: Partial<
    Record<
      'age' | 'vehicle' | 'employment' | 'income' | 'contactConsent' | 'marketingConsent',
      AnswerMapping
    >
  >;
  consentText?: string;
  consentVersion?: string;
};
export type GoogleMappings = Record<string, GoogleFormMapping>;
export class InvalidGooglePayload extends Error {}

function identifier(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0 && value.length <= 256) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  if (value !== undefined) throw new InvalidGooglePayload('INVALID_IDENTIFIER');
}

export function googleLeadMapper(
  raw: Record<string, unknown>,
  mappings: GoogleMappings = {},
  now = new Date(),
): LeadRequest {
  const externalLeadId = identifier(raw.lead_id);
  if (!externalLeadId || !Array.isArray(raw.user_column_data) || raw.user_column_data.length > 100)
    throw new InvalidGooglePayload('INVALID_LEAD');
  if (raw.is_test !== undefined && typeof raw.is_test !== 'boolean')
    throw new InvalidGooglePayload('INVALID_TEST_FLAG');
  const columns = new Map<string, string>();
  for (const entry of raw.user_column_data) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof entry.column_id !== 'string' ||
      typeof entry.string_value !== 'string' ||
      entry.string_value.length > 4000 ||
      columns.has(entry.column_id)
    )
      throw new InvalidGooglePayload('INVALID_FIELDS');
    columns.set(entry.column_id, entry.string_value);
  }
  const formId = identifier(raw.form_id);
  const mapping = formId && Object.hasOwn(mappings, formId) ? mappings[formId] : {};
  const field = (key: keyof NonNullable<GoogleFormMapping['fields']>, fallback: string) =>
    columns.get(mapping.fields?.[key] || fallback);
  const answer = (key: keyof NonNullable<GoogleFormMapping['answers']>) => {
    const config = mapping.answers?.[key];
    const value = config ? columns.get(config.columnId)?.trim() : undefined;
    return config && value !== undefined && Object.hasOwn(config.values, value)
      ? config.values[value]
      : undefined;
  };
  let firstname = field('firstname', 'FIRST_NAME');
  let lastname = field('lastname', 'LAST_NAME');
  const fullName = columns.get('FULL_NAME')?.trim();
  // Preserve the entire remaining surname; a mononym stays incomplete for review.
  if (!firstname && !lastname && fullName) {
    const boundary = fullName.search(/\s/);
    firstname = boundary < 0 ? fullName : fullName.slice(0, boundary);
    lastname = boundary < 0 ? undefined : fullName.slice(boundary).trim();
  }
  const submittedAt =
    typeof raw.lead_submit_time === 'string' &&
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw.lead_submit_time) &&
    Number.isFinite(Date.parse(raw.lead_submit_time))
      ? new Date(raw.lead_submit_time).toISOString()
      : undefined;
  const contact = answer('contactConsent');
  const marketing = answer('marketingConsent');
  const qualification: NonNullable<LeadRequest['qualification']> = {};
  for (const key of ['age', 'vehicle', 'employment', 'income'] as const) {
    const value = answer(key);
    if (typeof value === 'string') qualification[key] = value;
  }
  return {
    source: 'GOOGLE_ADS',
    externalLeadId,
    firstname,
    lastname,
    email: field('email', 'EMAIL'),
    phone: field('phone', 'PHONE_NUMBER'),
    campaignId: identifier(raw.campaign_id),
    formId,
    adGroupId: identifier(raw.adgroup_id),
    adId: identifier(raw.creative_id),
    contactConsent: typeof contact === 'boolean' ? contact : null,
    marketingConsent: typeof marketing === 'boolean' ? marketing : null,
    consentText: mapping.consentText,
    consentVersion: mapping.consentVersion,
    consentTimestamp:
      typeof contact === 'boolean' || typeof marketing === 'boolean' ? submittedAt : undefined,
    consentSource: 'GOOGLE_ADS',
    submittedAt,
    receivedAt: now.toISOString(),
    qualification,
    isTest: raw.is_test === true,
    metadata: {
      fullName,
      gclId: raw.gcl_id,
      assetGroupId: identifier(raw.asset_group_id),
      leadStage: raw.lead_stage,
      leadSource: raw.lead_source,
    },
  };
}

````

### File: lib/googleWebhook.ts

SHA-256: `154f048668cad8dca69146be9a9531dd4d42055d1e296bd33316f91976acb21e`

````typescript
import { readJsonBody, sanitizePayload } from './webhookPayload';
export { readJsonBody } from './webhookPayload';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { googleLeadMapper, InvalidGooglePayload, type GoogleMappings } from './googleLeadMapper';
import { ingestLead } from './leadService';
import type { LeadBindings } from './leadBindings';
import { siteUrl } from './config';
import { log } from './logger';

export async function googleWebhook(request: Request, env: LeadBindings) {
  const id = randomUUID();
  const reply = (status: number) =>
    Response.json(
      status === 200 ? {} : { message: status >= 500 ? 'Service unavailable' : 'Invalid request' },
      { status, headers: { 'Cache-Control': 'no-store', 'X-Request-ID': id } },
    );
  const url = new URL(request.url);
  if (
    url.protocol !== 'https:' &&
    !(
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      process.env.DEPLOY_ENV === 'development'
    )
  )
    return reply(403);
  if (!env.GOOGLE_ADS_WEBHOOK_KEY || env.GOOGLE_ADS_WEBHOOK_KEY.length < 32) return reply(503);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    return reply(400);
  let raw: Record<string, unknown>;
  try {
    raw = await readJsonBody(request);
  } catch {
    log('WEBHOOK_REJECTED', { id, diagnosticCode: 'INVALID_JSON' });
    return reply(400);
  }
  const hash = (value: string) => createHash('sha256').update(value).digest();
  if (
    typeof raw.google_key !== 'string' ||
    !timingSafeEqual(hash(raw.google_key), hash(env.GOOGLE_ADS_WEBHOOK_KEY))
  ) {
    log('WEBHOOK_REJECTED', { id, diagnosticCode: 'AUTHENTICATION_FAILED' });
    return reply(403);
  }
  try {
    const payload = JSON.stringify(sanitizePayload(raw, env.GOOGLE_ADS_WEBHOOK_KEY));
    await env.DB.prepare(
      `INSERT INTO webhook_events (id,provider,event_type,received_at,processing_status,payload_json)
      VALUES (?,'GOOGLE_ADS','LEAD',?,'RECEIVED',?)`,
    )
      .bind(id, Date.now(), payload)
      .run();
    log('WEBHOOK_RECEIVED', { id });
    let mappings: GoogleMappings;
    try {
      mappings = JSON.parse(env.GOOGLE_ADS_FORM_MAPPINGS || '{}');
      if (!mappings || typeof mappings !== 'object' || Array.isArray(mappings)) throw new Error();
    } catch {
      throw new Error('MAPPING_CONFIGURATION_INVALID');
    }
    try {
      const lead = googleLeadMapper(raw, mappings);
      await ingestLead(env, lead, siteUrl(), { id, payload });
    } catch (error) {
      await env.DB.prepare(
        "UPDATE webhook_events SET processing_status='FAILED', error_message=?, processed_at=? WHERE id=?",
      )
        .bind(
          error instanceof InvalidGooglePayload ? 'INVALID_PAYLOAD' : 'INGESTION_FAILED',
          Date.now(),
          id,
        )
        .run();
      if (error instanceof InvalidGooglePayload) return reply(400);
      throw error;
    }
    return reply(200);
  } catch {
    try {
      await env.DB.prepare(
        "UPDATE webhook_events SET processing_status='FAILED',error_message='INGESTION_FAILED',processed_at=? WHERE id=? AND processing_status='RECEIVED'",
      )
        .bind(Date.now(), id)
        .run();
    } catch {
      /* A database outage must not leak details into the response. */
    }
    log('WEBHOOK_REJECTED', { id, diagnosticCode: 'INGESTION_FAILED' });
    return reply(503);
  }
}

````

### File: lib/hosting.ts

SHA-256: `05f2c7b5ed9b616d10841dc4e50e3a87f8739563a91786224bedd6155c9eb0f9`

````typescript
export function isIndexable() {
  if (process.env.SITE_INDEXABLE !== 'true') return false;
  if (process.env.DEPLOY_PLATFORM === 'cloudflare') return process.env.DEPLOY_ENV === 'production';
  // Netlify's build context takes precedence, including Deploy Previews.
  if (process.env.CONTEXT) return process.env.CONTEXT === 'production';
  return process.env.VERCEL_ENV === 'production';
}

export function clientAddress(request: Request) {
  if (process.env.DEPLOY_PLATFORM === 'cloudflare') {
    return request.headers.get('cf-connecting-ip')?.trim() || 'unknown';
  }
  if (process.env.DEPLOY_PLATFORM === 'netlify') {
    return request.headers.get('x-nf-client-connection-ip')?.trim() || 'unknown';
  }
  if (process.env.VERCEL === '1') {
    return request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  }
  return 'local-shared';
}

````

### File: lib/leadBindings.ts

SHA-256: `aa3a6b7897ce29fccb6e6b3d2a7c8e6193dffea7fa79c6ce4ea71abf55879747`

````typescript
import type { D1Database, Queue } from '@cloudflare/workers-types';
export type LeadJob = { leadId: string };
export type LeadBindings = {
  DB: D1Database;
  LEAD_QUEUE: Queue<LeadJob>;
  GOOGLE_ADS_WEBHOOK_KEY?: string;
  MICROSOFT_ADS_WEBHOOK_TOKEN?: string;
  GOOGLE_ADS_FORM_MAPPINGS?: string;
  META_APP_SECRET?: string;
  META_VERIFY_TOKEN?: string;
  META_PAGE_ID?: string;
  META_PAGE_ACCESS_TOKEN?: string;
  META_GRAPH_VERSION?: string;
  META_FORM_MAPPINGS?: string;
  TIKTOK_APP_SECRET?: string;
  TIKTOK_ADVERTISER_ID?: string;
  TIKTOK_FORM_MAPPINGS?: string;
  SOCIAL_LEADS_TEST_MODE?: string;
};
export async function leadBindings(): Promise<LeadBindings> {
  const { getCloudflareContext } = await import('@opennextjs/cloudflare');
  const { env } = await getCloudflareContext({ async: true });
  const bindings = env as unknown as LeadBindings;
  if (!bindings.DB || !bindings.LEAD_QUEUE) throw new Error('PIPELINE_UNAVAILABLE');
  return bindings;
}

````

### File: lib/leadConsumer.ts

SHA-256: `7252a0055b3a04054ac14e992550bd22057f62027d61e4f3b0ae85ba4705d3de`

````typescript
import { randomUUID } from 'node:crypto';
import type { MessageBatch } from '@cloudflare/workers-types';
import type { LeadBindings, LeadJob } from './leadBindings';
import { submitLead, type LeadResult } from './leadbyte';
import { log } from './logger';
import { markStaleAttempts } from './leadService';
import type { LeadInput } from './validation';

type StoredLead = {
  submission_key: string;
  firstname: string;
  lastname: string;
  phone1: string;
  email?: string;
  qualification_json: string;
  preferredtimeofcall: string | null;
  created_at: number;
  submitted_at: string | null;
  processing_status: string;
  retry_count: number;
  lease_until: number | null;
  acceptterms: string | null;
  is_test: number;
};
const terminal = new Set([
  'accepted',
  'duplicate',
  'rejected',
  'pending_review',
  'test',
  'uncertain',
  'not_sent_disabled',
  'legacy',
  'dead_letter',
]);
export async function consumeLeads(
  batch: MessageBatch<LeadJob>,
  env: LeadBindings,
  send = submitLead,
) {
  for (const message of batch.messages) {
    const leadId =
      message.body &&
      typeof message.body.leadId === 'string' &&
      /^[a-f0-9]{64}$/.test(message.body.leadId)
        ? message.body.leadId
        : null;
    try {
      if (batch.queue === 'bestcardash-leads-dlq') {
        await env.DB.batch([
          env.DB.prepare(
            'INSERT INTO lead_dead_letters(message_id,lead_id,received_at,reason) VALUES (?,?,?,?) ON CONFLICT DO NOTHING',
          ).bind(
            message.id,
            leadId,
            Date.now(),
            leadId ? 'RETRIES_EXHAUSTED' : 'INVALID_QUEUE_MESSAGE',
          ),
          env.DB.prepare(
            `UPDATE submissions SET processing_status='dead_letter', delivery_status='failed', updated_at=?,
            diagnostic_code='RETRIES_EXHAUSTED' WHERE submission_key=? AND processing_status IN ('pending','queued','retry','failed')`,
          ).bind(Date.now(), leadId),
          env.DB.prepare(
            `UPDATE webhook_events SET processing_status='FAILED', error_message='RETRIES_EXHAUSTED', processed_at=?
            WHERE lead_id=? AND processing_status NOT IN ('DUPLICATE','PROCESSED')
            AND EXISTS (SELECT 1 FROM submissions WHERE submission_key=lead_id AND processing_status='dead_letter')`,
          ).bind(Date.now(), leadId),
        ]);
        log('AFFILIATE_SUBMISSION_FAILED', {
          id: leadId || message.id,
          diagnosticCode: 'DEAD_LETTER_RECORDED',
        });
        message.ack();
        continue;
      }
      if (!leadId) {
        message.retry();
        continue;
      }
      let row = await env.DB.prepare('SELECT * FROM submissions WHERE submission_key=?')
        .bind(leadId)
        .first<StoredLead>();
      if (!row) {
        message.retry();
        continue;
      }
      if (row.processing_status === 'processing' && (row.lease_until || 0) < Date.now()) {
        await markStaleAttempts(env.DB);
        message.ack();
        continue;
      }
      if (terminal.has(row.processing_status)) {
        message.ack();
        continue;
      }
      if (row.processing_status === 'processing') {
        message.retry({ delaySeconds: 120 });
        continue;
      }
      if (row.retry_count >= 6 || row.processing_status === 'failed') {
        message.retry();
        continue;
      }
      if (process.env.LEADBYTE_ENABLED !== 'true') {
        message.retry({ delaySeconds: 300 });
        continue;
      }
      // Defence in depth: test/non-consenting records must never reach the affiliate.
      if (row.is_test || row.acceptterms !== 'true') {
        message.ack();
        continue;
      }
      const attemptId = randomUUID();
      row = await env.DB.prepare(
        `UPDATE submissions SET processing_status='processing', attempt_id=?, lease_until=?,
        retry_count=retry_count+1, updated_at=? WHERE submission_key=? AND processing_status IN ('pending','queued','retry')
        AND retry_count < 6 RETURNING *`,
      )
        .bind(attemptId, Date.now() + 120000, Date.now(), leadId)
        .first<StoredLead>();
      if (!row) {
        message.retry({ delaySeconds: 120 });
        continue;
      }
      await env.DB.prepare(
        "INSERT INTO lead_attempts(id,lead_id,started_at,outcome) VALUES (?,?,?,'started')",
      )
        .bind(attemptId, leadId, Date.now())
        .run();
      const call = row.preferredtimeofcall?.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2})/);
      const input: LeadInput = {
        ...JSON.parse(row.qualification_json),
        firstname: row.firstname,
        lastname: row.lastname,
        phone: row.phone1,
        ...(row.email ? { email: row.email } : {}),
        terms: true,
        website: '',
        preferredtimeofcall: call ? `${call[3]}-${call[2]}-${call[1]}T${call[4]}` : '',
      };
      log('AFFILIATE_SUBMISSION_STARTED', { id: leadId });
      let result: LeadResult;
      try {
        result = await send(input, new Date(row.submitted_at || row.created_at));
      } catch {
        // Unknown exceptions may occur after a send: never blindly take over a claimed attempt.
        result = {
          state: 'temporary_error',
          message: 'Delivery requires review',
          uncertain: true,
          diagnosticCode: 'DELIVERY_UNCERTAIN',
        };
      }
      // Network/timeouts are retried as requested. Without vendor idempotency, a lost
      // response can still mean upstream acceptance; see LEAD-PIPELINE.md.
      const retry =
        result.state === 'temporary_error' &&
        (!result.uncertain ||
          ['LEADBYTE_TIMEOUT', 'LEADBYTE_NETWORK_ERROR'].includes(result.diagnosticCode || ''));
      const outcome =
        result.state === 'success'
          ? 'accepted'
          : result.state === 'duplicate'
            ? 'duplicate'
            : retry
              ? row.retry_count >= 6
                ? 'failed'
                : 'retry'
              : result.uncertain
                ? 'uncertain'
                : 'rejected';
      await env.DB.batch([
        env.DB.prepare(
          `UPDATE submissions SET processing_status=?, delivery_status=?, updated_at=?, completed_at=?, lease_until=NULL,
          leadbyte_code=?, leadbyte_lead_id=?, leadbyte_response=?, leadbyte_info_json=?, leadbyte_raw_response=?,
          leadbyte_timestamp=?, leadbyte_process_time=?, upstream_http_status=?, diagnostic_code=?, delivery_uncertain=?
          WHERE submission_key=? AND attempt_id=? AND processing_status IN ('processing','uncertain')`,
        ).bind(
          outcome,
          outcome === 'retry' ? 'pending' : outcome,
          Date.now(),
          retry ? null : Date.now(),
          result.code ?? null,
          result.leadId ?? null,
          result.response ?? null,
          result.info === undefined ? null : JSON.stringify(result.info),
          result.rawResponse ?? null,
          result.timestamp ?? null,
          result.processTime ?? null,
          result.upstreamStatus ?? null,
          result.diagnosticCode ?? null,
          Number(!!result.uncertain),
          leadId,
          attemptId,
        ),
        env.DB.prepare(
          'UPDATE lead_attempts SET completed_at=?,outcome=?,result_json=? WHERE id=?',
        ).bind(Date.now(), outcome, JSON.stringify(result), attemptId),
        env.DB.prepare(
          `UPDATE webhook_events SET processing_status=?, processed_at=?, error_message=?
          WHERE lead_id=? AND processing_status <> 'DUPLICATE'`,
        ).bind(
          retry ? 'QUEUED' : ['accepted', 'duplicate'].includes(outcome) ? 'PROCESSED' : 'FAILED',
          retry ? null : Date.now(),
          result.diagnosticCode || (outcome === 'rejected' ? 'AFFILIATE_REJECTED' : null),
          leadId,
        ),
      ]);
      log(
        retry
          ? 'AFFILIATE_SUBMISSION_RETRY'
          : outcome === 'accepted'
            ? 'AFFILIATE_SUBMISSION_SUCCESS'
            : outcome === 'uncertain'
              ? 'AFFILIATE_SUBMISSION_FAILED'
              : 'AFFILIATE_SUBMISSION_REJECTED',
        { id: leadId, code: result.code },
      );
      if (retry) message.retry({ delaySeconds: Math.min(3600, 60 * 2 ** (row.retry_count - 1)) });
      else message.ack();
    } catch {
      log('AFFILIATE_SUBMISSION_RETRY', {
        id: leadId || message.id,
        diagnosticCode: 'PROCESSING_OR_STORAGE_FAILED',
      });
      message.retry({ delaySeconds: 120 });
    }
  }
}

````

### File: lib/leadModel.ts

SHA-256: `94db49e64dfbc979973340d35696f3963381aa84427cfae83558b821470af6ce`

````typescript
import { validateLead, type LeadInput } from './validation';

export type LeadSource = 'WEBSITE' | 'GOOGLE_ADS' | 'MICROSOFT_ADS' | 'META_ADS' | 'TIKTOK_ADS';
export type LeadRequest = {
  source: LeadSource;
  externalLeadId: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  campaignId?: string;
  campaignName?: string;
  adGroupId?: string;
  adId?: string;
  formId?: string;
  contactConsent?: boolean | null;
  marketingConsent?: boolean | null;
  consentText?: string;
  consentVersion?: string;
  consentTimestamp?: string;
  consentSource?: string;
  submittedAt?: string;
  receivedAt: string;
  qualification?: Partial<Pick<LeadInput, 'age' | 'vehicle' | 'employment' | 'income'>>;
  preferredtimeofcall?: string;
  eligibilityConfirmed?: boolean;
  attribution?: unknown;
  metadata?: Record<string, unknown>;
  isTest?: boolean;
};

// Shared campaign rules; the provider parser never decides qualification.
export function assessLead(lead: LeadRequest) {
  const result = validateLead(
    {
      firstname: lead.firstname?.trim(),
      lastname: lead.lastname?.trim(),
      phone: lead.phone,
      ...(lead.email !== undefined ? { email: lead.email.trim() } : {}),
      ...lead.qualification,
      ...(lead.eligibilityConfirmed !== undefined
        ? { eligibilityConfirmed: lead.eligibilityConfirmed }
        : {}),
      terms: lead.contactConsent === true,
      preferredtimeofcall: lead.preferredtimeofcall || '',
    },
    new Date(lead.receivedAt),
  );
  return {
    ...result,
    status: lead.isTest
      ? 'test'
      : result.valid && (lead.source === 'WEBSITE' || (lead.consentText && lead.consentVersion))
        ? 'pending'
        : result.reasons.length || lead.contactConsent === false
          ? 'rejected'
          : 'pending_review',
  };
}

````

### File: lib/leadService.ts

SHA-256: `b5d1eb61568a944401b475bf2c601f89a3215ce51485162de9744e653f28d2d7`

````typescript
import { createHash, randomUUID } from 'node:crypto';
import type { D1Database } from '@cloudflare/workers-types';
import { buildPayload } from './leadbyte';
import { assessLead, type LeadRequest } from './leadModel';
import { digest, log } from './logger';
import { sanitizeAttribution } from './attribution';
import type { LeadBindings } from './leadBindings';

export class LeadConflict extends Error {}
export type WebhookReceipt = { id: string; payload: string };
export async function ingestLead(
  env: LeadBindings,
  lead: LeadRequest,
  site: string,
  event?: WebhookReceipt,
) {
  const assessed = assessLead(lead);
  const key =
    lead.source === 'WEBSITE'
      ? digest(`submission:${lead.externalLeadId}`)
      : createHash('sha256').update(`${lead.source}:${lead.externalLeadId}`).digest('hex');
  const fingerprint = digest(JSON.stringify(assessed.input));
  const now = Date.parse(lead.receivedAt);
  const status =
    assessed.status === 'pending' && process.env.LEADBYTE_ENABLED !== 'true'
      ? 'not_sent_disabled'
      : assessed.status;
  const payload = assessed.valid
    ? Object.fromEntries(
        buildPayload(assessed.input, site, new Date(lead.submittedAt || lead.receivedAt)),
      )
    : null;
  const row = {
    submission_key: key,
    fingerprint,
    created_at: now,
    expires_at: 0,
    consent_version: lead.consentVersion || '',
    record_version: 1,
    request_id: randomUUID(),
    firstname: assessed.input.firstname || lead.firstname?.trim() || null,
    lastname: assessed.input.lastname || lead.lastname?.trim() || null,
    phone1: assessed.input.phone || null,
    original_phone: lead.phone || null,
    email: assessed.input.email || null,
    optinurl: payload?.optinurl || null,
    optindate: payload?.optindate || null,
    acceptterms:
      lead.contactConsent === true ? 'true' : lead.contactConsent === false ? 'false' : null,
    offer_id: '3046',
    campaign_id: 'DASHCAMS',
    supplier_id: '27144',
    preferredtimeofcall: payload?.preferredtimeofcall || null,
    payload_json: payload ? JSON.stringify(payload) : null,
    qualification_json: JSON.stringify(lead.qualification || {}),
    attribution_json: JSON.stringify(sanitizeAttribution(lead.attribution)),
    delivery_status: status,
    processing_status: status,
    source: lead.source,
    external_lead_id: lead.externalLeadId,
    source_campaign_id: lead.campaignId || null,
    campaign_name: lead.campaignName || null,
    ad_group_id: lead.adGroupId || null,
    ad_id: lead.adId || null,
    form_id: lead.formId || null,
    marketing_consent:
      typeof lead.marketingConsent === 'boolean' ? Number(lead.marketingConsent) : null,
    consent_text: lead.consentText || null,
    consent_timestamp: lead.consentTimestamp || null,
    consent_source: lead.consentSource || lead.source,
    submitted_at: lead.submittedAt || null,
    metadata_json: JSON.stringify(lead.metadata || {}),
    updated_at: now,
    is_test: Number(!!lead.isTest),
    diagnostic_code: assessed.valid ? null : 'QUALIFICATION_OR_CONSENT_REQUIRED',
  };
  // Column names are application constants, values are always bound parameters.
  const statements = [
    env.DB.prepare(
      `INSERT INTO submissions (${Object.keys(row).join(',')})
    VALUES (${Object.keys(row)
      .map(() => '?')
      .join(',')}) ON CONFLICT DO NOTHING`,
    ).bind(...Object.values(row)),
    env.DB.prepare(
      `INSERT INTO lead_outbox (lead_id, created_at)
      SELECT submission_key, created_at FROM submissions WHERE submission_key = ? AND processing_status = 'pending'
      ON CONFLICT DO NOTHING`,
    ).bind(key),
  ];
  if (event)
    statements.push(
      env.DB.prepare(
        `UPDATE webhook_events SET lead_id = ?, external_lead_id = ?,
    processing_status = CASE WHEN (SELECT request_id FROM submissions WHERE submission_key = ?) = ?
      THEN 'RECEIVED' ELSE 'DUPLICATE' END WHERE id = ?`,
      ).bind(key, lead.externalLeadId, key, row.request_id, event.id),
    );
  await env.DB.batch(statements);
  const stored = await env.DB.prepare(
    'SELECT request_id, fingerprint, processing_status, result, http_status FROM submissions WHERE submission_key = ?',
  )
    .bind(key)
    .first<{
      request_id: string;
      fingerprint: string;
      processing_status: string;
      result: string | null;
      http_status: number | null;
    }>();
  if (!stored) throw new Error('LEAD_NOT_STORED');
  if (lead.source === 'WEBSITE' && stored.fingerprint !== fingerprint)
    throw new LeadConflict('SUBMISSION_CONFLICT');
  const duplicate = stored.request_id !== row.request_id;
  log(duplicate ? 'LEAD_DUPLICATE' : 'LEAD_CREATED', { id: key });
  // A durable outbox is committed already. A failed publish is recovered by cron.
  try {
    await publishLead(env, key);
  } catch {
    log('LEAD_QUEUE_DEFERRED', { id: key, diagnosticCode: 'OUTBOX_RECOVERY_PENDING' });
  }
  if (event && !duplicate) {
    await env.DB.prepare(
      `UPDATE webhook_events SET processing_status = ?, error_message = ?
      WHERE id = ? AND processing_status = 'RECEIVED'`,
    )
      .bind(
        ['pending_review', 'rejected', 'test', 'not_sent_disabled'].includes(status)
          ? status.toUpperCase()
          : 'RECEIVED',
        assessed.valid ? null : 'QUALIFICATION_OR_CONSENT_REQUIRED',
        event.id,
      )
      .run();
  }
  return {
    leadId: key,
    duplicate,
    status: stored.processing_status,
    legacyResult: stored.processing_status === 'legacy' ? stored : undefined,
  };
}

export async function publishLead(env: LeadBindings, leadId: string) {
  const pending = await env.DB.prepare(
    `SELECT o.lead_id FROM lead_outbox o JOIN submissions s ON s.submission_key=o.lead_id
    WHERE o.lead_id=? AND o.published_at IS NULL AND s.processing_status IN ('pending','queued')`,
  )
    .bind(leadId)
    .first();
  if (!pending) return;
  await env.DB.prepare('UPDATE lead_outbox SET publish_attempts=publish_attempts+1 WHERE lead_id=?')
    .bind(leadId)
    .run();
  await env.LEAD_QUEUE.send({ leadId });
  await env.DB.batch([
    env.DB.prepare('UPDATE lead_outbox SET published_at=? WHERE lead_id=?').bind(
      Date.now(),
      leadId,
    ),
    env.DB.prepare(
      "UPDATE submissions SET processing_status='queued', updated_at=? WHERE submission_key=? AND processing_status='pending'",
    ).bind(Date.now(), leadId),
    env.DB.prepare(
      "UPDATE webhook_events SET processing_status='QUEUED' WHERE lead_id=? AND processing_status='RECEIVED'",
    ).bind(leadId),
  ]);
  log('LEAD_QUEUED', { id: leadId });
}

export async function recoverOutbox(env: LeadBindings) {
  const { results } = await env.DB.prepare(
    `SELECT o.lead_id FROM lead_outbox o JOIN submissions s ON s.submission_key=o.lead_id
    WHERE o.published_at IS NULL AND s.processing_status IN ('pending','queued') ORDER BY o.created_at LIMIT 100`,
  ).all<{ lead_id: string }>();
  for (const row of results) {
    try {
      await publishLead(env, row.lead_id);
    } catch {
      log('LEAD_QUEUE_DEFERRED', { id: row.lead_id, diagnosticCode: 'OUTBOX_RECOVERY_PENDING' });
    }
  }
  await markStaleAttempts(env.DB);
}

export async function markStaleAttempts(db: D1Database) {
  await db.batch([
    db
      .prepare(
        `UPDATE lead_attempts SET outcome='uncertain', completed_at=? WHERE outcome='started'
      AND lead_id IN (SELECT submission_key FROM submissions WHERE processing_status='processing' AND lease_until < ?)`,
      )
      .bind(Date.now(), Date.now()),
    db
      .prepare(
        `UPDATE webhook_events SET processing_status='FAILED', error_message='DELIVERY_UNCERTAIN', processed_at=?
      WHERE processing_status NOT IN ('DUPLICATE','PROCESSED') AND lead_id IN
      (SELECT submission_key FROM submissions WHERE processing_status='processing' AND lease_until < ?)`,
      )
      .bind(Date.now(), Date.now()),
    db
      .prepare(
        `UPDATE submissions SET processing_status='uncertain', delivery_status='uncertain', delivery_uncertain=1,
      diagnostic_code='DELIVERY_UNCERTAIN', updated_at=? WHERE processing_status='processing' AND lease_until < ?`,
      )
      .bind(Date.now(), Date.now()),
  ]);
}

````

### File: lib/leadbyte.ts

SHA-256: `762c0d5089e6e06deb45f8111f0e93d948d413d52178ce961fc9f41de5f0466b`

````typescript
import { OFFER_ID, submissionConfig } from './config';
import { type LeadInput, parseCallTime } from './validation';
export type LeadResult = {
  state: 'success' | 'duplicate' | 'api_rejected' | 'temporary_error';
  message: string;
  duplicateFields?: Array<'phone' | 'email'>;
  code?: number;
  leadId?: string;
  response?: string;
  uncertain?: boolean;
  diagnosticCode?: string;
  upstreamStatus?: number;
  info?: unknown;
  rawResponse?: string;
  timestamp?: string;
  processTime?: number;
  fetchError?: string;
};
export function formatSaDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Johannesburg',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}
export function buildPayload(input: LeadInput, site: string, now: Date) {
  const payload = new URLSearchParams({
    firstname: input.firstname,
    lastname: input.lastname,
    phone1: input.phone,
    optinurl: `${site}/`,
    optindate: formatSaDate(now),
    acceptterms: 'true',
    offer_id: OFFER_ID,
  });
  if (input.preferredtimeofcall)
    payload.set('preferredtimeofcall', formatSaDate(parseCallTime(input.preferredtimeofcall)!));
  return payload;
}
const temporary = "We couldn't submit your request right now. Please try again shortly.";
function duplicateFields(info: unknown, response: string): Array<'phone' | 'email'> {
  const text = `${JSON.stringify(info ?? '')} ${response}`.toLowerCase();
  if (/\b(e-?mail|email_address)\b/.test(text)) return ['email'];
  return ['phone'];
}
export function parseLeadByte(raw: unknown): LeadResult {
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('code' in raw) ||
    typeof raw.code !== 'number' ||
    !Number.isInteger(raw.code) ||
    !('response' in raw) ||
    typeof raw.response !== 'string'
  )
    return {
      state: 'temporary_error',
      message: temporary,
      uncertain: true,
      diagnosticCode: 'LEADBYTE_MALFORMED_RESPONSE',
    };
  const data = raw as {
    code: number;
    response: string;
    leadId?: unknown;
    info?: unknown;
    timestamp?: unknown;
    processTime?: unknown;
  };
  const base = {
    code: data.code,
    response: data.response,
    info: data.info,
    leadId:
      typeof data.leadId === 'number' || typeof data.leadId === 'string'
        ? String(data.leadId).slice(0, 80)
        : undefined,
    timestamp: typeof data.timestamp === 'string' ? data.timestamp.slice(0, 80) : undefined,
    processTime:
      typeof data.processTime === 'number' && Number.isFinite(data.processTime)
        ? data.processTime
        : undefined,
  };
  if (data.code === 1)
    return {
      ...base,
      state: 'success',
      message:
        'Your request has been received. A CarTrack representative may contact you about your quote.',
    };
  if (data.code === -2)
    return {
      ...base,
      state: 'duplicate',
      duplicateFields: duplicateFields(data.info, data.response),
      message: 'It looks like your details have already been submitted recently.',
    };
  if ([-3, -100].includes(data.code))
    return { ...base, state: 'temporary_error', message: temporary };
  const messages: Record<number, string> = {
    [-9]: 'This offer is currently unavailable. Please try again later.',
    [-8]: 'Please check your mobile number and try again.',
    [-7]: 'This offer is currently unavailable. Please try again later.',
    [-6]: 'We’re unable to process your request for this offer.',
    [-5]: 'Please check your information and try again.',
    [-4]: 'We’re unable to take more requests right now. Please try again later.',
    [-19]: 'This offer is currently unavailable. Please try again later.',
    [-17]: 'We’re unable to contact you because of your contact preferences.',
    [-16]: 'We’re unable to contact you because of your contact preferences.',
    [-15]: 'We’re unable to contact you because of your contact preferences.',
    [-14]: 'This offer is available in South Africa only.',
    [-13]: 'Please use a South African mobile number rather than a landline.',
    [-12]: 'Please check your information and try again.',
    [-11]: 'We’re unable to process your request right now.',
    [-10]: 'Please check your information and try again.',
  };
  return {
    ...base,
    state: 'api_rejected',
    message: messages[data.code] || 'We’re unable to process your request for this offer.',
  };
}
export async function submitLead(
  input: LeadInput,
  now: Date,
  fetcher: typeof fetch = fetch,
): Promise<LeadResult> {
  const { endpoint, site } = submissionConfig();
  const configured = Number(process.env.LEADBYTE_TIMEOUT_MS || 10000);
  const timeout = Number.isFinite(configured) ? Math.min(20000, Math.max(10, configured)) : 10000;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: buildPayload(input, site, now),
          signal: controller.signal,
          cache: 'no-store',
          redirect: 'follow',
        });
        const text = await response.text();
        if (text.length > 64000)
          return {
            state: 'temporary_error',
            message: temporary,
            uncertain: true,
            diagnosticCode: 'LEADBYTE_RESPONSE_TOO_LARGE',
            upstreamStatus: response.status,
          } as LeadResult;
        if (!response.ok) {
          let parsed: Partial<LeadResult> = {};
          try {
            parsed = parseLeadByte(JSON.parse(text));
          } catch {
            /* Raw body retained privately. */
          }
          return {
            ...parsed,
            state:
              response.status === 429 || response.status >= 500
                ? 'temporary_error'
                : 'api_rejected',
            message: temporary,
            uncertain: parsed.code === 1 || parsed.code === -2,
            diagnosticCode: 'LEADBYTE_HTTP_ERROR',
            upstreamStatus: response.status,
            rawResponse: text,
          } as LeadResult;
        }
        try {
          return {
            ...parseLeadByte(JSON.parse(text)),
            rawResponse: text,
            upstreamStatus: response.status,
          };
        } catch {
          return {
            state: 'temporary_error',
            message: temporary,
            uncertain: true,
            diagnosticCode: 'LEADBYTE_MALFORMED_RESPONSE',
            rawResponse: text,
            upstreamStatus: response.status,
          } as LeadResult;
        }
      })(),
      new Promise<LeadResult>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve({
            state: 'temporary_error',
            message: "We couldn't confirm your request. Please wait before trying again.",
            uncertain: true,
            diagnosticCode: 'LEADBYTE_TIMEOUT',
          });
        }, timeout);
      }),
    ]);
  } catch (error) {
    return {
      state: 'temporary_error',
      message: temporary,
      uncertain: true,
      diagnosticCode: controller.signal.aborted ? 'LEADBYTE_TIMEOUT' : 'LEADBYTE_NETWORK_ERROR',
      fetchError: error instanceof Error ? error.name : 'UnknownError',
    };
  } finally {
    clearTimeout(timer);
  }
}

````

### File: lib/logger.ts

SHA-256: `8a250757bcdbd94611b47da6ec0ecb83e4d22a56df3abfdc47cc286634094ea0`

````typescript
import { createHmac, randomBytes } from 'node:crypto';
import { ConfigurationError } from './diagnostics';
// Worker module evaluation cannot generate randomness; test fallback is lazy.
let instanceSalt: Buffer | undefined;
export function digest(value: string) {
  const secret = process.env.LEAD_HASH_SECRET;
  if (process.env.NODE_ENV !== 'test' && (!secret || secret.length < 32))
    throw new ConfigurationError('CONFIG_HASH_SECRET_REQUIRED');
  return createHmac('sha256', secret || (instanceSalt ??= randomBytes(32)))
    .update(value)
    .digest('hex');
}
export function maskPhone(phone: string) {
  return phone ? `${phone.slice(0, 3)}******${phone.slice(-3)}` : '';
}
export function redactResponse(response: string | undefined, sensitive: string[] = []) {
  let result = (response || '').replace(/[\u0000-\u001f\u007f]/g, ' ');
  for (const value of sensitive.filter(Boolean).sort((a, b) => b.length - a.length))
    result = result.split(value).join('[redacted]');
  return result
    .replace(/(?:\+?\d[\s().-]*){7,}/g, '[redacted-number]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[redacted-email]')
    .slice(0, 500);
}
export function log(
  event: string,
  data: {
    id?: string;
    code?: number;
    response?: string;
    reasons?: string[];
    diagnosticCode?: string;
    upstreamStatus?: number;
    fetchError?: string;
  } = {},
) {
  console.info(JSON.stringify({ time: new Date().toISOString(), event, ...data }));
}

````

### File: lib/microsoftAds.ts

SHA-256: `b58a939ba877a866e94f6525fe36dc8f634a8f8cef1c149c53f305cc5279037a`

````typescript
import { sanitizeAttribution } from './attribution';
import type { LeadRequest } from './leadModel';

// Website acquisition metadata, not a claim of an authenticated Microsoft webhook.
// Keep source=WEBSITE and its submission-token idempotency unchanged.
export function microsoftWebsiteDetails(
  raw: unknown,
): Pick<LeadRequest, 'campaignId' | 'campaignName' | 'adGroupId' | 'adId' | 'metadata'> {
  const attribution = sanitizeAttribution(raw);
  const source = attribution.utm_source?.toLowerCase();
  const microsoftSource = !!source && ['bing', 'microsoft', 'microsoft_ads'].includes(source);
  const paid = ['cpc', 'ppc', 'paidsearch', 'paid_search'].includes(
    attribution.utm_medium?.toLowerCase() || '',
  );
  if ((source && !microsoftSource) || !(attribution.msclkid || (microsoftSource && paid)))
    return {};
  return {
    campaignId: attribution.ms_campaign_id,
    campaignName: attribution.utm_campaign,
    adGroupId: attribution.ms_adgroup_id,
    adId: attribution.ms_ad_id,
    metadata: {
      acquisitionSource: 'MICROSOFT_ADS',
      attributionEvidence: attribution.msclkid ? 'url_click_id' : 'url_utm',
    },
  };
}

````

### File: lib/microsoftLeadMapper.ts

SHA-256: `eb1a8cd8f6a16975bd57bb456387de79f46c8b6082882502fa6a765a1ea2dd1e`

````typescript
import type { LeadRequest } from './leadModel';
import { InvalidWebhookPayload } from './webhookPayload';

// This is BestCarDash's intermediary contract, not a native Microsoft schema.
export function microsoftLeadMapper(raw: Record<string, unknown>, now = new Date()): LeadRequest {
  const text = (key: string, limit = 256): string | undefined => {
    const value = raw[key];
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string' || value.length > limit || !value.trim())
      throw new InvalidWebhookPayload('INVALID_FIELD');
    return value.trim();
  };
  const flag = (key: string): boolean | null => {
    const value = raw[key];
    if (value === undefined || value === null) return null;
    if (typeof value !== 'boolean') throw new InvalidWebhookPayload('INVALID_BOOLEAN');
    return value;
  };
  const timestamp = (key: string) => {
    const value = text(key, 64);
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
        !Number.isFinite(Date.parse(value)))
    )
      throw new InvalidWebhookPayload('INVALID_TIMESTAMP');
    return value ? new Date(value).toISOString() : undefined;
  };
  if (raw.source !== undefined && raw.source !== 'microsoft_ads' && raw.source !== 'MICROSOFT_ADS')
    throw new InvalidWebhookPayload('INVALID_SOURCE');
  const externalLeadId = text('externalLeadId');
  const fullName = text('fullName', 400);
  let firstname = text('firstName', 200);
  let lastname = text('lastName', 200);
  if (!firstname && !lastname && fullName) {
    const boundary = fullName.search(/\s/);
    firstname = boundary < 0 ? fullName : fullName.slice(0, boundary);
    lastname = boundary < 0 ? undefined : fullName.slice(boundary).trim();
  }
  const email = text('email', 320);
  const phone = text('phone', 64);
  if (!externalLeadId || !firstname || (!email && !phone))
    throw new InvalidWebhookPayload('MISSING_REQUIRED_FIELDS');
  const qualification: NonNullable<LeadRequest['qualification']> = {};
  if (raw.qualification !== undefined) {
    if (
      !raw.qualification ||
      typeof raw.qualification !== 'object' ||
      Array.isArray(raw.qualification)
    )
      throw new InvalidWebhookPayload('INVALID_QUALIFICATION');
    for (const key of ['age', 'vehicle', 'employment', 'income'] as const) {
      const value = (raw.qualification as Record<string, unknown>)[key];
      if (value === undefined || value === null) continue;
      if (typeof value !== 'string' || value.length > 64)
        throw new InvalidWebhookPayload('INVALID_QUALIFICATION');
      qualification[key] = value.trim();
    }
  }
  return {
    source: 'MICROSOFT_ADS',
    externalLeadId,
    firstname,
    lastname,
    email,
    phone,
    campaignId: text('campaignId'),
    campaignName: text('campaignName'),
    adGroupId: text('adGroupId'),
    adId: text('adId'),
    formId: text('formId'),
    submittedAt: timestamp('submittedAt'),
    receivedAt: now.toISOString(),
    contactConsent: flag('contactConsent'),
    marketingConsent: flag('marketingConsent'),
    consentText: text('consentText', 8000),
    consentVersion: text('consentVersion'),
    consentTimestamp: timestamp('consentTimestamp'),
    consentSource: 'MICROSOFT_ADS',
    qualification,
    isTest: flag('isTest') === true,
    // Retain the exact original name, including whitespace, independently of derived names.
    metadata: { fullName: raw.fullName, deliveryMethod: 'intermediary' },
  };
}

````

### File: lib/microsoftWebhook.ts

SHA-256: `e666abe7acdb9ab73ce7e4f137c67cd59a1e4818be5ccb5468a8bd3ac2db35d6`

````typescript
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { LeadBindings } from './leadBindings';
import { microsoftLeadMapper } from './microsoftLeadMapper';
import { ingestLead } from './leadService';
import { InvalidWebhookPayload, readJsonBody, sanitizePayload } from './webhookPayload';
import { siteUrl } from './config';
import { log } from './logger';

export async function microsoftWebhook(request: Request, env: LeadBindings) {
  const id = randomUUID();
  const reply = (status: number, result?: Record<string, unknown>) =>
    Response.json(
      result || { message: status >= 500 ? 'Service unavailable' : 'Invalid request' },
      { status, headers: { 'Cache-Control': 'no-store', 'X-Request-ID': id } },
    );
  const reject = (status: number, diagnosticCode: string) => {
    log('WEBHOOK_REJECTED', { id, diagnosticCode });
    return reply(status);
  };
  const url = new URL(request.url);
  if (
    url.protocol !== 'https:' &&
    !(
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      process.env.DEPLOY_ENV === 'development'
    )
  )
    return reject(403, 'HTTPS_REQUIRED');
  const secret = env.MICROSOFT_ADS_WEBHOOK_TOKEN;
  if (!secret || secret.length < 32) return reject(503, 'AUTHENTICATION_UNCONFIGURED');
  const token = /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') || '')?.[1];
  const hash = (value: string) => createHash('sha256').update(value).digest();
  if (!token || !timingSafeEqual(hash(token), hash(secret)))
    return reject(401, 'AUTHENTICATION_FAILED');
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    return reject(400, 'INVALID_CONTENT_TYPE');
  let raw: Record<string, unknown>;
  try {
    raw = await readJsonBody(request);
  } catch {
    return reject(400, 'INVALID_JSON');
  }
  try {
    const payload = JSON.stringify(sanitizePayload(raw, secret));
    await env.DB.prepare(
      `INSERT INTO webhook_events (id,provider,event_type,received_at,processing_status,payload_json)
      VALUES (?,'MICROSOFT_ADS','LEAD',?,'RECEIVED',?)`,
    )
      .bind(id, Date.now(), payload)
      .run();
    log('WEBHOOK_RECEIVED', { id });
    const result = await ingestLead(env, microsoftLeadMapper(raw), siteUrl(), { id, payload });
    return reply(200, {
      leadId: result.leadId,
      duplicate: result.duplicate,
      status: result.status,
    });
  } catch (error) {
    const invalid = error instanceof InvalidWebhookPayload;
    try {
      await env.DB.prepare(
        "UPDATE webhook_events SET processing_status='FAILED',error_message=?,processed_at=? WHERE id=? AND processing_status='RECEIVED'",
      )
        .bind(invalid ? 'INVALID_PAYLOAD' : 'INGESTION_FAILED', Date.now(), id)
        .run();
    } catch {
      /* Database outage: return a retryable response without exposing details. */
    }
    return reject(invalid ? 400 : 503, invalid ? 'INVALID_PAYLOAD' : 'INGESTION_FAILED');
  }
}

````

### File: lib/rateLimit.ts

SHA-256: `29bfade113c0a38698f6b460c847c1f8bc5d7f610c6f9366ac53fb9cc6b5ce37`

````typescript
import { digest } from './logger';
import { clientAddress } from './hosting';
import { database } from './database';
export async function rateLimit(request: Request) {
  const configuredWindow = Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 600);
  const configuredMax = Number(process.env.RATE_LIMIT_MAX || 10);
  const windowSeconds = Number.isFinite(configuredWindow)
    ? Math.min(86400, Math.max(60, Math.floor(configuredWindow)))
    : 600;
  const max = Number.isFinite(configuredMax) ? Math.max(1, Math.floor(configuredMax)) : 10;
  const now = Date.now();
  const window = Math.floor(now / (windowSeconds * 1000));
  const key = digest('rate:' + clientAddress(request) + ':' + window);
  const expiresAt = (window + 1) * windowSeconds * 1000;
  const db = await database();
  // One SQL statement serializes concurrent requests across Worker instances.
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (bucket_key, count, expires_at) VALUES (?, 1, ?)
     ON CONFLICT(bucket_key) DO UPDATE SET count = MIN(rate_limits.count + 1, ?)
     RETURNING count`,
    )
    .bind(key, expiresAt, max + 1)
    .first<{ count: number }>();
  if (!row) throw new Error('Rate limit unavailable');
  return {
    allowed: row.count <= max,
    retryAfter: Math.max(1, Math.ceil((expiresAt - now) / 1000)),
  };
}

````

### File: lib/reconciliation.mjs

SHA-256: `8ef7080cf390ae5a87eddadc9c7e7e7c89a08f43be40d7ad8469c36f15661d10`

````javascript
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

function phone(value) {
  if (typeof value !== 'string') return null;
  const parsed = parsePhoneNumberFromString(value, 'ZA');
  return parsed?.country === 'ZA' && parsed.isValid() ? parsed.number : null;
}
function id(value) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim() || null
    : null;
}

// Exact vendor IDs establish a match. Phone-only candidates always require review.
export function reconcile(local, vendor) {
  if (!Array.isArray(local) || !Array.isArray(vendor))
    throw new Error('Both inputs must contain lead arrays.');
  if (
    vendor.some(
      (row) =>
        !row ||
        typeof row !== 'object' ||
        Array.isArray(row) ||
        (!id(row.leadId) && !phone(row.phone1)),
    )
  )
    throw new Error('Each LeadByte row needs a leadId or a valid string phone1.');
  const byId = new Map();
  const byPhone = new Map();
  const localIdCounts = new Map();
  for (const row of local) {
    const key = id(row.leadbyte_lead_id);
    if (key) localIdCounts.set(key, (localIdCounts.get(key) || 0) + 1);
  }
  vendor.forEach((row, index) => {
    const leadId = id(row.leadId);
    const number = phone(row.phone1);
    if (leadId) byId.set(leadId, [...(byId.get(leadId) || []), index]);
    if (number) byPhone.set(number, [...(byPhone.get(number) || []), index]);
  });
  const matched = new Set();
  const results = local.map((row) => {
    const key = id(row.leadbyte_lead_id);
    const exact = key ? byId.get(key) || [] : [];
    let status;
    let candidates = exact;
    if (exact.length > 1 || (key && localIdCounts.get(key) > 1)) status = 'ambiguous_id';
    else if (exact.length === 1) {
      const upstream = vendor[exact[0]];
      matched.add(exact[0]);
      const phoneMismatch = phone(upstream.phone1) && phone(row.phone1) !== phone(upstream.phone1);
      const codeMismatch =
        upstream.code !== undefined &&
        upstream.code !== null &&
        Number(upstream.code) !== row.leadbyte_code;
      status = phoneMismatch || codeMismatch ? 'matched_id_data_mismatch' : 'matched_id';
    } else {
      candidates = byPhone.get(phone(row.phone1)) || [];
      status = candidates.length ? 'phone_candidates_review' : 'not_in_import';
    }
    return {
      requestId: row.request_id,
      leadByteId: key,
      deliveryStatus: row.delivery_status,
      status,
      vendorRowIndexes: candidates,
    };
  });
  return {
    results,
    vendorRowsWithoutExactMatch: vendor
      .map((_, index) => index)
      .filter((index) => !matched.has(index)),
    counts: results.reduce(
      (all, row) => ({ ...all, [row.status]: (all[row.status] || 0) + 1 }),
      {},
    ),
  };
}

````

### File: lib/socialLeadProcessor.ts

SHA-256: `1d3d73e94ce2fbfd77ed9975a276fd7152cb5ae11ea38540d40d58c21daf8290`

````typescript
import { createHmac, randomUUID } from 'node:crypto';
import type { LeadBindings } from './leadBindings';
import { googleLeadMapper, type GoogleMappings } from './googleLeadMapper';
import { ingestLead } from './leadService';
import { identifier, object, socialEntries, type SocialProvider } from './socialWebhooks';
import { parseWebhookJson } from './webhookPayload';
import { siteUrl } from './config';

type InboxRow = {
  id: string;
  provider: SocialProvider;
  payload_json: string;
  attempts: number;
  cursor: number;
};
function timestamp(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1e11)
    return new Date(value * 1000).toISOString();
  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  )
    return new Date(value).toISOString();
}
export async function processSocialPayload(row: InboxRow, env: LeadBindings, fetcher = fetch) {
  const raw = parseWebhookJson(row.payload_json);
  const mappings = object(
    JSON.parse(
      (row.provider === 'META_ADS' ? env.META_FORM_MAPPINGS : env.TIKTOK_FORM_MAPPINGS) || '{}',
    ),
  ) as GoogleMappings;
  for (const mapping of Object.values(mappings)) {
    object(mapping);
    if (
      mapping.fields &&
      Object.values(object(mapping.fields)).some((value) => typeof value !== 'string')
    )
      throw new Error('INVALID_MAPPING');
    for (const answer of Object.values(mapping.answers || {})) {
      object(answer);
      if (
        typeof answer.columnId !== 'string' ||
        Object.values(object(answer.values)).some(
          (value) => typeof value !== 'string' && typeof value !== 'boolean',
        )
      )
        throw new Error('INVALID_MAPPING');
    }
    if (
      (mapping.consentText !== undefined && typeof mapping.consentText !== 'string') ||
      (mapping.consentVersion !== undefined && typeof mapping.consentVersion !== 'string')
    )
      throw new Error('INVALID_MAPPING');
  }
  let position = 0;
  let processed = 0;
  for (const entry of socialEntries(raw, row.provider, env)) {
    const records =
      row.provider === 'META_ADS'
        ? (entry.changes as unknown[])
            .map(object)
            .filter((change) => change.field === 'leadgen')
            .map((change) => object(change.value))
        : [entry];
    for (const record of records) {
      if (position++ < row.cursor) continue;
      if (processed >= 5) return false;
      const id = identifier(row.provider === 'META_ADS' ? record.leadgen_id : record.id);
      const formId = identifier(row.provider === 'META_ADS' ? record.form_id : record.page_id);
      let details = record;
      if (row.provider === 'META_ADS') {
        if (!env.META_PAGE_ACCESS_TOKEN || !/^v\d+\.0$/.test(env.META_GRAPH_VERSION || ''))
          throw new Error('META_CONFIGURATION_REQUIRED');
        const url = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${id}`);
        url.searchParams.set(
          'fields',
          'id,created_time,field_data,form_id,ad_id,adset_id,campaign_id',
        );
        if (env.META_APP_SECRET)
          url.searchParams.set(
            'appsecret_proof',
            createHmac('sha256', env.META_APP_SECRET)
              .update(env.META_PAGE_ACCESS_TOKEN)
              .digest('hex'),
          );
        const response = await fetcher(url, {
          headers: { Authorization: `Bearer ${env.META_PAGE_ACCESS_TOKEN}` },
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error('PROVIDER_UNAVAILABLE');
        details = object(await response.json());
        if (details.id !== id || details.form_id !== formId)
          throw new Error('PROVIDER_ID_MISMATCH');
      }
      const fields = row.provider === 'META_ADS' ? details.field_data : details.changes;
      if (!Array.isArray(fields) || fields.length > 100) throw new Error('INVALID_FIELDS');
      const columns = fields.flatMap((value) => {
        const field = object(value);
        const key = row.provider === 'META_ADS' ? field.name : field.field;
        const answer =
          row.provider === 'META_ADS'
            ? Array.isArray(field.values) && field.values.length === 1
              ? field.values[0]
              : undefined
            : field.value;
        if (typeof key !== 'string') throw new Error('INVALID_FIELD');
        // Multi-select/object/null answers remain unknown, never affirmative consent.
        // The original notification is retained for operator review.
        if (typeof answer !== 'string') return [];
        // Keep original question names for configured qualification mappings.
        return [{ column_id: key, string_value: answer }];
      });
      const defaults = {
        firstname: 'first_name',
        lastname: 'last_name',
        email: 'email',
        phone: 'phone_number',
      };
      const mapping = Object.hasOwn(mappings, formId) ? mappings[formId] : {};
      const fullNameField = row.provider === 'META_ADS' ? 'full_name' : 'name';
      const fullName = columns.find((column) => column.column_id === fullNameField);
      if (fullName && !columns.some((column) => column.column_id === 'FULL_NAME'))
        columns.push({ ...fullName, column_id: 'FULL_NAME' });
      const lead = googleLeadMapper(
        {
          lead_id: id,
          form_id: formId,
          user_column_data: columns,
          campaign_id: details.campaign_id,
          adgroup_id: details.adset_id || details.adgroup_id,
          creative_id: details.ad_id,
          lead_submit_time: timestamp(details.created_time || details.create_time),
          is_test: env.SOCIAL_LEADS_TEST_MODE !== 'false',
        },
        { [formId]: { ...mapping, fields: { ...defaults, ...mapping.fields } } },
      );
      lead.source = row.provider;
      lead.consentSource = row.provider;
      lead.metadata = {
        fullName: fullName?.string_value,
        accountId: row.provider === 'META_ADS' ? entry.id : entry.advertiser_id,
        deliveryMethod: 'native_webhook',
      };
      const eventId = randomUUID();
      const payload = JSON.stringify({ inboxId: row.id, externalLeadId: id, formId });
      await env.DB.prepare(
        "INSERT INTO webhook_events(id,provider,event_type,received_at,processing_status,payload_json) VALUES (?,?,'LEAD',?,'RECEIVED',?)",
      )
        .bind(eventId, row.provider, Date.now(), payload)
        .run();
      try {
        await ingestLead(env, lead, siteUrl(), { id: eventId, payload });
      } catch {
        await env.DB.prepare(
          "UPDATE webhook_events SET processing_status='FAILED',error_message='INGESTION_FAILED' WHERE id=?",
        )
          .bind(eventId)
          .run();
        throw new Error('INGESTION_FAILED');
      }
      await env.DB.prepare('UPDATE social_webhook_inbox SET cursor=? WHERE id=?')
        .bind(position, row.id)
        .run();
      processed++;
    }
  }
  return true;
}

export async function processSocialInbox(env: LeadBindings) {
  const now = Date.now();
  const { results } = await env.DB.prepare(
    "SELECT id,provider,payload_json,attempts,cursor FROM social_webhook_inbox WHERE status IN ('pending','processing') AND next_attempt_at<=? AND lease_until<? ORDER BY received_at LIMIT 3",
  )
    .bind(now, now)
    .all<InboxRow>();
  for (const row of results) {
    const claim = await env.DB.prepare(
      "UPDATE social_webhook_inbox SET status='processing',lease_until=?,attempts=attempts+1 WHERE id=? AND status IN ('pending','processing') AND lease_until<?",
    )
      .bind(Date.now() + 300000, row.id, Date.now())
      .run();
    if (!claim.meta.changes) continue;
    try {
      const complete = await processSocialPayload(row, env);
      await env.DB.prepare(
        'UPDATE social_webhook_inbox SET status=?,processed_at=?,lease_until=0,error_code=NULL,attempts=0 WHERE id=?',
      )
        .bind(complete ? 'processed' : 'pending', complete ? Date.now() : null, row.id)
        .run();
    } catch {
      await env.DB.prepare(
        "UPDATE social_webhook_inbox SET status=?,next_attempt_at=?,lease_until=0,error_code='PROCESSING_FAILED' WHERE id=?",
      )
        .bind(
          row.attempts >= 9 ? 'failed' : 'pending',
          Date.now() + Math.min(3600000, 60000 * 2 ** row.attempts),
          row.id,
        )
        .run();
    }
  }
  await env.DB.prepare(
    "DELETE FROM social_webhook_inbox WHERE received_at<? AND status='processed'",
  )
    .bind(Date.now() - 30 * 86400000)
    .run();
}

````

### File: lib/socialWebhooks.ts

SHA-256: `1cf3c44c403dbd544e46f0046b6b918ec274bac17c2654e5b8fe8a03ceab3376`

````typescript
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { LeadBindings } from './leadBindings';
import { parseWebhookJson, readRawBody, InvalidWebhookPayload } from './webhookPayload';

export type SocialProvider = 'META_ADS' | 'TIKTOK_ADS';
export function socialReply(status: number) {
  return Response.json(
    { received: status === 200 },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
function equal(a: string, b: string) {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest(),
  );
}
export function metaChallenge(request: Request, env: LeadBindings) {
  if (!env.META_VERIFY_TOKEN || env.META_VERIFY_TOKEN.length < 32) return socialReply(503);
  const params = new URL(request.url).searchParams;
  const challenge = params.get('hub.challenge');
  if (
    params.get('hub.mode') !== 'subscribe' ||
    !challenge ||
    challenge.length > 1024 ||
    !equal(params.get('hub.verify_token') || '', env.META_VERIFY_TOKEN)
  )
    return socialReply(403);
  return new Response(challenge, {
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  });
}
export function verifySocialSignature(
  provider: SocialProvider,
  body: Buffer,
  header: string,
  secret: string,
  now = Date.now(),
) {
  if (provider === 'META_ADS') {
    if (!/^sha256=[a-fA-F0-9]{64}$/.test(header)) return false;
    return equal(
      header.slice(7).toLowerCase(),
      createHmac('sha256', secret).update(body).digest('hex'),
    );
  }
  const parts = header.split(',').map((part) => part.trim());
  const times = parts.filter((part) => /^t=\d+$/.test(part));
  const signatures = parts.filter((part) => /^s=[a-fA-F0-9]{64}$/.test(part));
  if (times.length !== 1 || signatures.length !== 1 || parts.length !== 2) return false;
  const timestamp = times[0].slice(2);
  if (!Number.isSafeInteger(Number(timestamp)) || Math.abs(now / 1000 - Number(timestamp)) > 300)
    return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex');
  return equal(signatures[0].slice(2).toLowerCase(), expected);
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new InvalidWebhookPayload('INVALID_OBJECT');
  return value as Record<string, unknown>;
}
export function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{1,80}$/.test(value))
    throw new InvalidWebhookPayload('INVALID_ID');
  return value;
}
export function socialEntries(
  raw: Record<string, unknown>,
  provider: SocialProvider,
  env: LeadBindings,
) {
  if (raw.object !== (provider === 'META_ADS' ? 'page' : 1))
    throw new InvalidWebhookPayload('INVALID_EVENT');
  if (!Array.isArray(raw.entry) || !raw.entry.length || raw.entry.length > 100)
    throw new InvalidWebhookPayload('INVALID_ENTRIES');
  for (const value of raw.entry) {
    const entry = object(value);
    if (provider === 'META_ADS') {
      if (identifier(entry.id) !== env.META_PAGE_ID)
        throw new InvalidWebhookPayload('UNEXPECTED_ACCOUNT');
      if (!Array.isArray(entry.changes) || entry.changes.length > 100)
        throw new InvalidWebhookPayload('INVALID_CHANGES');
      for (const value of entry.changes) {
        const change = object(value);
        if (change.field !== 'leadgen') continue;
        const lead = object(change.value);
        identifier(lead.leadgen_id);
        identifier(lead.form_id);
        if (lead.page_id !== undefined && identifier(lead.page_id) !== env.META_PAGE_ID)
          throw new InvalidWebhookPayload('UNEXPECTED_ACCOUNT');
      }
    } else {
      if (identifier(entry.advertiser_id) !== env.TIKTOK_ADVERTISER_ID)
        throw new InvalidWebhookPayload('UNEXPECTED_ACCOUNT');
      identifier(entry.id);
      identifier(entry.page_id);
      if (entry.lead_source !== undefined && entry.lead_source !== 'INSTANT_FORM')
        throw new InvalidWebhookPayload('UNSUPPORTED_LEAD_SOURCE');
      if (!Array.isArray(entry.changes) || entry.changes.length > 100)
        throw new InvalidWebhookPayload('INVALID_CHANGES');
    }
  }
  return raw.entry.map(object);
}
export async function receiveSocialWebhook(
  request: Request,
  env: LeadBindings,
  provider: SocialProvider,
) {
  const secret = provider === 'META_ADS' ? env.META_APP_SECRET : env.TIKTOK_APP_SECRET;
  const account = provider === 'META_ADS' ? env.META_PAGE_ID : env.TIKTOK_ADVERTISER_ID;
  if (!secret || !account) return socialReply(503);
  if (new URL(request.url).protocol !== 'https:' && process.env.DEPLOY_ENV !== 'development')
    return socialReply(403);
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    return socialReply(400);
  let body: Buffer;
  try {
    body = await readRawBody(request);
  } catch {
    return socialReply(400);
  }
  if (
    !verifySocialSignature(
      provider,
      body,
      request.headers.get(provider === 'META_ADS' ? 'x-hub-signature-256' : 'tiktok-signature') ||
        '',
      secret,
    )
  )
    return socialReply(403);
  try {
    socialEntries(parseWebhookJson(body.toString('utf8')), provider, env);
  } catch {
    return socialReply(400);
  }
  // Raw body is stored after authentication only; never log PII or credentials.
  const id = createHash('sha256').update(provider).update(body).digest('hex');
  try {
    await env.DB.prepare(
      'INSERT INTO social_webhook_inbox(id,provider,payload_json,received_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING',
    )
      .bind(id, provider, body.toString('utf8'), Date.now())
      .run();
    return socialReply(200);
  } catch {
    return socialReply(503);
  }
}

````

### File: lib/submissionKey.ts

SHA-256: `b4d8626a650956baf77a8e51e93476d91c02626c5dc9bc13789cc42a43041815`

````typescript
// Persist only a digest and random id, never contact details, in browser session storage.
export async function submissionKey(payload: string, renew = false) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  const hash = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
  const key = `cartrack-submit-${hash}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (!renew && existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  } catch {
    /* The form ref still protects visitors whose storage is disabled. */
  }
  const id = crypto.randomUUID();
  try {
    sessionStorage.setItem(key, id);
  } catch {
    /* Memory fallback in the form. */
  }
  return id;
}

````

### File: lib/submissions.ts

SHA-256: `e067cf6e82d41d77dd9356dc46fc504a1195bd86fca5412eb8dd7ca1f47db6cb`

````typescript
import type { LeadResult } from './leadbyte';
import { database } from './database';
import { CONSENT_VERSION } from './config';
import { buildPayload } from './leadbyte';
import type { LeadInput } from './validation';
import { sanitizeAttribution } from './attribution';
type Entry = { fingerprint: string; result: string | null; httpStatus: number | null };
export type LeadRecord = {
  requestId: string;
  input: LeadInput;
  site: string;
  submittedAt: Date;
  attribution: unknown;
};
// Lead records are retained for reporting. Pending deliveries stay claimed too.
export async function claimSubmission(key: string, fingerprint: string, lead?: LeadRecord) {
  const db = await database();
  const now = lead?.submittedAt.getTime() ?? Date.now();
  const payload = lead
    ? Object.fromEntries(buildPayload(lead.input, lead.site, lead.submittedAt))
    : null;
  const inserted = await db
    .prepare(
      `INSERT INTO submissions
      (submission_key, fingerprint, created_at, expires_at, consent_version,
       record_version, request_id, firstname, lastname, phone1, optinurl, optindate,
       acceptterms, offer_id, campaign_id, supplier_id, preferredtimeofcall,
       payload_json, qualification_json, attribution_json, delivery_status, email)
     VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(submission_key) DO NOTHING
     RETURNING submission_key`,
    )
    .bind(
      key,
      fingerprint,
      now,
      CONSENT_VERSION,
      lead ? 1 : 0,
      lead?.requestId ?? null,
      payload?.firstname ?? null,
      payload?.lastname ?? null,
      payload?.phone1 ?? null,
      payload?.optinurl ?? null,
      payload?.optindate ?? null,
      payload?.acceptterms ?? null,
      payload?.offer_id ?? null,
      lead ? 'DASHCAMS' : null,
      lead ? '27144' : null,
      payload?.preferredtimeofcall ?? null,
      payload ? JSON.stringify(payload) : null,
      lead
        ? JSON.stringify({
            age: lead.input.age,
            vehicle: lead.input.vehicle,
            employment: lead.input.employment,
            income: lead.input.income,
            ...(lead.input.eligibilityConfirmed !== undefined
              ? { eligibilityConfirmed: lead.input.eligibilityConfirmed }
              : {}),
          })
        : null,
      lead ? JSON.stringify(sanitizeAttribution(lead.attribution)) : null,
      lead ? 'pending' : 'legacy_unknown',
      lead?.input.email ?? null,
    )
    .first();
  if (inserted) return { claimed: true as const };
  const existing = await db
    .prepare(
      'SELECT fingerprint, result, http_status AS httpStatus FROM submissions WHERE submission_key = ?',
    )
    .bind(key)
    .first<Entry>();
  if (!existing) throw new Error('Submission record unavailable');
  return { claimed: false as const, existing };
}
export async function completeSubmission(
  key: string,
  result: Pick<LeadResult, 'state' | 'message'> & { retryable?: boolean },
  status: number,
  vendor?: LeadResult,
) {
  const db = await database();
  const updated = await db
    .prepare(
      `UPDATE submissions SET result = ?, http_status = ?, completed_at = ?,
       delivery_status = ?, leadbyte_code = ?, leadbyte_lead_id = ?, leadbyte_response = ?,
       leadbyte_info_json = ?, leadbyte_raw_response = ?, leadbyte_timestamp = ?,
       leadbyte_process_time = ?, upstream_http_status = ?, diagnostic_code = ?, delivery_uncertain = ?
     WHERE submission_key = ? AND result IS NULL RETURNING submission_key`,
    )
    .bind(
      JSON.stringify(result),
      status,
      Date.now(),
      vendor?.diagnosticCode === 'SUBMISSIONS_DISABLED'
        ? 'not_sent_disabled'
        : vendor?.uncertain
          ? 'uncertain'
          : vendor?.code === 1
            ? 'accepted'
            : vendor?.code === -2
              ? 'duplicate'
              : vendor?.code !== undefined
                ? 'rejected'
                : 'legacy_unknown',
      vendor?.code ?? null,
      vendor?.leadId ?? null,
      vendor?.response ?? null,
      vendor?.info !== undefined ? JSON.stringify(vendor.info) : null,
      vendor?.rawResponse ?? null,
      vendor?.timestamp ?? null,
      vendor?.processTime ?? null,
      vendor?.upstreamStatus ?? null,
      vendor?.diagnosticCode ?? null,
      vendor?.uncertain ? 1 : 0,
      key,
    )
    .first();
  if (!updated) throw new Error('Submission completion unavailable');
}

````

### File: lib/temporaryStore.ts

SHA-256: `f2d322d413d97dcd880c1ebc78412ce8f0b46ed6cfceb97239eb1ea432e907bc`

````typescript
// Best-effort protection within ONE warm function instance, not shared persistence.
export class TemporaryStore<T> {
  private entries = new Map<string, { value: T; expiresAt: number }>();
  constructor(private readonly capacity = 5000) {}
  get(key: string, now = Date.now()): T | undefined {
    const row = this.entries.get(key);
    if (!row) return undefined;
    if (row.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    return row.value;
  }
  set(key: string, value: T, expiresAt: number, now = Date.now()) {
    for (const [id, row] of this.entries) if (row.expiresAt <= now) this.entries.delete(id);
    if (!this.entries.has(key) && this.entries.size >= this.capacity) return false;
    this.entries.set(key, { value, expiresAt });
    return true;
  }
}

````

### File: lib/validation.ts

SHA-256: `3b362b2eac9de9ce409d8fe8a50dff129239bdf6111693b3a05265d5daa7c4e6`

````typescript
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

export const employmentOptions = ['employed', 'self_employed'] as const;
export type LeadInput = {
  firstname: string;
  lastname: string;
  phone: string;
  email?: string;
  eligibilityConfirmed?: boolean;
  age: string;
  vehicle: string;
  employment: string;
  income: string;
  terms: boolean;
  preferredtimeofcall: string;
  website: string;
};
export type FieldErrors = Partial<Record<keyof LeadInput, string>>;
export function cleanText(value: unknown, max = 80): string {
  return typeof value === 'string'
    ? value
        .normalize('NFC')
        .replace(/[<>\u0000-\u001f\u007f]/g, '')
        .trim()
        .slice(0, max)
    : '';
}
export function cleanPhone(value: unknown): string {
  if (typeof value !== 'string' || value.length > 30 || !/^[+\d\s()-]+$/.test(value)) return '';
  const phone = parsePhoneNumberFromString(value.trim(), 'ZA');
  return phone?.country === 'ZA' && phone.isValid() && phone.getType() === 'MOBILE'
    ? phone.number
    : '';
}
export function parseCallTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+02:00`);
  if (!Number.isFinite(date.getTime())) return null;
  // Reject JS date rollover (for example 31 February).
  return new Date(date.getTime() + 7200000).toISOString().slice(0, 16) === value ? date : null;
}
export function validateLead(raw: unknown, now = new Date()) {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  // The compact form fills these values only after the visitor affirms all four facts.
  // Explicit answers remain authoritative, including a non-qualifying answer.
  const confirmed = r.eligibilityConfirmed === true;
  const input: LeadInput = {
    firstname: cleanText(r.firstname),
    lastname: cleanText(r.lastname),
    phone: cleanPhone(r.phone),
    ...(r.email !== undefined ? { email: cleanText(r.email, 254) } : {}),
    ...(r.eligibilityConfirmed !== undefined ? { eligibilityConfirmed: confirmed } : {}),
    age: cleanText(r.age ?? (confirmed ? '18_plus' : '')),
    vehicle: cleanText(r.vehicle ?? (confirmed ? 'yes' : '')),
    employment: cleanText(r.employment ?? (confirmed ? 'employed' : '')),
    income: cleanText(r.income ?? (confirmed ? '10000_plus' : '')),
    terms: r.terms === true,
    preferredtimeofcall: cleanText(r.preferredtimeofcall, 30),
    website: cleanText(r.website),
  };
  const errors: FieldErrors = {};
  const reasons: string[] = [];
  if (r.eligibilityConfirmed !== undefined && !confirmed)
    errors.eligibilityConfirmed = 'Please confirm that you meet all four requirements.';
  for (const field of ['firstname', 'lastname'] as const) {
    // Letters, combining accents and separators support real multi-part names.
    if (
      typeof r[field] !== 'string' ||
      r[field].length > 80 ||
      !/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(input[field])
    )
      errors[field] =
        `Please enter your ${field === 'firstname' ? 'first' : 'last'} name using letters.`;
  }
  if (!input.phone) errors.phone = 'Please enter a valid South African mobile number.';
  // Existing API clients may omit email; the reference quote form collects it.
  if (
    r.email !== undefined &&
    (typeof r.email !== 'string' ||
      r.email.length > 254 ||
      !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(input.email || ''))
  )
    errors.email = 'Please enter a valid email address.';
  const checks = [
    [
      'age',
      ['18_plus', 'under_18'],
      ['18_plus'],
      'does_not_qualify_age',
      'You must be 18 or older for this offer.',
    ],
    [
      'vehicle',
      ['yes', 'no'],
      ['yes'],
      'does_not_have_vehicle',
      'This offer requires access to a vehicle.',
    ],
    [
      'employment',
      ['employed', 'self_employed', 'unemployed', 'retired', 'student'],
      ['employed', 'self_employed'],
      'does_not_qualify_employment',
      'This offer requires you to be employed or self-employed.',
    ],
    [
      'income',
      ['under_10000', '10000_plus', '10000_19999', '20000_39999', '40000_plus'],
      ['10000_plus', '10000_19999', '20000_39999', '40000_plus'],
      'does_not_qualify_income',
      'This offer requires a monthly income of R10,000 or more.',
    ],
  ] as const;
  for (const [field, allowed, qualifying, reason, message] of checks) {
    if (!(allowed as readonly string[]).includes(input[field]))
      errors[field] = 'Please select an option.';
    else if (!(qualifying as readonly string[]).includes(input[field])) {
      errors[field] = message;
      reasons.push(reason);
    }
  }
  if (!input.terms) errors.terms = 'Please accept the terms and consent to being contacted.';
  if (input.preferredtimeofcall) {
    const date = parseCallTime(input.preferredtimeofcall);
    if (!date || date <= now || date.getTime() > now.getTime() + 30 * 86400000)
      errors.preferredtimeofcall = 'Choose a future time within 30 days (South African time).';
  }
  return { input, errors, reasons, valid: Object.keys(errors).length === 0 };
}

````

### File: lib/webhookPayload.ts

SHA-256: `a011317e934c7f460a24b3c0ae1b1e44e3556ada010afa8a9d1b14707b782994`

````typescript
export class InvalidWebhookPayload extends Error {}

export function sanitizePayload(value: unknown, secret: string): unknown {
  if (typeof value === 'string') return value.split(secret).join('[redacted]');
  if (Array.isArray(value)) return value.map((entry) => sanitizePayload(entry, secret));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /key|token|secret|authorization|password/i.test(key)
          ? '[redacted]'
          : sanitizePayload(item, secret),
      ]),
    );
  return value;
}

export async function readRawBody(request: Request, limit = 65536): Promise<Buffer> {
  const reader = request.body?.getReader();
  if (!reader) throw new InvalidWebhookPayload('EMPTY_BODY');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw new InvalidWebhookPayload('BODY_TOO_LARGE');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export function parseWebhookJson(body: string): Record<string, unknown> {
  // V8's JSON source context preserves providers' 64-bit numeric IDs without
  // rounding them through a JavaScript number. Fail closed on older runtimes.
  const data: unknown = JSON.parse(
    body,
    (key: string, value: unknown, context?: { source?: string }) => {
      if (
        typeof value === 'number' &&
        /^(id|leadgen_id|lead_id|page_id|advertiser_id|library_id|form_id|campaign_id|ad_id|adgroup_id|creative_id|asset_group_id)$/.test(
          key,
        )
      ) {
        if (context?.source && /^\d+$/.test(context.source)) return context.source;
        if (!Number.isSafeInteger(value)) throw new InvalidWebhookPayload('UNSAFE_IDENTIFIER');
      }
      return value;
    },
  );
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new InvalidWebhookPayload('INVALID_JSON');
  return data as Record<string, unknown>;
}

export async function readJsonBody(request: Request, limit = 65536) {
  return parseWebhookJson((await readRawBody(request, limit)).toString('utf8'));
}

````

### File: migrations/0001_submission_storage.sql

SHA-256: `407bb828088de9eab5dccbf188cc46af2242d15fe9ac65fb86a41acbc17bcdd7`

````sql
-- Only pseudonymous identifiers and safe response data: no raw contact details.
CREATE TABLE submissions (
  submission_key TEXT PRIMARY KEY NOT NULL,
  fingerprint TEXT NOT NULL,
  result TEXT,
  http_status INTEGER,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  expires_at INTEGER NOT NULL,
  consent_version TEXT NOT NULL
);
CREATE INDEX submissions_expiry ON submissions(expires_at);
CREATE INDEX submissions_created ON submissions(created_at);

CREATE TABLE rate_limits (
  bucket_key TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX rate_limits_expiry ON rate_limits(expires_at);

````

### File: migrations/0002_lead_reporting.sql

SHA-256: `3969dbf0f80bde8cc878d44d36b05865b97b0df221dc1264238e0dd54ebaa993`

````sql
-- Additive migration: preserve existing submission tokens and safe replay responses.
-- expires_at is retained for compatibility but is no longer used to delete leads.
ALTER TABLE submissions ADD COLUMN record_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN request_id TEXT;
ALTER TABLE submissions ADD COLUMN firstname TEXT;
ALTER TABLE submissions ADD COLUMN lastname TEXT;
ALTER TABLE submissions ADD COLUMN phone1 TEXT;
ALTER TABLE submissions ADD COLUMN optinurl TEXT;
ALTER TABLE submissions ADD COLUMN optindate TEXT;
ALTER TABLE submissions ADD COLUMN acceptterms TEXT;
ALTER TABLE submissions ADD COLUMN offer_id TEXT;
ALTER TABLE submissions ADD COLUMN campaign_id TEXT;
ALTER TABLE submissions ADD COLUMN supplier_id TEXT;
ALTER TABLE submissions ADD COLUMN preferredtimeofcall TEXT;
ALTER TABLE submissions ADD COLUMN payload_json TEXT;
ALTER TABLE submissions ADD COLUMN qualification_json TEXT;
ALTER TABLE submissions ADD COLUMN attribution_json TEXT;
ALTER TABLE submissions ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'legacy_unknown';
ALTER TABLE submissions ADD COLUMN leadbyte_code INTEGER;
ALTER TABLE submissions ADD COLUMN leadbyte_lead_id TEXT;
ALTER TABLE submissions ADD COLUMN leadbyte_response TEXT;
ALTER TABLE submissions ADD COLUMN leadbyte_info_json TEXT;
ALTER TABLE submissions ADD COLUMN leadbyte_raw_response TEXT;
ALTER TABLE submissions ADD COLUMN leadbyte_timestamp TEXT;
ALTER TABLE submissions ADD COLUMN leadbyte_process_time REAL;
ALTER TABLE submissions ADD COLUMN upstream_http_status INTEGER;
ALTER TABLE submissions ADD COLUMN diagnostic_code TEXT;
ALTER TABLE submissions ADD COLUMN delivery_uncertain INTEGER NOT NULL DEFAULT 0;

CREATE INDEX submissions_phone ON submissions(phone1, created_at);
CREATE INDEX submissions_leadbyte_id ON submissions(leadbyte_lead_id);
CREATE INDEX submissions_delivery ON submissions(delivery_status, created_at);
CREATE INDEX submissions_code ON submissions(leadbyte_code, created_at);
CREATE UNIQUE INDEX submissions_request_id ON submissions(request_id) WHERE request_id IS NOT NULL;

CREATE TABLE leadbyte_codes (code INTEGER PRIMARY KEY, description TEXT NOT NULL);
INSERT INTO leadbyte_codes(code, description) VALUES
  (1, 'Accepted'),
  (-9, 'Campaign not active'),
  (-8, 'HLR rejection'),
  (-7, 'Supplier not authorised'),
  (-6, 'Filter rejection'),
  (-5, 'Validation error'),
  (-4, 'Campaign cap reached'),
  (-3, 'Remote system error'),
  (-2, 'Duplicate or resubmission'),
  (-19, 'Exchange is not enabled'),
  (-17, 'Number matched CTPS database'),
  (-16, 'Number matched DNCR database'),
  (-15, 'Number matched TPS database'),
  (-14, 'IP address country rejection'),
  (-13, 'Landline rejection'),
  (-12, 'Email rejection'),
  (-11, 'IP address blocked'),
  (-100, 'Internal error'),
  (-10, 'PAF rejection');

-- Reporting views deliberately exclude legacy rows without a full lead record.
CREATE VIEW lead_reporting AS
SELECT s.*, c.description AS leadbyte_code_description,
  date(s.created_at / 1000, 'unixepoch', '+2 hours') AS submitted_date_sa,
  datetime(s.created_at / 1000, 'unixepoch') AS submitted_at_utc,
  json_extract(s.attribution_json, '$.affiliate_id') AS affiliate_id,
  json_extract(s.attribution_json, '$.transaction_id') AS transaction_id,
  json_extract(s.attribution_json, '$.utm_source') AS utm_source,
  json_extract(s.attribution_json, '$.utm_campaign') AS utm_campaign
FROM submissions s LEFT JOIN leadbyte_codes c ON c.code = s.leadbyte_code
WHERE s.record_version = 1;

CREATE VIEW lead_daily_summary AS
SELECT submitted_date_sa, campaign_id, supplier_id, offer_id,
  delivery_status, leadbyte_code, leadbyte_code_description, COUNT(*) AS leads
FROM lead_reporting
GROUP BY submitted_date_sa, campaign_id, supplier_id, offer_id,
  delivery_status, leadbyte_code, leadbyte_code_description;

````

### File: migrations/0003_contact_email.sql

SHA-256: `f6fe218cdeb303e64047969671e4b3471e8f61e21ac609faceef7046347d14ef`

````sql
-- Preserve existing records. Email is retained locally, not added to the vendor payload.
ALTER TABLE submissions ADD COLUMN email TEXT;

````

### File: migrations/0004_lead_pipeline.sql

SHA-256: `66543239e199e7458e07799da7b28855aa30fe267fb59d642775313233c66c55`

````sql
-- Additive: historical synchronous submissions are never automatically queued.
ALTER TABLE submissions ADD COLUMN source TEXT NOT NULL DEFAULT 'WEBSITE';
ALTER TABLE submissions ADD COLUMN external_lead_id TEXT;
ALTER TABLE submissions ADD COLUMN source_campaign_id TEXT;
ALTER TABLE submissions ADD COLUMN campaign_name TEXT;
ALTER TABLE submissions ADD COLUMN ad_group_id TEXT;
ALTER TABLE submissions ADD COLUMN ad_id TEXT;
ALTER TABLE submissions ADD COLUMN form_id TEXT;
ALTER TABLE submissions ADD COLUMN marketing_consent INTEGER;
ALTER TABLE submissions ADD COLUMN consent_text TEXT;
ALTER TABLE submissions ADD COLUMN consent_timestamp TEXT;
ALTER TABLE submissions ADD COLUMN consent_source TEXT;
ALTER TABLE submissions ADD COLUMN submitted_at TEXT;
ALTER TABLE submissions ADD COLUMN original_phone TEXT;
ALTER TABLE submissions ADD COLUMN metadata_json TEXT;
ALTER TABLE submissions ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE submissions ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN updated_at INTEGER;
ALTER TABLE submissions ADD COLUMN lease_until INTEGER;
ALTER TABLE submissions ADD COLUMN attempt_id TEXT;
ALTER TABLE submissions ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX submissions_source_external ON submissions(source, external_lead_id)
  WHERE external_lead_id IS NOT NULL;
CREATE INDEX submissions_processing ON submissions(processing_status, updated_at);

CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  external_lead_id TEXT,
  received_at INTEGER NOT NULL,
  processed_at INTEGER,
  processing_status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  error_message TEXT,
  lead_id TEXT REFERENCES submissions(submission_key)
);
CREATE INDEX webhook_events_lead ON webhook_events(lead_id, received_at);
CREATE INDEX webhook_events_status ON webhook_events(processing_status, received_at);

-- Transactional outbox closes the D1 commit / queue publish failure window.
CREATE TABLE lead_outbox (
  lead_id TEXT PRIMARY KEY REFERENCES submissions(submission_key),
  created_at INTEGER NOT NULL,
  published_at INTEGER,
  publish_attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX lead_outbox_pending ON lead_outbox(published_at, created_at);

CREATE TABLE lead_attempts (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES submissions(submission_key),
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  outcome TEXT NOT NULL,
  result_json TEXT
);
CREATE INDEX lead_attempts_lead ON lead_attempts(lead_id, started_at);

CREATE TABLE lead_dead_letters (
  message_id TEXT PRIMARY KEY,
  lead_id TEXT,
  received_at INTEGER NOT NULL,
  reason TEXT NOT NULL
);

````

### File: migrations/0005_microsoft_ads_reporting.sql

SHA-256: `c3a76975b427101fb9d6e16f95208f644b34daff5a9c2d5f357b84479b4e2d96`

````sql
-- Reuse the existing attribution JSON and ad campaign columns. No lead rows change.
-- Ingestion source stays WEBSITE; acquisitionSource identifies the advertising channel.
CREATE VIEW microsoft_ads_leads AS
SELECT submission_key AS lead_id, request_id, source AS ingestion_source,
  created_at, completed_at, updated_at, source_campaign_id, campaign_name, ad_group_id, ad_id,
  json_extract(attribution_json, '$.msclkid') AS msclkid,
  json_extract(attribution_json, '$.utm_source') AS utm_source,
  json_extract(attribution_json, '$.utm_medium') AS utm_medium,
  json_extract(attribution_json, '$.utm_campaign') AS utm_campaign,
  json_extract(attribution_json, '$.utm_term') AS utm_term,
  processing_status, delivery_status, retry_count, leadbyte_code, leadbyte_lead_id,
  diagnostic_code, is_test
FROM submissions
WHERE source = 'WEBSITE' AND json_extract(metadata_json, '$.acquisitionSource') = 'MICROSOFT_ADS';

CREATE INDEX submissions_acquisition_created
  ON submissions(json_extract(metadata_json, '$.acquisitionSource'), created_at);

````

### File: migrations/0006_social_webhook_inbox.sql

SHA-256: `ea2c883e0ef12d7928f44f54d873a74ef49fc698582bb38d32b2d624f2255fb5`

````sql
-- Durable receipt before acknowledging native provider callbacks.
CREATE TABLE social_webhook_inbox (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  cursor INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  processed_at INTEGER
);
CREATE INDEX social_inbox_pending ON social_webhook_inbox(status, next_attempt_at);

````

### File: next-env.d.ts

SHA-256: `1862ac4bbbc5192d4bf562161df66ea547ed3e67173100656ab606ae9797db2b`

````typescript
/// <reference types="next" />
/// <reference types="next/image-types/global" />
import "./.next/types/routes.d.ts";
import "./.next/types/root-params.d.ts";

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.

````

### File: next.config.ts

SHA-256: `d27d94342e794b137d95811afb3619cdaa76309651a27f5633e24f1f4607d602`

````typescript
import type { NextConfig } from 'next';
import { isIndexable } from './lib/hosting';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

if (process.env.NODE_ENV === 'development') initOpenNextCloudflareForDev();
const config: NextConfig = {
  turbopack: { root: process.cwd() },
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    const index = isIndexable();
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'" +
              (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '') +
              "; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'",
          },
          ...(!index ? [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] : []),
        ],
      },
    ];
  },
};
export default config;

````

### File: open-next.config.ts

SHA-256: `48a47e57593373c29b88d2d1bd46d29e602fd051c19afc28f3b0be17f94ae1d4`

````typescript
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig({});

````

### File: package.json

SHA-256: `5b47844c5d6e22993fda71254f13a8fb541e20a4de8790e25413f60c1a49a5dd`

````json
{
  "name": "cartrack-cameras",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "setup:local": "node scripts/setup-local.mjs && npm run db:migrate:local",
    "report": "node scripts/export-report.mjs",
    "report:daily": "node scripts/query-report.mjs daily",
    "report:issues": "node scripts/query-report.mjs issues",
    "report:pipeline": "node scripts/query-report.mjs pipeline",
    "report:microsoft": "node scripts/query-report.mjs microsoft",
    "reconcile": "node scripts/reconcile-report.mjs",
    "build": "next build",
    "build:cloudflare": "node scripts/build-cloudflare.mjs",
    "preview": "opennextjs-cloudflare preview",
    "deploy": "node scripts/deploy-cloudflare.mjs",
    "indexnow": "node scripts/indexnow.mjs",
    "indexnow:check": "node scripts/indexnow.mjs --dry-run",
    "db:migrate:local": "wrangler d1 migrations apply DB --local",
    "db:migrate:remote": "wrangler d1 migrations apply DB --remote --config wrangler.jsonc",
    "cf:typegen": "wrangler types --env-interface CloudflareEnv .wrangler/types/cloudflare-env.d.ts",
    "start": "next start",
    "typecheck": "next typegen && tsc --noEmit",
    "lint": "eslint .",
    "test": "node --experimental-sqlite node_modules/vitest/vitest.mjs run",
    "test:e2e": "playwright test",
    "test:worker": "node scripts/test-lead-worker.mjs",
    "format": "prettier --write app components lib tests scripts *.ts *.mjs *.json *.md"
  },
  "dependencies": {
    "@opennextjs/cloudflare": "^1.20.6",
    "esbuild": "0.28.2",
    "libphonenumber-js": "1.13.13",
    "next": "16.3.5",
    "react": "19.3.0",
    "react-dom": "19.3.0"
  },
  "devDependencies": {
    "@axe-core/playwright": "^4.13.0",
    "@cloudflare/workers-types": "^5.20260915.1",
    "@playwright/test": "1.63.0",
    "@tailwindcss/postcss": "^4",
    "@types/node": "^22",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "dotenv": "17.4.2",
    "eslint": "^9",
    "eslint-config-next": "16.3.5",
    "prettier": "^3.9.6",
    "tailwindcss": "^4",
    "typescript": "6.0.3",
    "vitest": "5.0.0",
    "wrangler": "^4.131.2"
  },
  "engines": {
    "node": ">=22.12.0"
  }
}

````

### File: playwright.config.ts

SHA-256: `ec63bbb35da6d7130d4ed6c7eb82c6b2ebc5ac1c14efd0649b9740fc8da355ac`

````typescript
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});

````

### File: postcss.config.mjs

SHA-256: `258faa39968594a46c2cf72ba120fb353e788ef2acc3265ddbfbc6400dd80761`

````javascript
const config = { plugins: { '@tailwindcss/postcss': {} } };
export default config;

````

### File: public/_headers

SHA-256: `243f83a85be7196e6382459068447d056353cabfdc9b85725ff9e6ddf794e97e`

````text
/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

````

### File: reports/daily.sql

SHA-256: `c9cfaaffc14a0eef0247cc61ff564e12c432ed18addf93474f9c0c1a53bfa14f`

````sql
-- Contact-free daily counts in South African time. Includes all recorded outcomes.
SELECT * FROM lead_daily_summary
ORDER BY submitted_date_sa DESC, delivery_status, leadbyte_code;

````

### File: reports/microsoft-ads.sql

SHA-256: `98f0cf6009bed54f736aa9c0e2e8d20c8ca2c7dd1791770e0b76efac80192e9b`

````sql
-- Aggregate operational report, no contact fields or click IDs.
SELECT date(created_at / 1000, 'unixepoch', '+2 hours') AS submitted_date_sa,
  source_campaign_id, ad_group_id, ad_id, processing_status,
  COUNT(*) AS leads,
  SUM(CASE WHEN msclkid IS NOT NULL THEN 1 ELSE 0 END) AS leads_with_click_id
FROM microsoft_ads_leads
WHERE is_test = 0
GROUP BY submitted_date_sa, source_campaign_id, ad_group_id, ad_id, processing_status
ORDER BY submitted_date_sa DESC, source_campaign_id;

````

### File: reports/pipeline-issues.sql

SHA-256: `dff2a26922d99d429c61dd93869c148a8a89d9b63e302375051ee11d34f32803`

````sql
-- No customer contact fields. Use the internal lead ID to investigate privately.
SELECT submission_key AS lead_id, source, processing_status, delivery_status,
  retry_count, diagnostic_code, leadbyte_code, leadbyte_lead_id,
  datetime(updated_at / 1000, 'unixepoch') AS updated_utc
FROM submissions
WHERE processing_status IN ('pending_review','retry','failed','dead_letter','uncertain','not_sent_disabled','rejected')
   OR (processing_status IN ('pending','queued','processing') AND updated_at < (unixepoch() - 900) * 1000)
ORDER BY updated_at DESC;

````

### File: reports/reconciliation-issues.sql

SHA-256: `64d2af9d06f6ade1b6c15bd835e12dcc79d582e6af0f43f99e9699d65e44e6fc`

````sql
-- Read-only operational checks. No contact details in this result.
SELECT request_id, submitted_at_utc, delivery_status, leadbyte_lead_id,
  leadbyte_code, leadbyte_code_description, diagnostic_code,
  CASE
    WHEN delivery_status = 'pending' THEN 'Pending: verify whether delivery started/completed'
    WHEN delivery_status = 'uncertain' THEN 'Uncertain: reconcile before retrying'
    WHEN delivery_status = 'accepted' AND leadbyte_lead_id IS NULL THEN 'Accepted without a LeadByte ID'
    WHEN delivery_status = 'not_sent_disabled' THEN 'Recorded locally; delivery was disabled'
    WHEN leadbyte_code IS NOT NULL AND leadbyte_code_description IS NULL THEN 'Unrecognised LeadByte code'
  END AS review_reason
FROM lead_reporting
WHERE delivery_status IN ('pending', 'uncertain', 'not_sent_disabled')
  OR (delivery_status = 'accepted' AND leadbyte_lead_id IS NULL)
  OR (leadbyte_code IS NOT NULL AND leadbyte_code_description IS NULL)
ORDER BY created_at DESC;

````

### File: scripts/build-cloudflare.mjs

SHA-256: `7a3fc5217cf228f55cf91e2be6db6e592a4eb70a8ca9356360da3f422b7a3b30`

````javascript
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/,\s*([}\]])/g, '$1'));
// Explicit build settings override ignored local Next.js env files.
const env = {
  ...process.env,
  ...config.vars,
  NEXT_PUBLIC_SITE_URL:
    config.vars.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://unconfigured.invalid',
};
const result = spawnSync(
  process.execPath,
  ['node_modules/@opennextjs/cloudflare/dist/cli/index.js', 'build'],
  {
    stdio: 'inherit',
    env,
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);

````

### File: scripts/check-deployment.mjs

SHA-256: `cff7080b23b56ac64d6b724bbd502a60171d18b23029e38c8ca3d98a39370564`

````javascript
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/,\s*([}\]])/g, '$1'));
const db = config.d1_databases.find((entry) => entry.binding === 'DB');
if (!db?.database_id || db.database_id === '00000000-0000-0000-0000-000000000000')
  throw new Error(
    'Create the Cloudflare D1 database and set its database_id in wrangler.jsonc first.',
  );
const site = new URL(config.vars.NEXT_PUBLIC_SITE_URL || 'https://unconfigured.invalid');
if (
  site.protocol !== 'https:' ||
  site.origin !== config.vars.NEXT_PUBLIC_SITE_URL ||
  site.hostname.endsWith('.invalid')
)
  throw new Error('Set vars.NEXT_PUBLIC_SITE_URL to the exact HTTPS Cloudflare site origin first.');
console.log('Deployment configuration is ready.');

````

### File: scripts/deploy-cloudflare.mjs

SHA-256: `b741f987a21d5ef410a3e5d839959837d8d83b99f4d417ca0401524009f5453b`

````javascript
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/,\s*([}\]])/g, '$1'));
if (!config.account_id) throw new Error('Set account_id in wrangler.jsonc before deploying.');
// OpenNext's generated Wrangler config can omit account_id. Carry the selected
// account through every CLI invocation, including D1 migrations, explicitly.
const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: config.account_id };
const steps = [
  ['scripts/check-deployment.mjs'],
  ['scripts/build-cloudflare.mjs'],
  [
    'node_modules/wrangler/bin/wrangler.js',
    'd1',
    'migrations',
    'apply',
    'DB',
    '--remote',
    '--config',
    'wrangler.jsonc',
  ],
  ['node_modules/@opennextjs/cloudflare/dist/cli/index.js', 'deploy'],
  ['scripts/indexnow.mjs'],
];
for (const args of steps) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

````

### File: scripts/export-report.mjs

SHA-256: `9c7c1d9e371fbdbfcac96eba78249f78990c26adaa5fc3a2d69dda01d9bfb4d4`

````javascript
import { existsSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const options = {};
// Positional arguments also work through npm.ps1, which can consume named flags.
if (args.length && !args[0].startsWith('--')) {
  if (args.length < 2 || args.length > 4 || (args[2] && !['summary', 'details'].includes(args[2])))
    throw new Error(
      'Usage: npm run report -- YYYY-MM-DD YYYY-MM-DD [summary|details] [artifacts/report.json]',
    );
  options.from = args[0];
  options.to = args[1];
  options.details = args[2] === 'details';
  options.out = args[3];
  args.length = 0;
}
for (let index = 0; index < args.length; index++) {
  const key = args[index];
  if (key === '--details') options.details = true;
  else if (['--from', '--to', '--out'].includes(key) && args[index + 1])
    options[key.slice(2)] = args[++index];
  else
    throw new Error(
      'Usage: npm run report -- --from YYYY-MM-DD --to YYYY-MM-DD [--details] [--out artifacts/report.json]',
    );
}
function date(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new Error('Both --from and --to must be valid YYYY-MM-DD dates (South African time).');
  return value;
}
const from = date(options.from);
const to = date(options.to);
if (from > to) throw new Error('--from must be on or before --to.');
const output = resolve(options.out || `artifacts/report-${from}-${to}-${Date.now()}.json`);
if (existsSync(output) || existsSync(output + '.tmp'))
  throw new Error('Output already exists; choose another --out path.');
function query(sql) {
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'execute',
      'DB',
      '--remote',
      '--json',
      '--command',
      sql,
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.error || result.status !== 0)
    throw new Error(
      'D1 report query failed. Check wrangler login and the configured account/database.',
    );
  const data = JSON.parse(result.stdout);
  if (!Array.isArray(data) || data.some((row) => row.success !== true))
    throw new Error('D1 returned an unsuccessful query.');
  return data.flatMap((row) => row.results);
}
const start = Date.parse(`${from}T00:00:00+02:00`);
const end = Date.parse(`${to}T00:00:00+02:00`) + 86400000;
const summary = query(
  `SELECT * FROM lead_daily_summary WHERE submitted_date_sa >= '${from}' AND submitted_date_sa <= '${to}' ORDER BY submitted_date_sa, delivery_status, leadbyte_code`,
);
const report = {
  generatedAt: new Date().toISOString(),
  from,
  to,
  timezone: 'Africa/Johannesburg',
  summary,
};
if (options.details) {
  const leads = [];
  let cursor = -1;
  let cursorId = '';
  while (true) {
    // IDs come from server-generated UUIDs, not user input. Still quote defensively.
    const escapedId = cursorId.replaceAll("'", "''");
    const page =
      query(`SELECT request_id, created_at, completed_at, submitted_at_utc, submitted_date_sa,
      firstname, lastname, email, phone1, optinurl, optindate, acceptterms, consent_version,
      offer_id, campaign_id, supplier_id, preferredtimeofcall, qualification_json,
      attribution_json, affiliate_id, transaction_id, utm_source, utm_campaign, payload_json,
      delivery_status, leadbyte_code, leadbyte_code_description, leadbyte_lead_id,
      leadbyte_response, leadbyte_info_json, leadbyte_raw_response, leadbyte_timestamp,
      leadbyte_process_time, upstream_http_status, http_status, diagnostic_code, delivery_uncertain
      , source, external_lead_id, source_campaign_id, campaign_name, ad_group_id, ad_id, form_id,
      processing_status, retry_count, marketing_consent, consent_text, consent_timestamp, consent_source,
      submitted_at, updated_at, is_test,
      json_extract(metadata_json, '$.acquisitionSource') AS acquisition_source,
      json_extract(attribution_json, '$.msclkid') AS msclkid
      FROM lead_reporting WHERE created_at >= ${start} AND created_at < ${end}
      AND (created_at > ${cursor} OR (created_at = ${cursor} AND request_id > '${escapedId}'))
      ORDER BY created_at, request_id LIMIT 250`);
    leads.push(...page);
    if (page.length < 250) break;
    cursor = page.at(-1).created_at;
    cursorId = page.at(-1).request_id;
  }
  report.leads = leads;
}
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output + '.tmp', JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
renameSync(output + '.tmp', output);
console.log(
  `Saved ${summary.length} summary groups${report.leads ? ` and ${report.leads.length} lead records` : ''} to ${output}`,
);

````

### File: scripts/indexnow.mjs

SHA-256: `a39e958e98b5c8c99aeb897f4314eb5cd710ac5e798d5b380020d6eabbadc88e`

````javascript
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function submissionPayload(config, urls) {
  const site = new URL(config.origin);
  if (site.protocol !== 'https:' || site.origin !== config.origin)
    throw new Error('IndexNow requires an exact HTTPS production origin.');
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(config.key)) throw new Error('Invalid IndexNow key.');
  if (!Array.isArray(urls) || !urls.length || urls.length > 10000)
    throw new Error('Supply between 1 and 10,000 URLs.');
  const urlList = [
    ...new Set(
      urls.map((value) => {
        const url = new URL(value);
        if (url.origin !== site.origin || url.username || url.password || url.hash)
          throw new Error(
            'Submit only URLs on the configured origin, without credentials or fragments.',
          );
        return url.href;
      }),
    ),
  ];
  return {
    host: site.host,
    key: config.key,
    keyLocation: `${site.origin}/${config.key}.txt`,
    urlList,
  };
}

export async function submitIndexNow(config, urls, fetcher = fetch) {
  const payload = submissionPayload(config, urls);
  // Check the deployed ownership file before sending any notification.
  const verification = await fetcher(payload.keyLocation, {
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  if (!verification.ok || (await verification.text()).trim() !== payload.key)
    throw new Error(
      'IndexNow ownership file is not live or does not match. Deploy first, then retry npm run indexnow.',
    );
  const response = await fetcher('https://www.bing.com/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (response.status !== 200 && response.status !== 202)
    throw new Error(
      `IndexNow returned HTTP ${response.status}. The site deployment is unaffected; retry npm run indexnow after resolving the response (wait before retrying 429).`,
    );
  return { status: response.status, count: payload.urlList.length };
}

async function main() {
  const config = JSON.parse(
    readFileSync(new URL('../config/indexnow.json', import.meta.url), 'utf8'),
  );
  const hosting = JSON.parse(
    readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8').replace(
      /,\s*([}\]])/g,
      '$1',
    ),
  );
  if (
    hosting.vars.DEPLOY_ENV !== 'production' ||
    hosting.vars.SITE_INDEXABLE !== 'true' ||
    hosting.vars.NEXT_PUBLIC_SITE_URL !== config.origin
  )
    throw new Error('IndexNow is restricted to the configured indexable production site.');
  if (
    (process.env.DEPLOY_ENV && process.env.DEPLOY_ENV !== 'production') ||
    (process.env.CONTEXT && process.env.CONTEXT !== 'production') ||
    (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production')
  )
    throw new Error('IndexNow notifications are disabled in non-production environments.');
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const supplied = args.filter((arg) => arg !== '--dry-run');
  const urls = supplied.length ? supplied : config.urls;
  const payload = submissionPayload(config, urls);
  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  const result = await submitIndexNow(config, urls);
  console.log(
    `IndexNow: ${result.count} URL(s) ${result.status === 202 ? 'received; key verification pending' : 'received'}. Indexing is at the search engine’s discretion.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

````

### File: scripts/query-report.mjs

SHA-256: `314a94de328f94650f1d031939b27905a2dbfe26634fee9e40f2f61a77ed4e2b`

````javascript
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const files = {
  daily: 'reports/daily.sql',
  issues: 'reports/reconciliation-issues.sql',
  pipeline: 'reports/pipeline-issues.sql',
  microsoft: 'reports/microsoft-ads.sql',
};
const file = files[process.argv[2]];
if (!file) throw new Error('Choose daily, issues, pipeline or microsoft.');
// --command returns SELECT results; Wrangler --file uses a bulk import workflow.
const result = spawnSync(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'd1',
    'execute',
    'DB',
    '--remote',
    `--command=${readFileSync(file, 'utf8')}`,
  ],
  { stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);

````

### File: scripts/reconcile-report.mjs

SHA-256: `50f37f505f2c626328da21bdfe342298b0e1eb497405d8ceb3c7d11540af3b03`

````javascript
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { reconcile } from '../lib/reconciliation.mjs';

const [localPath, vendorPath, outputPath] = process.argv.slice(2);
if (!localPath || !vendorPath || !outputPath)
  throw new Error(
    'Usage: npm run reconcile -- artifacts/local.json artifacts/leadbyte.json artifacts/matches.json',
  );
const local = JSON.parse(readFileSync(localPath, 'utf8'));
const vendor = JSON.parse(readFileSync(vendorPath, 'utf8'));
const output = resolve(outputPath);
if (existsSync(output)) throw new Error('Output already exists; choose a different output path.');
const report = reconcile(local.leads, Array.isArray(vendor) ? vendor : vendor.leads);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(
  output,
  JSON.stringify(
    { generatedAt: new Date().toISOString(), scope: { from: local.from, to: local.to }, ...report },
    null,
    2,
  ) + '\n',
  { flag: 'wx', mode: 0o600 },
);
console.log(`Reconciled ${report.results.length} local records. Results saved to ${output}`);

````

### File: scripts/setup-local.mjs

SHA-256: `8aba480b4a9808cabfc55cd9d37605611cefa746332a980ba7c46e05bdb480f2`

````javascript
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { parse } from 'dotenv';

const read = (file) => (existsSync(file) ? parse(readFileSync(file)) : {});
const current = read('.env.local');
const vars = read('.dev.vars');
const secret = current.LEAD_HASH_SECRET || vars.LEAD_HASH_SECRET || randomBytes(32).toString('hex');
const shared = {
  DEPLOY_PLATFORM: 'cloudflare',
  DEPLOY_ENV: 'development',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  LEADBYTE_ENABLED: 'false',
  SITE_INDEXABLE: 'false',
  LEAD_HASH_SECRET: secret,
  GOOGLE_ADS_WEBHOOK_KEY: vars.GOOGLE_ADS_WEBHOOK_KEY || randomBytes(32).toString('hex'),
  GOOGLE_ADS_FORM_MAPPINGS: vars.GOOGLE_ADS_FORM_MAPPINGS || '{}',
};
const serialize = (values) =>
  Object.entries(values)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join('\n') + '\n';
writeFileSync('.env.local', serialize({ ...current, ...shared }));
writeFileSync('.dev.vars', serialize({ ...vars, ...shared, NEXTJS_ENV: 'development' }));
console.log('Local Cloudflare settings saved. Live lead delivery is disabled.');

````

### File: scripts/test-lead-worker.mjs

SHA-256: `6234ed57d914b1c668c83cb64230aef17fefa7f132b3d331cd3b1675a7e111ec`

````javascript
// Real local workerd + D1 + Queue; all outbound requests are intercepted.
// Uses the Miniflare version bundled with the installed Wrangler.
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare, convertV4MiniflareOptions } = wranglerRequire('miniflare');
const bundle = await build({
  stdin: {
    contents: `import worker from './worker.mjs';
    import { googleWebhook } from './lib/googleWebhook';
    import { microsoftWebhook } from './lib/microsoftWebhook';
    export default { ...worker, fetch(request, env) {
      return new URL(request.url).pathname === '/api/webhooks/microsoft'
        ? microsoftWebhook(request, env) : googleWebhook(request, env);
    } };`,
    resolveDir: process.cwd(),
    sourcefile: 'pipeline-runtime-test.ts',
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  external: ['node:*'],
  plugins: [
    {
      name: 'next-fetch-shim',
      setup(builder) {
        builder.onResolve({ filter: /\.open-next\/worker\.js$/ }, () => ({
          path: 'next-shim',
          namespace: 'test',
        }));
        builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
          contents:
            'export default {fetch(){throw new Error("Next fetch is tested separately")}}; export class DOQueueHandler{}; export class DOShardedTagCache{}; export class BucketCachePurge{};',
        }));
      },
    },
  ],
});
const key = 'synthetic-local-worker-key-at-least-32-characters';
const answers = Object.fromEntries(
  Object.entries({
    age: '18_plus',
    vehicle: 'yes',
    employment: 'employed',
    income: '10000_plus',
    contactConsent: true,
  }).map(([field, value]) => [field, { columnId: field, values: { Yes: value } }]),
);
let affiliateCalls = 0;
const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'pipeline-test',
        modules: true,
        script: bundle.outputFiles[0].text,
        compatibilityDate: '2026-09-15',
        compatibilityFlags: ['nodejs_compat'],
        bindings: {
          LEADBYTE_ENABLED: 'true',
          NEXT_PUBLIC_SITE_URL: 'https://example.com',
          LEAD_HASH_SECRET: 'synthetic-hash-secret-at-least-32-characters',
          GOOGLE_ADS_WEBHOOK_KEY: key,
          MICROSOFT_ADS_WEBHOOK_TOKEN: key,
          GOOGLE_ADS_FORM_MAPPINGS: JSON.stringify({
            100: {
              answers,
              consentText: 'Synthetic contact permission',
              consentVersion: 'test-v1',
            },
          }),
        },
        d1Databases: ['DB'],
        queueProducers: { LEAD_QUEUE: 'bestcardash-leads' },
        queueConsumers: {
          'bestcardash-leads': {
            maxBatchSize: 1,
            maxBatchTimeout: 0,
            maxRetries: 5,
            deadLetterQueue: 'bestcardash-leads-dlq',
          },
          'bestcardash-leads-dlq': { maxBatchSize: 1, maxBatchTimeout: 0 },
        },
        outboundService(request) {
          assert.equal(new URL(request.url).hostname, 'returnxdigital.leadbyte.co.uk');
          affiliateCalls++;
          return Response.json({
            code: 1,
            response: 'Synthetic accepted',
            leadId: 'runtime-test-1',
          });
        },
      },
    ],
  }),
);
try {
  const db = await mf.getD1Database('DB');
  for (const file of readdirSync('migrations')
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    const sql = readFileSync(resolve('migrations', file), 'utf8').replace(/--[^\n]*/g, '');
    await db.batch(
      sql
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => db.prepare(part)),
    );
  }
  const body = {
    lead_id: 'synthetic-runtime-1',
    form_id: 100,
    google_key: key,
    user_column_data: Object.entries({
      FIRST_NAME: 'Test',
      LAST_NAME: 'Testing',
      PHONE_NUMBER: '0821234567',
      ...Object.fromEntries(Object.keys(answers).map((field) => [field, 'Yes'])),
    }).map(([column_id, string_value]) => ({ column_id, string_value })),
  };
  const post = () =>
    mf.dispatchFetch('https://example.com/api/webhooks/google-ads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  assert.equal((await post()).status, 200);
  let row;
  for (let i = 0; i < 100; i++) {
    row = await db.prepare('SELECT processing_status,leadbyte_lead_id FROM submissions').first();
    if (row?.processing_status === 'accepted') break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(row?.processing_status, 'accepted');
  assert.equal(row?.leadbyte_lead_id, 'runtime-test-1');
  assert.equal((await post()).status, 200);
  assert.equal(affiliateCalls, 1);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM submissions').first()).n, 1);
  const microsoftPost = () =>
    mf.dispatchFetch('https://example.com/api/webhooks/microsoft', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        source: 'microsoft_ads',
        externalLeadId: 'synthetic-microsoft-runtime-1',
        fullName: 'Test van der Example',
        email: 'test@example.com',
        phone: '0821234567',
        qualification: {
          age: '18_plus',
          vehicle: 'yes',
          employment: 'employed',
          income: '10000_plus',
        },
        contactConsent: true,
        marketingConsent: false,
        consentText: 'Synthetic contact permission',
        consentVersion: 'test-v1',
      }),
    });
  assert.equal((await microsoftPost()).status, 200);
  for (let i = 0; i < 100; i++) {
    row = await db
      .prepare(
        "SELECT processing_status,metadata_json FROM submissions WHERE source='MICROSOFT_ADS'",
      )
      .first();
    if (row?.processing_status === 'accepted') break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(row?.processing_status, 'accepted');
  assert.equal(JSON.parse(row.metadata_json).fullName, 'Test van der Example');
  assert.equal((await microsoftPost()).status, 200);
  assert.equal(affiliateCalls, 2);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM submissions').first()).n, 2);
  console.log(
    'PASS: real workerd webhook → D1 → Queue → existing affiliate service → D1; duplicate suppressed. No external traffic.',
  );
} finally {
  await mf.dispose();
}

````

### File: tests/browser/landing.spec.ts

SHA-256: `7d2d1ed496273d8e2a553641f059fd0805e73da2c9efccc127b75cec71269310`

````typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const width of [375, 390, 430, 768, 1024, 1280, 1440, 1870]) {
  test(`responsive layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('heading', { name: 'Protect your vehicle' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(page.locator('#quote')).toBeVisible();
    await page.screenshot({
      path: `artifacts/landing-${width}.png`,
      fullPage: true,
      caret: 'initial',
    });
  });
}
test('has no automated WCAG A/AA violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
test('shows revised pricing and a single disclaimer below the CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('From as little as R7 per day. Terms apply.')).toBeVisible();
  await expect(
    page.getByText(
      'By submitting this form, I confirm that I am 18 or older, have access to a vehicle and am employed.',
      { exact: false },
    ),
  ).toBeVisible();
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
});
test('invalid submission shows inline messages without a network request', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/leads', (route) => {
    requests++;
    return route.abort();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'CALL ME BACK' }).click();
  await expect(page.locator('#firstname-error')).toBeVisible();
  expect(requests).toBe(0);
});
async function fillContact(page: import('@playwright/test').Page) {
  await page.getByLabel('First name', { exact: true }).fill('Test');
  await page.getByLabel('Last name', { exact: true }).fill('Testing');
  await page.getByLabel('South African mobile number').fill('0821234567');
  await page.getByLabel('Email address').fill('test@example.com');
}
const thankYouHeading = /Thank you for your application/;

test('Bing click attribution survives navigation and reaches the website lead request', async ({
  page,
}) => {
  const clickId = '0123456789abcdef0123456789abcdef';
  await page.route('**/api/leads', async (route) => {
    expect(route.request().postDataJSON().attribution).toMatchObject({
      msclkid: clickId,
      utm_source: 'bing',
      utm_medium: 'cpc',
      ms_campaign_id: '123',
      ms_adgroup_id: '456',
      ms_ad_id: '789',
    });
    await route.fulfill({
      json: { state: 'success', message: 'Received', diagnostics: { code: 'LEAD_RECEIVED' } },
    });
  });
  await page.goto(
    `/?utm_source=bing&utm_medium=cpc&msclkid=${clickId}&ms_campaign_id=123&ms_adgroup_id=456&ms_ad_id=789`,
  );
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('cartrack-attribution')))
    .toContain(clickId);
  await page.goto('/');
  await fillContact(page);
  await page.getByRole('button', { name: 'CALL ME BACK' }).click();
  await expect(page.getByRole('heading', { name: thankYouHeading })).toBeVisible();
});

test('accepted submission shows reference thank-you screen and prevents repeat delivery', async ({
  page,
}) => {
  let requests = 0;
  await page.route('**/api/leads', async (route) => {
    requests++;
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({
      firstname: 'Test',
      email: 'test@example.com',
      phone: '+27821234567',
      age: '18_plus',
      vehicle: 'yes',
      employment: 'employed',
      income: '10000_plus',
      eligibilityConfirmed: true,
      terms: true,
      attribution: { transaction_id: 'browser-test', offer_id: '999' },
    });
    expect(body).not.toHaveProperty('offer_id');
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      json: {
        state: 'success',
        message: 'Accepted',
        diagnostics: { code: 'LEADBYTE_SUCCESS', leadByteCode: 1 },
      },
    });
  });
  await page.goto('/?transaction_id=browser-test&offer_id=999');
  await fillContact(page);
  await page.getByRole('button', { name: 'CALL ME BACK' }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(page.getByRole('heading', { name: thankYouHeading })).toBeVisible();
  await expect(page.getByRole('heading', { name: thankYouHeading })).toBeFocused();
  await expect(page.getByRole('button', { name: 'CALL ME BACK' })).toHaveCount(0);
  expect(requests).toBe(1);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
  for (const width of [1887, 390]) {
    await page.setViewportSize({ width, height: 858 });
    await page.screenshot({ path: `artifacts/thank-you-${width}.png`, fullPage: true });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.reload();
  await fillContact(page);
  await page.getByRole('button', { name: 'CALL ME BACK' }).click();
  await expect(page.getByRole('heading', { name: thankYouHeading })).toBeVisible();
  expect(requests).toBe(1);
});

test('single-step form requires email', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/leads', (route) => {
    requests++;
    return route.abort();
  });
  await page.goto('/');
  await fillContact(page);
  await page.getByLabel('Email address').fill('');
  await page.getByRole('button', { name: 'CALL ME BACK' }).click();
  await expect(page.locator('#email-error')).toBeVisible();
  expect(requests).toBe(0);
  await expect(page.getByRole('heading', { name: thankYouHeading })).toHaveCount(0);
});

test('duplicate response keeps the form editable and resubmits changed details', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/leads', async (route) => {
    requests++;
    if (requests === 1) {
      await route.fulfill({
        status: 409,
        json: { state: 'duplicate', message: 'Already submitted.', duplicateFields: ['email'] },
      });
      return;
    }
    await route.fulfill({ json: { state: 'success', message: 'Accepted' } });
  });
  await page.goto('/');
  await fillContact(page);
  await page.getByRole('button', { name: 'CALL ME BACK' }).click();
  await expect(page.locator('#email-error')).toHaveText('This detail has already been submitted.');
  await expect(page.getByLabel('Email address')).toBeEnabled();
  await page.getByLabel('Email address').fill('different@example.com');
  await expect(page.locator('#email-error')).toHaveCount(0);
  await expect(page.getByRole('status')).not.toContainText('Already submitted.');
  await page.getByRole('button', { name: 'CALL ME BACK' }).click();
  await expect(page.getByRole('heading', { name: thankYouHeading })).toBeVisible();
  expect(requests).toBe(2);
});

for (const result of [
  { status: 409, state: 'duplicate', message: 'Already submitted.' },
  { status: 503, state: 'temporary_error', message: 'Please try again later.' },
  { status: 422, state: 'api_rejected', message: 'Campaign unavailable.' },
  { status: 503, state: 'success', message: 'Invalid success response.' },
]) {
  test(`does not show thank-you for ${result.status} ${result.state}`, async ({ page }) => {
    await page.route('**/api/leads', (route) =>
      route.fulfill({ status: result.status, json: result }),
    );
    await page.goto('/');
    await fillContact(page);
    await page.getByRole('button', { name: 'CALL ME BACK' }).click();
    await expect(page.getByRole('status')).toContainText(result.message);
    await expect(page.getByRole('heading', { name: thankYouHeading })).toHaveCount(0);
  });
}

````

### File: tests/d1Fixture.ts

SHA-256: `ba2dd852f0999888e5559d09470c5d042c00e126e2c62ec559cf62b9a9ebe690`

````typescript
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

// Execute production SQL against SQLite rather than mocking query outcomes.
export function createTestDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  const directory = new URL('../migrations/', import.meta.url);
  for (const file of readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort())
    sqlite.exec(readFileSync(new URL(file, directory), 'utf8'));
  function prepare(sql: string) {
    let values: (string | number | null)[] = [];
    return {
      bind(...args: (string | number | null)[]) {
        values = args;
        return this;
      },
      async first() {
        return sqlite.prepare(sql).get(...values) || null;
      },
      all() {
        return { results: sqlite.prepare(sql).all(...values), success: true };
      },
      async run() {
        const result = sqlite.prepare(sql).run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      },
    };
  }
  return {
    sqlite,
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      sqlite.exec('BEGIN');
      try {
        const result = [];
        for (const statement of statements) result.push(statement.all());
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

````

### File: tests/database.test.ts

SHA-256: `6633d46584f92f23ee86bc3e2bd78fda27eeebd53e944c663e25f136f979233b`

````typescript
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createTestDatabase } from './d1Fixture';
import { claimSubmission, completeSubmission } from '../lib/submissions';
import { rateLimit } from '../lib/rateLimit';
import { digest } from '../lib/logger';
import { cleanupDatabase } from '../lib/databaseMaintenance';
import type { D1Database } from '@cloudflare/workers-types';

const state = vi.hoisted(() => ({ db: null as ReturnType<typeof createTestDatabase> | null }));
vi.mock('../lib/database', () => ({
  database: async () => {
    if (!state.db) throw new Error('Database unavailable');
    return state.db;
  },
}));
beforeEach(() => {
  state.db = createTestDatabase();
});
afterEach(() => {
  state.db?.sqlite.close();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it('serializes concurrent attempts and preserves the original fingerprint', async () => {
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) => claimSubmission('same', `fingerprint-${i}`)),
  );
  expect(results.filter((result) => result.claimed)).toHaveLength(1);
  const replay = await claimSubmission('same', 'changed');
  expect(!replay.claimed && replay.existing.fingerprint).toBe('fingerprint-0');
});
it('keeps pending deliveries claimed beyond the old 30-minute memory window', async () => {
  vi.useFakeTimers();
  await claimSubmission('pending', 'fingerprint');
  vi.advanceTimersByTime(60 * 60 * 1000);
  expect((await claimSubmission('pending', 'fingerprint')).claimed).toBe(false);
});
it('never overwrites a completed outcome', async () => {
  await claimSubmission('done', 'fingerprint');
  await completeSubmission('done', { state: 'success', message: 'Received' }, 200);
  await expect(
    completeSubmission('done', { state: 'temporary_error', message: 'Failed' }, 503),
  ).rejects.toThrow();
  const replay = await claimSubmission('done', 'fingerprint');
  expect(!replay.claimed && replay.existing.httpStatus).toBe(200);
});
it('enforces a shared concurrent rate limit and resets in a new window', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  vi.stubEnv('DEPLOY_PLATFORM', 'cloudflare');
  vi.stubEnv('RATE_LIMIT_MAX', '3');
  const request = new Request('https://example.com', {
    headers: { 'cf-connecting-ip': '192.0.2.1' },
  });
  const results = await Promise.all(Array.from({ length: 20 }, () => rateLimit(request)));
  expect(results.filter((result) => result.allowed)).toHaveLength(3);
  vi.advanceTimersByTime(600000);
  expect((await rateLimit(request)).allowed).toBe(true);
});
it('fails closed when the database cannot be reached', async () => {
  state.db?.sqlite.close();
  state.db = null;
  await expect(claimSubmission('key', 'fp')).rejects.toThrow();
  await expect(rateLimit(new Request('https://example.com'))).rejects.toThrow();
});
it('uses a stable configured hash secret and refuses missing production secrets', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('LEAD_HASH_SECRET', 'a-stable-test-secret-of-at-least-32-characters');
  expect(digest('same')).toBe(digest('same'));
  vi.stubEnv('LEAD_HASH_SECRET', '');
  expect(() => digest('same')).toThrow('CONFIG_HASH_SECRET_REQUIRED');
});
it('daily cleanup removes rate buckets but preserves lead history and pending claims', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1800000000000);
  await claimSubmission('old-pending', 'fingerprint');
  await rateLimit(new Request('https://example.com'));
  vi.advanceTimersByTime(365 * 86400000);
  await claimSubmission('new-pending', 'fingerprint');
  await cleanupDatabase(state.db as unknown as D1Database);
  expect(state.db?.sqlite.prepare('SELECT COUNT(*) AS count FROM submissions').get()).toEqual({
    count: 2,
  });
  expect(state.db?.sqlite.prepare('SELECT * FROM rate_limits').all()).toHaveLength(0);
});

````

### File: tests/diagnostics.test.ts

SHA-256: `f37c69c447459c7697ad288df4c7498ee8e0e0e4c1056cdaeef2fa9d37890232`

````typescript
import { afterEach, expect, it, vi } from 'vitest';
import { ConfigurationError, reportDiagnostic } from '../lib/diagnostics';
import { submissionConfig } from '../lib/config';
import { GET } from '../app/api/leads/route';
import { parseLeadByte, submitLead } from '../lib/leadbyte';
import { valid } from './fixtures';
import { checkDatabase } from '../lib/database';
vi.mock('../lib/database', () => ({ checkDatabase: vi.fn().mockResolvedValue(undefined) }));
it('readiness fails if the database is unavailable without exposing its error', async () => {
  production();
  vi.mocked(checkDatabase).mockRejectedValueOnce(new Error('private database details'));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain('private database details');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
function production() {
  vi.stubEnv('LEAD_HASH_SECRET', 'test-only-secret-at-least-32-characters');
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.netlify.app');
  vi.stubEnv('LEADBYTE_ENABLED', 'true');
  vi.stubEnv('CAMPAIGN_OPERATOR_NAME', 'Test operator');
  vi.stubEnv('PRIVACY_CONTACT_EMAIL', 'test@example.com');
}
it('uses the owner-supplied identity when Netlify operator settings are empty', async () => {
  production();
  vi.stubEnv('CAMPAIGN_OPERATOR_NAME', '');
  vi.stubEnv('PRIVACY_CONTACT_EMAIL', '');
  const response = await GET();
  expect(response.status).toBe(200);
  expect((await response.json()).diagnostics.code).toBe('READY');
});
it('reports an invalid privacy email override specifically', () => {
  production();
  vi.stubEnv('PRIVACY_CONTACT_EMAIL', 'not-an-email');
  expect(submissionConfig).toThrow(new ConfigurationError('CONFIG_PRIVACY_EMAIL_REQUIRED'));
});
it('reports localhost production configuration specifically', () => {
  production();
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
  expect(submissionConfig).toThrow(new ConfigurationError('CONFIG_SITE_URL_REQUIRED'));
});
it('readiness does not make any network call or expose configuration values', async () => {
  production();
  const spy = vi.spyOn(globalThis, 'fetch');
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    ready: true,
    diagnostics: { code: 'READY', requestId: expect.any(String) },
  });
  expect(spy).not.toHaveBeenCalled();
});
it('console diagnostics discard all contact details and vendor response text', () => {
  const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
  reportDiagnostic(
    { code: 'LEADBYTE_REJECTED', leadByteCode: -5, phone: valid.phone, response: 'private' },
    422,
  );
  expect(spy).toHaveBeenCalledWith('[CarTrack lead diagnostic]', {
    code: 'LEADBYTE_REJECTED',
    leadByteCode: -5,
    httpStatus: 422,
  });
});
it('distinguishes malformed vendor output', () =>
  expect(parseLeadByte('invalid').diagnosticCode).toBe('LEADBYTE_MALFORMED_RESPONSE'));
it('distinguishes upstream HTTP errors', async () => {
  const result = await submitLead(
    valid,
    new Date(),
    vi.fn().mockResolvedValue(new Response('private body', { status: 502 })),
  );
  expect(result.diagnosticCode).toBe('LEADBYTE_HTTP_ERROR');
  expect(result.upstreamStatus).toBe(502);
  expect(result.response).toBeUndefined();
});
it('distinguishes network failures', async () => {
  expect(
    (await submitLead(valid, new Date(), vi.fn().mockRejectedValue(new Error('secret'))))
      .diagnosticCode,
  ).toBe('LEADBYTE_NETWORK_ERROR');
});
it('distinguishes timeout', async () => {
  vi.stubEnv('LEADBYTE_TIMEOUT_MS', '10');
  expect(
    (
      await submitLead(
        valid,
        new Date(),
        vi.fn(() => new Promise<Response>(() => {})),
      )
    ).diagnosticCode,
  ).toBe('LEADBYTE_TIMEOUT');
});

````

### File: tests/fixtures.ts

SHA-256: `775b1da5cf39b02b32e984811eb1e20feb31ee9026334e815338d6e3cea62eec`

````typescript
// Synthetic fixture for mocked tests only. No automated test submits to LeadByte.
export const valid = {
  firstname: 'Test',
  lastname: 'Testing',
  phone: '+27821234567',
  age: '18_plus',
  vehicle: 'yes',
  employment: 'employed',
  income: '10000_19999',
  terms: true,
  preferredtimeofcall: '',
  website: '',
};

````

### File: tests/hosting.test.ts

SHA-256: `3eef3e27c85afa9511707521fdf445b54564b0bf02de4fe7a4014b96afc6a988`

````typescript
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clientAddress, isIndexable } from '../lib/hosting';

beforeEach(() => {
  for (const name of [
    'SITE_INDEXABLE',
    'CONTEXT',
    'VERCEL_ENV',
    'VERCEL',
    'DEPLOY_PLATFORM',
    'DEPLOY_ENV',
  ])
    vi.stubEnv(name, '');
});
it('uses only the Cloudflare client header on Cloudflare', () => {
  vi.stubEnv('DEPLOY_PLATFORM', 'cloudflare');
  expect(
    clientAddress(
      new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '192.0.2.1',
          'x-forwarded-for': 'spoofed',
        },
      }),
    ),
  ).toBe('192.0.2.1');
});
it('requires explicit production indexing on Cloudflare', () => {
  vi.stubEnv('DEPLOY_PLATFORM', 'cloudflare');
  vi.stubEnv('SITE_INDEXABLE', 'true');
  vi.stubEnv('DEPLOY_ENV', 'preview');
  expect(isIndexable()).toBe(false);
  vi.stubEnv('DEPLOY_ENV', 'production');
  expect(isIndexable()).toBe(true);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('allows indexing only for explicitly enabled Netlify production', () => {
  vi.stubEnv('SITE_INDEXABLE', 'true');
  vi.stubEnv('CONTEXT', 'production');
  expect(isIndexable()).toBe(true);
});
it('keeps Netlify previews noindex even with conflicting Vercel configuration', () => {
  vi.stubEnv('SITE_INDEXABLE', 'true');
  vi.stubEnv('CONTEXT', 'deploy-preview');
  vi.stubEnv('VERCEL_ENV', 'production');
  expect(isIndexable()).toBe(false);
});
it('keeps local builds and disabled production noindex', () => {
  expect(isIndexable()).toBe(false);
  vi.stubEnv('CONTEXT', 'production');
  expect(isIndexable()).toBe(false);
});
it('uses Netlify client IP rather than spoofable forwarded-for', () => {
  vi.stubEnv('DEPLOY_PLATFORM', 'netlify');
  expect(
    clientAddress(
      new Request('https://example.com', {
        headers: { 'x-nf-client-connection-ip': '192.0.2.1', 'x-forwarded-for': 'fake' },
      }),
    ),
  ).toBe('192.0.2.1');
});
it('does not trust Netlify headers on a local server', () => {
  expect(
    clientAddress(
      new Request('http://localhost', { headers: { 'x-nf-client-connection-ip': 'fake' } }),
    ),
  ).toBe('local-shared');
});

````

### File: tests/indexnow.test.ts

SHA-256: `e274253ed412d08e3f80e9dfedefde5dbe2be70fd29ba983c60317c968101fbc`

````typescript
import { describe, expect, it, vi } from 'vitest';
import { submissionPayload, submitIndexNow } from '../scripts/indexnow.mjs';
import config from '../config/indexnow.json';
import { readFileSync } from 'node:fs';

describe('IndexNow', () => {
  it('ships a matching root ownership file and submits canonical URLs once', () => {
    expect(readFileSync(`public/${config.key}.txt`, 'utf8').trim()).toBe(config.key);
    expect(submissionPayload(config, [config.origin, `${config.origin}/`]).urlList).toEqual(
      config.urls,
    );
  });
  it.each(['https://other.example/', `${config.origin}/#x`, 'https://user:pass@bestcardash.com/'])(
    'rejects unsafe URL %s',
    (url) => {
      expect(() => submissionPayload(config, [url])).toThrow();
    },
  );
  it('rejects invalid batches and keys', () => {
    expect(() => submissionPayload(config, [])).toThrow();
    expect(() => submissionPayload(config, Array(10001).fill(config.origin))).toThrow();
    expect(() => submissionPayload({ ...config, key: '' }, config.urls)).toThrow();
  });
  it.each([200, 202])(
    'verifies ownership before submitting a bulk request (%s)',
    async (status) => {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(new Response(config.key))
        .mockResolvedValueOnce(new Response(null, { status }));
      expect(await submitIndexNow(config, config.urls, fetcher)).toEqual({ status, count: 1 });
      expect(fetcher.mock.calls[0][0]).toBe(`${config.origin}/${config.key}.txt`);
      expect(fetcher.mock.calls[1][0]).toBe('https://www.bing.com/indexnow');
      expect(JSON.parse(fetcher.mock.calls[1][1].body).urlList).toEqual(config.urls);
    },
  );
  it('does not notify Bing when the deployed key is missing or stale', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('wrong key'));
    await expect(submitIndexNow(config, config.urls, fetcher)).rejects.toThrow('ownership file');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('reports throttling as a failure without an immediate retry loop', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(config.key))
      .mockResolvedValueOnce(new Response(null, { status: 429 }));
    await expect(submitIndexNow(config, config.urls, fetcher)).rejects.toThrow('HTTP 429');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

````

### File: tests/leadPipeline.test.ts

SHA-256: `128c4f0537f4663351c035bb3fc9868941ab67be9bb5b4237b88247e2809bbf4`

````typescript
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type { MessageBatch } from '@cloudflare/workers-types';
import { createTestDatabase } from './d1Fixture';
import { googleWebhook } from '../lib/googleWebhook';
import { googleLeadMapper, type GoogleMappings } from '../lib/googleLeadMapper';
import { consumeLeads } from '../lib/leadConsumer';
import { recoverOutbox } from '../lib/leadService';
import type { LeadBindings, LeadJob } from '../lib/leadBindings';
import { submitLead } from '../lib/leadbyte';

let db: ReturnType<typeof createTestDatabase>;
let env: LeadBindings;
const queue = vi.fn();
const secret = 'synthetic-test-webhook-secret-at-least-32-characters';
const mappings: GoogleMappings = {
  '100': {
    answers: {
      age: { columnId: 'AGE', values: { Yes: '18_plus', No: 'under_18' } },
      vehicle: { columnId: 'VEHICLE', values: { Yes: 'yes', No: 'no' } },
      employment: { columnId: 'EMPLOYMENT', values: { Yes: 'employed', No: 'unemployed' } },
      income: { columnId: 'INCOME', values: { Yes: '10000_plus', No: 'under_10000' } },
      contactConsent: { columnId: 'CONTACT', values: { Yes: true, No: false } },
      marketingConsent: { columnId: 'MARKETING', values: { Yes: true, No: false } },
    },
    consentText: 'Synthetic test contact permission',
    consentVersion: 'test-v1',
  },
};
function payload(overrides: Record<string, unknown> = {}) {
  return {
    lead_id: 'synthetic-google-001',
    google_key: secret,
    form_id: 100,
    campaign_id: 200,
    adgroup_id: 300,
    creative_id: 400,
    lead_submit_time: '2026-09-20T10:00:00Z',
    user_column_data: Object.entries({
      FIRST_NAME: ' Test ',
      LAST_NAME: 'van der Testing',
      EMAIL: 'test@example.com ',
      PHONE_NUMBER: '0821234567',
      AGE: 'Yes',
      VEHICLE: 'Yes',
      EMPLOYMENT: 'Yes',
      INCOME: 'Yes',
      CONTACT: 'Yes',
      MARKETING: 'No',
    }).map(([column_id, string_value]) => ({ column_id, string_value })),
    ...overrides,
  };
}
function request(data: unknown = payload()) {
  return new Request('https://example.com/api/webhooks/google-ads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof data === 'string' ? data : JSON.stringify(data),
  });
}
function row() {
  return db.sqlite.prepare('SELECT * FROM submissions').get()!;
}
function job(leadId = String(row().submission_key), queueName = 'bestcardash-leads') {
  const message = { id: crypto.randomUUID(), body: { leadId }, ack: vi.fn(), retry: vi.fn() };
  return {
    message,
    batch: { queue: queueName, messages: [message] } as unknown as MessageBatch<LeadJob>,
  };
}
beforeEach(() => {
  db = createTestDatabase();
  queue.mockReset();
  queue.mockResolvedValue(undefined);
  env = {
    DB: db,
    LEAD_QUEUE: { send: queue },
    GOOGLE_ADS_WEBHOOK_KEY: secret,
    GOOGLE_ADS_FORM_MAPPINGS: JSON.stringify(mappings),
  } as unknown as LeadBindings;
  vi.stubEnv('LEADBYTE_ENABLED', 'true');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com');
  vi.stubEnv('LEAD_HASH_SECRET', 'synthetic-test-secret-at-least-32-characters');
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  db.sqlite.close();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it('maps identifiers, contact fields, exact answers and separate consent without inventing data', () => {
  expect(googleLeadMapper(payload(), mappings)).toMatchObject({
    source: 'GOOGLE_ADS',
    externalLeadId: 'synthetic-google-001',
    campaignId: '200',
    formId: '100',
    adGroupId: '300',
    adId: '400',
    contactConsent: true,
    marketingConsent: false,
    qualification: { age: '18_plus', vehicle: 'yes', employment: 'employed', income: '10000_plus' },
    consentVersion: 'test-v1',
  });
  expect(googleLeadMapper(payload(), {})).toMatchObject({
    contactConsent: null,
    marketingConsent: null,
    qualification: {},
  });
});
it('preserves multipart surnames and leaves a mononym incomplete', () => {
  const lead = (name: string) =>
    googleLeadMapper(
      payload({ user_column_data: [{ column_id: 'FULL_NAME', string_value: name }] }),
    );
  expect(lead('Test van der Testing')).toMatchObject({
    firstname: 'Test',
    lastname: 'van der Testing',
  });
  expect(lead('Test').lastname).toBeUndefined();
});
it('persists before queueing; queue and logs contain no customer data or credentials', async () => {
  queue.mockImplementation(async (message) => {
    expect(row().phone1).toBe('+27821234567');
    expect(db.sqlite.prepare('SELECT * FROM lead_outbox').get()).toBeTruthy();
    expect(Object.keys(message)).toEqual(['leadId']);
  });
  expect((await googleWebhook(request(), env)).status).toBe(200);
  expect(row()).toMatchObject({
    email: 'test@example.com',
    processing_status: 'queued',
    marketing_consent: 0,
  });
  const event = db.sqlite.prepare('SELECT * FROM webhook_events').get()!;
  expect(event.processing_status).toBe('QUEUED');
  expect(String(event.payload_json)).not.toContain(secret);
  expect(String(event.payload_json)).toContain('PHONE_NUMBER');
  expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toMatch(
    /test@example.com|27821234567|synthetic-test-webhook/,
  );
});
it('deduplicates concurrent webhooks at database level and keeps each audit receipt', async () => {
  const responses = await Promise.all(
    Array.from({ length: 10 }, () => googleWebhook(request(), env)),
  );
  expect(responses.every((r) => r.status === 200)).toBe(true);
  expect(db.sqlite.prepare('SELECT count(*) n FROM submissions').get()?.n).toBe(1);
  expect(
    db.sqlite
      .prepare("SELECT count(*) n FROM webhook_events WHERE processing_status='DUPLICATE'")
      .get()?.n,
  ).toBe(9);
  expect(() =>
    db.sqlite
      .prepare(
        'INSERT INTO submissions(submission_key,fingerprint,created_at,expires_at,consent_version,source,external_lead_id) VALUES (?,?,?,?,?,?,?)',
      )
      .run('other', 'fp', 0, 0, '', 'GOOGLE_ADS', 'synthetic-google-001'),
  ).toThrow();
});
it.each([
  ['invalid authentication', payload({ google_key: 'wrong' }), 403],
  ['malformed JSON', '{', 400],
  ['oversize body', 'x'.repeat(66000), 400],
  ['invalid shape', payload({ user_column_data: null }), 400],
])('rejects %s', async (_name, data, status) => {
  expect((await googleWebhook(request(data), env)).status).toBe(status);
  expect(queue).not.toHaveBeenCalled();
  expect(db.sqlite.prepare('SELECT count(*) n FROM submissions').get()?.n).toBe(0);
});
it('fails closed without configured key', async () => {
  env.GOOGLE_ADS_WEBHOOK_KEY = undefined;
  expect((await googleWebhook(request(), env)).status).toBe(503);
});
it('preserves 64-bit Google IDs without numeric rounding', async () => {
  const body = JSON.stringify(payload()).replace(
    '"campaign_id":200',
    '"campaign_id":9223372036854775807',
  );
  expect((await googleWebhook(request(body), env)).status).toBe(200);
  expect(row().source_campaign_id).toBe('9223372036854775807');
});
it('rolls back the lead when its transactional outbox cannot be written', async () => {
  db.sqlite.exec(
    "CREATE TRIGGER fail_outbox BEFORE INSERT ON lead_outbox BEGIN SELECT RAISE(ABORT, 'test failure'); END",
  );
  expect((await googleWebhook(request(), env)).status).toBe(503);
  expect(db.sqlite.prepare('SELECT count(*) n FROM submissions').get()?.n).toBe(0);
  expect(queue).not.toHaveBeenCalled();
});
it('does not treat negative contact consent as permission', async () => {
  const body = payload();
  body.user_column_data.find((field) => field.column_id === 'CONTACT')!.string_value = 'No';
  await googleWebhook(request(body), env);
  expect(row()).toMatchObject({ processing_status: 'rejected', acceptterms: 'false' });
  expect(queue).not.toHaveBeenCalled();
});
it('does not send unrecognised qualification answers', async () => {
  const body = payload();
  body.user_column_data.find((field) => field.column_id === 'AGE')!.string_value = 'Maybe';
  await googleWebhook(request(body), env);
  expect(row().processing_status).toBe('pending_review');
  expect(queue).not.toHaveBeenCalled();
});
it('stores unmapped fields and unknown consent for review without queueing', async () => {
  env.GOOGLE_ADS_FORM_MAPPINGS = '{}';
  expect((await googleWebhook(request(), env)).status).toBe(200);
  expect(row()).toMatchObject({
    processing_status: 'pending_review',
    acceptterms: null,
    marketing_consent: null,
  });
  expect(queue).not.toHaveBeenCalled();
});
it('unrecognised answer and absent consent version never qualify', async () => {
  const config = structuredClone(mappings);
  delete config['100'].consentVersion;
  env.GOOGLE_ADS_FORM_MAPPINGS = JSON.stringify(config);
  await googleWebhook(request(), env);
  expect(row().processing_status).toBe('pending_review');
  expect(queue).not.toHaveBeenCalled();
});
it('never delivers Google test leads even if completely qualified', async () => {
  await googleWebhook(request(payload({ is_test: true })), env);
  expect(row().processing_status).toBe('test');
  expect(queue).not.toHaveBeenCalled();
  const { batch, message } = job();
  const send = vi.fn();
  await consumeLeads(batch, env, send);
  expect(send).not.toHaveBeenCalled();
  expect(message.ack).toHaveBeenCalled();
});
it('returns 503 when durable persistence fails', async () => {
  db.sqlite.exec('DROP TABLE webhook_events');
  expect((await googleWebhook(request(), env)).status).toBe(503);
  expect(queue).not.toHaveBeenCalled();
});
it('recovers a failed queue send from durable outbox without a provider retry', async () => {
  queue.mockRejectedValueOnce(new Error('queue unavailable'));
  expect((await googleWebhook(request(), env)).status).toBe(200);
  expect(row().processing_status).toBe('pending');
  expect(db.sqlite.prepare('SELECT published_at FROM lead_outbox').get()?.published_at).toBeNull();
  await recoverOutbox(env);
  expect(row().processing_status).toBe('queued');
  expect(queue).toHaveBeenCalledTimes(2);
});
it('saves success and never sends again on concurrent or later delivery', async () => {
  await googleWebhook(request(), env);
  const send = vi
    .fn()
    .mockResolvedValue({
      state: 'success',
      message: 'Received',
      code: 1,
      leadId: 'synthetic-affiliate-1',
    });
  const a = job(),
    b = job();
  await Promise.all([consumeLeads(a.batch, env, send), consumeLeads(b.batch, env, send)]);
  await consumeLeads(job().batch, env, send);
  expect(send).toHaveBeenCalledTimes(1);
  expect(row()).toMatchObject({
    processing_status: 'accepted',
    leadbyte_lead_id: 'synthetic-affiliate-1',
  });
  expect(
    db.sqlite.prepare('SELECT processing_status FROM webhook_events').get()?.processing_status,
  ).toBe('PROCESSED');
});
it.each(['LEADBYTE_TIMEOUT', 'LEADBYTE_NETWORK_ERROR', 'LEADBYTE_HTTP_ERROR'])(
  'retries temporary %s with bounded backoff',
  async (diagnosticCode) => {
    await googleWebhook(request(), env);
    const send = vi
      .fn()
      .mockResolvedValue({
        state: 'temporary_error',
        message: 'Retry',
        diagnosticCode,
        uncertain: diagnosticCode !== 'LEADBYTE_HTTP_ERROR',
      });
    const { batch, message } = job();
    await consumeLeads(batch, env, send);
    expect(message.retry).toHaveBeenCalledWith({ delaySeconds: 60 });
    expect(message.ack).not.toHaveBeenCalled();
    expect(row()).toMatchObject({ processing_status: 'retry', retry_count: 1 });
  },
);
it.each([429, 500, 502, 503, 504, 400, 422, 401])(
  'classifies actual affiliate HTTP %i',
  async (status) => {
    const result = await submitLead(
      {
        firstname: 'Test',
        lastname: 'Testing',
        phone: '+27821234567',
        age: '18_plus',
        vehicle: 'yes',
        employment: 'employed',
        income: '10000_plus',
        terms: true,
        website: '',
        preferredtimeofcall: '',
      },
      new Date(),
      vi.fn().mockResolvedValue(new Response('{}', { status })),
    );
    expect(result.state).toBe(status === 429 || status >= 500 ? 'temporary_error' : 'api_rejected');
  },
);
it('stores permanent rejection and acknowledges without retrying', async () => {
  await googleWebhook(request(), env);
  const send = vi
    .fn()
    .mockResolvedValue({ state: 'api_rejected', message: 'Invalid phone', code: -8 });
  const { batch, message } = job();
  await consumeLeads(batch, env, send);
  await consumeLeads(job().batch, env, send);
  expect(message.ack).toHaveBeenCalled();
  expect(message.retry).not.toHaveBeenCalled();
  expect(send).toHaveBeenCalledTimes(1);
  expect(row()).toMatchObject({ processing_status: 'rejected', leadbyte_code: -8 });
});
it('caps total sends and archives DLQ failures durably before acknowledgement', async () => {
  await googleWebhook(request(), env);
  const send = vi.fn().mockResolvedValue({ state: 'temporary_error', message: 'Retry', code: -3 });
  for (let i = 0; i < 8; i++) await consumeLeads(job().batch, env, send);
  expect(send).toHaveBeenCalledTimes(6);
  expect(row().processing_status).toBe('failed');
  const { batch, message } = job(String(row().submission_key), 'bestcardash-leads-dlq');
  await consumeLeads(batch, env, send);
  expect(row().processing_status).toBe('dead_letter');
  expect(message.ack).toHaveBeenCalled();
  expect(db.sqlite.prepare('SELECT count(*) n FROM lead_dead_letters').get()?.n).toBe(1);
});
it('does not resend after a consumer crashes while an affiliate call might have happened', async () => {
  await googleWebhook(request(), env);
  db.sqlite.exec("UPDATE submissions SET processing_status='processing',lease_until=1");
  const send = vi.fn();
  await consumeLeads(job().batch, env, send);
  expect(send).not.toHaveBeenCalled();
  expect(row().processing_status).toBe('uncertain');
});

````

### File: tests/leadRecording.test.ts

SHA-256: `4cdbd003442e19730d1327cb069f439d33f71ff7ecaa57956a9ee629d73fc8cf`

````typescript
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { LeadResult } from '../lib/leadbyte';
import { createTestDatabase } from './d1Fixture';
import { valid } from './fixtures';
import { POST } from '../app/api/leads/route';
import { consumeLeads } from '../lib/leadConsumer';
import type { LeadBindings, LeadJob } from '../lib/leadBindings';
import type { MessageBatch } from '@cloudflare/workers-types';

const state = vi.hoisted(() => ({
  db: null as ReturnType<typeof createTestDatabase> | null,
  submit: vi.fn(),
  queue: vi.fn(),
}));
vi.mock('../lib/database', () => ({
  database: async () => {
    if (!state.db) throw new Error('Unavailable');
    return state.db;
  },
}));
vi.mock('../lib/leadBindings', () => ({
  leadBindings: async () => ({ DB: state.db, LEAD_QUEUE: { send: state.queue } }),
}));
vi.mock('../lib/leadbyte', async (original) => ({
  ...(await original<typeof import('../lib/leadbyte')>()),
  submitLead: state.submit,
}));
beforeEach(() => {
  state.db = createTestDatabase();
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
  vi.stubEnv('LEADBYTE_ENABLED', 'true');
  vi.stubEnv('RATE_LIMIT_MAX', '100');
  vi.stubEnv('LEAD_HASH_SECRET', 'stable-test-secret-of-at-least-32-characters');
  state.submit.mockReset();
  state.queue.mockReset();
  state.queue.mockResolvedValue(undefined);
});
afterEach(() => {
  state.db?.sqlite.close();
  vi.unstubAllEnvs();
});
const token = 'c402a01d-3f0a-4a5c-a312-34f80b3d3a8d';
function request(overrides = {}) {
  return new Request('http://localhost:3000/api/leads', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({
      ...valid,
      submissionId: token,
      attribution: {
        affiliate_id: 'affiliate',
        transaction_id: 'transaction',
        malicious: 'discard',
      },
      ...overrides,
    }),
  });
}
function row() {
  return state.db!.sqlite.prepare('SELECT * FROM lead_reporting').get()!;
}

it('serializes concurrent website submissions and rejects changed data with the same token', async () => {
  state.submit.mockResolvedValue({ state: 'success', message: 'Received', code: 1 });
  const responses = await Promise.all(Array.from({ length: 5 }, () => POST(request())));
  expect(responses.every((response) => response.status === 200)).toBe(true);
  expect(state.db!.sqlite.prepare('SELECT count(*) n FROM submissions').get()?.n).toBe(1);
  await deliver();
  await deliver();
  expect(state.submit).toHaveBeenCalledTimes(1);
  expect((await POST(request({ firstname: 'Changed' }))).status).toBe(409);
});

it('routes Bing website leads through the shared queue and affiliate service with separate acquisition data', async () => {
  const attribution = {
    utm_source: 'bing',
    utm_medium: 'cpc',
    utm_campaign: 'bestcardash_dashcam',
    msclkid: '0123456789abcdef0123456789abcdef',
    ms_campaign_id: '123',
    ms_adgroup_id: '456',
    ms_ad_id: '789',
  };
  state.submit.mockResolvedValue({
    state: 'success',
    message: 'Received',
    code: 1,
    leadId: 'vendor-123',
  });
  const response = await POST(request({ attribution }));
  expect(response.status).toBe(200);
  expect(state.submit).not.toHaveBeenCalled();
  expect(state.queue).toHaveBeenCalledWith({ leadId: row().submission_key });
  expect(row()).toMatchObject({
    source: 'WEBSITE',
    consent_source: 'WEBSITE',
    marketing_consent: null,
    source_campaign_id: '123',
    campaign_id: 'DASHCAMS',
    ad_group_id: '456',
    ad_id: '789',
  });
  expect(JSON.parse(String(row().metadata_json)).acquisitionSource).toBe('MICROSOFT_ADS');
  const report = state.db!.sqlite.prepare('SELECT * FROM microsoft_ads_leads').get()!;
  expect(report.msclkid).toBe(attribution.msclkid);
  expect(report).not.toHaveProperty('phone1');
  expect(report).not.toHaveProperty('email');
  await deliver();
  expect(row().processing_status).toBe('accepted');
  expect(JSON.parse(String(row().payload_json))).not.toHaveProperty('msclkid');
  expect(state.submit.mock.calls[0][0]).not.toHaveProperty('msclkid');
  // Changing attribution must not create another lead/delivery for the same submission token.
  expect(
    (await POST(request({ attribution: { ...attribution, msclkid: 'a'.repeat(32) } }))).status,
  ).toBe(200);
  await deliver();
  expect(state.submit).toHaveBeenCalledTimes(1);
  expect(state.db!.sqlite.prepare('SELECT msclkid FROM microsoft_ads_leads').get()?.msclkid).toBe(
    attribution.msclkid,
  );
});

it('does not let Bing tracking parameters bypass qualification or create marketing consent', async () => {
  const attribution = {
    utm_source: 'bing',
    utm_medium: 'cpc',
    terms: true,
    marketingConsent: true,
    msclkid: 'a'.repeat(32),
  };
  expect((await POST(request({ terms: false, attribution }))).status).toBe(422);
  expect((await POST(request({ age: 'under_18', attribution }))).status).toBe(422);
  expect(state.queue).not.toHaveBeenCalled();
  expect(state.db!.sqlite.prepare('SELECT count(*) n FROM microsoft_ads_leads').get()?.n).toBe(0);
});

async function deliver() {
  const env = { DB: state.db, LEAD_QUEUE: { send: state.queue } } as unknown as LeadBindings;
  const leadId = String(row().submission_key);
  await consumeLeads(
    {
      queue: 'bestcardash-leads',
      messages: [{ id: crypto.randomUUID(), body: { leadId }, ack: vi.fn(), retry: vi.fn() }],
    } as unknown as MessageBatch<LeadJob>,
    env,
  );
}

it('saves contact, consent, attribution and exact payload before sending, then saves vendor metadata', async () => {
  state.submit.mockImplementation(async () => {
    expect(row()).toMatchObject({
      firstname: valid.firstname,
      lastname: valid.lastname,
      phone1: valid.phone,
      delivery_status: 'pending',
      acceptterms: 'true',
      offer_id: '3046',
      campaign_id: 'DASHCAMS',
      supplier_id: '27144',
      affiliate_id: 'affiliate',
      transaction_id: 'transaction',
    });
    expect(JSON.parse(String(row().payload_json))).toMatchObject({
      phone1: valid.phone,
      offer_id: '3046',
      acceptterms: 'true',
    });
    expect(JSON.parse(String(row().attribution_json))).not.toHaveProperty('malicious');
    return {
      state: 'success',
      message: 'Received',
      code: 1,
      leadId: '123456',
      response: 'OK',
      info: [],
      processTime: 0.12,
      timestamp: '2026-09-15T12:00:00Z',
      upstreamStatus: 200,
      rawResponse: '{"code":1,"leadId":123456,"response":"OK"}',
    } satisfies LeadResult;
  });
  const response = await POST(request());
  expect(state.submit).not.toHaveBeenCalled();
  await deliver();
  expect(response.status).toBe(200);
  expect(row()).toMatchObject({
    delivery_status: 'accepted',
    leadbyte_code: 1,
    leadbyte_lead_id: '123456',
    leadbyte_info_json: '[]',
    leadbyte_process_time: 0.12,
    leadbyte_timestamp: '2026-09-15T12:00:00Z',
    upstream_http_status: 200,
    leadbyte_code_description: 'Accepted',
  });
  const publicResult = await response.json();
  expect(publicResult).not.toHaveProperty('phone1');
  expect(publicResult).not.toHaveProperty('leadId');
  expect(publicResult).not.toHaveProperty('info');
  expect((await POST(request())).status).toBe(200);
  expect(state.submit).toHaveBeenCalledTimes(1);
  expect(state.db!.sqlite.prepare('SELECT COUNT(*) AS count FROM submissions').get()?.count).toBe(
    1,
  );
});
it('retains email before delivery without adding it to the documented vendor payload', async () => {
  state.submit.mockImplementation(async () => {
    expect(row().email).toBe('visitor@example.com');
    const payload = JSON.parse(String(row().payload_json));
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('email1');
    return { state: 'success', message: 'Received', code: 1 };
  });
  expect((await POST(request({ email: 'visitor@example.com' }))).status).toBe(200);
  await deliver();
  expect(state.submit).toHaveBeenCalledTimes(1);
});

it('rejects invalid email before recording or delivery', async () => {
  expect((await POST(request({ email: 'invalid' }))).status).toBe(422);
  expect(state.submit).not.toHaveBeenCalled();
  expect(state.db!.sqlite.prepare('SELECT COUNT(*) AS count FROM submissions').get()?.count).toBe(
    0,
  );
});

it.each([-9, -8, -7, -6, -5, -4, -3, -2, -19, -17, -16, -15, -14, -13, -12, -11, -100, -10])(
  'records failure code %i with its reporting description',
  async (code) => {
    state.submit.mockResolvedValue({
      state: code === -2 ? 'duplicate' : 'api_rejected',
      message: 'Rejected',
      code,
      response: 'HLR rejection',
      info: { status: 'UNDELIV', code: 'EC_UNKNOWN_SUBSCRIBER' },
    });
    await POST(request());
    await deliver();
    expect(row().leadbyte_code).toBe(code);
    expect(row().leadbyte_code_description).toBeTruthy();
    expect(row().delivery_status).toBe(code === -2 ? 'duplicate' : 'rejected');
    expect(JSON.parse(String(row().leadbyte_info_json))).toEqual({
      status: 'UNDELIV',
      code: 'EC_UNKNOWN_SUBSCRIBER',
    });
  },
);
it('retains a locally completed form when delivery is disabled, without calling LeadByte', async () => {
  vi.stubEnv('LEADBYTE_ENABLED', 'false');
  expect((await POST(request())).status).toBe(503);
  expect(row()).toMatchObject({
    phone1: valid.phone,
    delivery_status: 'not_sent_disabled',
    leadbyte_code: null,
  });
  expect(state.submit).not.toHaveBeenCalled();
});
it('keeps ambiguous vendor responses for reconciliation and does not redeliver on replay', async () => {
  state.submit.mockResolvedValue({
    state: 'temporary_error',
    message: 'Unknown',
    uncertain: true,
    diagnosticCode: 'LEADBYTE_MALFORMED_RESPONSE',
  });
  await POST(request());
  await deliver();
  await POST(request());
  await deliver();
  expect(row()).toMatchObject({
    delivery_status: 'uncertain',
    leadbyte_code: null,
    delivery_uncertain: 1,
  });
  expect(state.submit).toHaveBeenCalledTimes(1);
});
it('preserves the pending lead if execution fails after recording', async () => {
  state.submit.mockRejectedValue(new Error('Lost execution'));
  expect((await POST(request())).status).toBe(200);
  await deliver();
  expect(row().delivery_status).toBe('uncertain');
  expect((await POST(request())).status).toBe(200);
  await deliver();
  expect(state.submit).toHaveBeenCalledTimes(1);
});
it('does not send a lead when the record cannot be stored', async () => {
  state.db!.sqlite.exec('DROP VIEW lead_reporting; DROP TABLE submissions');
  expect((await POST(request())).status).toBe(503);
  expect(state.submit).not.toHaveBeenCalled();
});
it('groups daily reports by South African date rather than UTC date', async () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-09-15T22:30:00Z'));
    vi.stubEnv('LEADBYTE_ENABLED', 'false');
    await POST(request());
    expect(row()).toMatchObject({
      submitted_date_sa: '2026-09-16',
      optindate: '16/09/2026 00:30:00',
    });
    expect(
      state.db!.sqlite.prepare('SELECT submitted_date_sa, leads FROM lead_daily_summary').get(),
    ).toEqual({ submitted_date_sa: '2026-09-16', leads: 1 });
  } finally {
    vi.useRealTimers();
  }
});

````

### File: tests/leadbyte.test.ts

SHA-256: `356da71f03ad68b6ebd7e5391bae6692a568c58f3e2234052a3a1abe9bbf9cf2`

````typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPayload, formatSaDate, parseLeadByte, submitLead } from '../lib/leadbyte';
import { submissionConfig } from '../lib/config';
import { valid } from './fixtures';
afterEach(() => vi.unstubAllEnvs());
describe('LeadByte response handling', () => {
  it('retains vendor reporting fields and raw response for reconciliation', async () => {
    const raw = JSON.stringify({
      code: -8,
      response: 'HLR rejection',
      leadId: null,
      info: { status: 'UNDELIV', code: 'EC_UNKNOWN_SUBSCRIBER' },
      timestamp: '2026-09-15T12:00:00Z',
      processTime: 0.77,
    });
    const result = await submitLead(
      valid,
      new Date(),
      vi.fn().mockResolvedValue(new Response(raw)),
    );
    expect(result).toMatchObject({
      code: -8,
      response: 'HLR rejection',
      info: { status: 'UNDELIV', code: 'EC_UNKNOWN_SUBSCRIBER' },
      timestamp: '2026-09-15T12:00:00Z',
      processTime: 0.77,
      rawResponse: raw,
      upstreamStatus: 200,
    });
    expect(result.leadId).toBeUndefined();
  });
  it('never reports success for an HTTP error even if its body claims code 1', async () => {
    const result = await submitLead(
      valid,
      new Date(),
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ code: 1, response: 'OK', leadId: 123 }, { status: 502 }),
        ),
    );
    expect(result).toMatchObject({
      state: 'temporary_error',
      uncertain: true,
      code: 1,
      leadId: '123',
      upstreamStatus: 502,
    });
  });
  it.each([
    [1, 'success'],
    [-2, 'duplicate'],
    [-5, 'api_rejected'],
    [-3, 'temporary_error'],
    [-100, 'temporary_error'],
  ])('handles code %s as %s', (code, state) =>
    expect(parseLeadByte({ code, response: code === 1 ? 'OK' : 'Rejected' }).state).toBe(state),
  );
  it('identifies email as the duplicate field when the vendor reports it', () => {
    expect(
      parseLeadByte({ code: -2, response: 'Duplicate email', info: { field: 'email' } }),
    ).toMatchObject({ state: 'duplicate', duplicateFields: ['email'] });
  });
  it.each([-9, -8, -7, -6, -4, -19, -17, -16, -15, -14, -13, -12, -11, -10])(
    'handles rejection %s safely',
    (code) => {
      const r = parseLeadByte({ code, response: 'Internal secret' });
      expect(r.state).toBe('api_rejected');
      expect(r.message).not.toContain('Internal secret');
    },
  );
  it.each([null, {}, '<html>fail</html>', { code: '1', response: 'OK' }, { code: 1 }])(
    'rejects malformed response %j',
    (data) => expect(parseLeadByte(data).state).toBe('temporary_error'),
  );
  it('handles timeout safely even if fetch never settles', async () => {
    vi.stubEnv('LEADBYTE_TIMEOUT_MS', '10');
    const fetcher = vi.fn(() => new Promise<Response>(() => {}));
    const result = await submitLead(valid, new Date(), fetcher);
    expect(result.state).toBe('temporary_error');
    expect(result.uncertain).toBe(true);
  });
  it('handles non-JSON upstream body', async () => {
    const r = await submitLead(
      valid,
      new Date(),
      vi.fn().mockResolvedValue(new Response('bad json')),
    );
    expect(r.state).toBe('temporary_error');
  });
  it('handles network rejection', async () =>
    expect(
      (await submitLead(valid, new Date(), vi.fn().mockRejectedValue(new Error('network')))).state,
    ).toBe('temporary_error'));
  it('sends POST form encoding with fixed campaign settings', async () => {
    const mock = vi.fn().mockResolvedValue(Response.json({ code: 1, response: 'OK', leadId: 123 }));
    const result = await submitLead(valid, new Date('2026-09-14T10:00:00Z'), mock);
    expect(result.state).toBe('success');
    const [url, options] = mock.mock.calls[0];
    expect(String(url)).toContain('campid=DASHCAMS&sid=27144&returnjson=yes');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(options.redirect).toBe('follow');
    expect(options.body.get('offer_id')).toBe('3046');
    expect(options.body.has('transaction_id')).toBe(false);
  });
});
describe('payload integrity', () => {
  it('offer_id always remains 3046 despite query/body overrides', () => {
    const body = { ...valid, offer_id: '999', attribution: { offer_id: '999' } };
    expect(buildPayload(body, 'https://example.co.za', new Date()).get('offer_id')).toBe('3046');
  });
  it('rejects an environment campaign override', () => {
    vi.stubEnv('LEADBYTE_OFFER_ID', '999');
    expect(submissionConfig).toThrow();
  });
  it('formats consent in South African local time', () =>
    expect(formatSaDate(new Date('2026-01-01T23:05:09Z'))).toBe('02/01/2026 01:05:09'));
  it('uses our landing page and omits absent call time', () => {
    const p = buildPayload(valid, 'https://example.co.za', new Date());
    expect(p.get('optinurl')).toBe('https://example.co.za/');
    expect(p.has('preferredtimeofcall')).toBe(false);
  });
  it('formats preferred time as South African local time', () =>
    expect(
      buildPayload(
        { ...valid, preferredtimeofcall: '2026-12-12T14:30' },
        'https://example.co.za',
        new Date(),
      ).get('preferredtimeofcall'),
    ).toBe('12/12/2026 14:30:00'));
});

````

### File: tests/microsoftAds.test.ts

SHA-256: `41aef04aa855dfab4c69ca574be1031c7687f046dd1b62e89bb6c84ebaa51a90`

````typescript
import { afterEach, expect, it, vi } from 'vitest';
import { captureAttribution, sanitizeAttribution, sessionAttribution } from '../lib/attribution';
import { microsoftWebsiteDetails } from '../lib/microsoftAds';

const clickId = '0123456789abcdef0123456789abcdef';
const search = `?utm_source=bing&utm_medium=cpc&utm_campaign=bestcardash_dashcam&msclkid=${clickId}&ms_campaign_id=123&ms_adgroup_id=456&ms_ad_id=789&utm_term=dashcam`;
afterEach(() => vi.unstubAllGlobals());

it('captures Bing click and campaign identifiers and maps only acquisition metadata', () => {
  const attribution = captureAttribution(search);
  expect(attribution).toMatchObject({
    msclkid: clickId,
    ms_campaign_id: '123',
    ms_adgroup_id: '456',
    ms_ad_id: '789',
    utm_term: 'dashcam',
  });
  const details = microsoftWebsiteDetails(attribution);
  expect(details).toMatchObject({
    campaignId: '123',
    campaignName: 'bestcardash_dashcam',
    adGroupId: '456',
    adId: '789',
    metadata: { acquisitionSource: 'MICROSOFT_ADS', attributionEvidence: 'url_click_id' },
  });
  expect(details).not.toHaveProperty('source');
  expect(details).not.toHaveProperty('externalLeadId');
  expect(details).not.toHaveProperty('contactConsent');
  expect(details).not.toHaveProperty('marketingConsent');
});
it('recognises a click ID without optional UTMs', () => {
  expect(microsoftWebsiteDetails({ msclkid: clickId }).metadata?.acquisitionSource).toBe(
    'MICROSOFT_ADS',
  );
});
it('recognises paid Bing UTMs without fabricating a missing click ID', () => {
  const attribution = captureAttribution('?utm_source=bing&utm_medium=cpc');
  expect(attribution.msclkid).toBeUndefined();
  expect(microsoftWebsiteDetails(attribution).metadata?.attributionEvidence).toBe('url_utm');
});
it.each(['01234567-89ab-cdef-0123-456789abcdef', clickId.toUpperCase()])(
  'preserves supported ID format %s',
  (id) => {
    expect(sanitizeAttribution({ msclkid: id }).msclkid).toBe(id);
  },
);
it.each([
  '{msclkid}',
  'invalid',
  'test@example.com',
  '0'.repeat(33),
  '<0123456789abcdef0123456789abcdef>',
])('rejects malformed click ID %s', (id) => {
  expect(sanitizeAttribution({ msclkid: id }).msclkid).toBeUndefined();
});
it('rejects unresolved campaign macros, non-string and oversized IDs without truncation', () => {
  expect(
    sanitizeAttribution({
      ms_campaign_id: '{CampaignId}',
      ms_adgroup_id: 123,
      ms_ad_id: '1'.repeat(21),
    }),
  ).toEqual({});
  expect(sanitizeAttribution({ ms_campaign_id: '9223372036854775807' }).ms_campaign_id).toBe(
    '9223372036854775807',
  );
});
it.each([
  { utm_source: 'bing', utm_medium: 'organic' },
  { utm_source: 'google', utm_medium: 'cpc', msclkid: clickId },
  { ms_campaign_id: '123' },
  {},
])('does not mislabel unrelated/ambiguous attribution %j', (input) => {
  expect(microsoftWebsiteDetails(input)).toEqual({});
});
it('retains attribution through normal navigation', () => {
  const saved = captureAttribution(search);
  expect(captureAttribution('', saved)).toEqual(saved);
  expect(captureAttribution('?unrelated=value', saved)).toEqual(saved);
});
it('does not carry a Microsoft click or campaign onto a later Google visit', () => {
  const saved = captureAttribution(search);
  expect(
    captureAttribution('?utm_source=google&utm_medium=cpc&utm_campaign=new&gclid=opaque', saved),
  ).toEqual({ utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'new' });
});
it('clears stale click/campaign IDs for a new Bing campaign without MSCLKID', () => {
  expect(
    captureAttribution(
      '?utm_source=bing&utm_medium=cpc&utm_campaign=second',
      captureAttribution(search),
    ),
  ).toEqual({ utm_source: 'bing', utm_medium: 'cpc', utm_campaign: 'second' });
});
it('new Microsoft clicks do not inherit previous campaign details', () => {
  expect(captureAttribution(`?msclkid=${'a'.repeat(32)}`, captureAttribution(search))).toEqual({
    msclkid: 'a'.repeat(32),
  });
});
it('re-sanitises stale session data and ignores consent, customer and provider overrides', () => {
  expect(captureAttribution('', { msclkid: 'bad', utm_source: 'bing' })).toEqual({
    utm_source: 'bing',
  });
  expect(
    sanitizeAttribution({
      phone: 'private',
      source: 'MICROSOFT_ADS',
      terms: true,
      marketingConsent: true,
      externalLeadId: 'forged',
      msclkid: clickId,
    }),
  ).toEqual({ msclkid: clickId });
});
it('stores and retrieves the Bing click from the existing browser session', () => {
  const saved = new Map<string, string>();
  vi.stubGlobal('window', { location: { search } });
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => saved.get(key) || null,
    setItem: (key: string, value: string) => saved.set(key, value),
  });
  expect(sessionAttribution().msclkid).toBe(clickId);
  expect(sessionAttribution('').ms_campaign_id).toBe('123');
  expect(saved.get('cartrack-attribution')).toContain(clickId);
});

````

### File: tests/microsoftWebhook.test.ts

SHA-256: `f1d8cd95f9f7e42421640ac671bd0bc70cc794d6996b46b636a11a41d5b6fd61`

````typescript
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import type { MessageBatch } from '@cloudflare/workers-types';
import { createTestDatabase } from './d1Fixture';
import { microsoftWebhook } from '../lib/microsoftWebhook';
import { microsoftLeadMapper } from '../lib/microsoftLeadMapper';
import { consumeLeads } from '../lib/leadConsumer';
import { recoverOutbox } from '../lib/leadService';
import type { LeadBindings, LeadJob } from '../lib/leadBindings';

const secret = 'synthetic-microsoft-secret-at-least-32-characters';
let db: ReturnType<typeof createTestDatabase>;
let env: LeadBindings;
const sendQueue = vi.fn();
const payload = (extra: Record<string, unknown> = {}) => ({
  source: 'microsoft_ads',
  externalLeadId: 'crm:test-001',
  fullName: '  Test van der Example  ',
  email: 'test@example.com',
  phone: '0821234567',
  campaignId: '123',
  adId: '456',
  submittedAt: '2026-09-21T14:00:00Z',
  ...extra,
});
const qualified = () =>
  payload({
    qualification: { age: '18_plus', vehicle: 'yes', employment: 'employed', income: '10000_plus' },
    contactConsent: true,
    marketingConsent: false,
    consentText: 'Synthetic contact permission',
    consentVersion: 'test-v1',
    consentTimestamp: '2026-09-21T14:00:00Z',
  });
function request(data: unknown = payload(), token = secret) {
  return new Request('https://bestcardash.com/api/webhooks/microsoft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: typeof data === 'string' ? data : JSON.stringify(data),
  });
}
const row = () => db.sqlite.prepare('SELECT * FROM submissions').get()!;
beforeEach(() => {
  db = createTestDatabase();
  sendQueue.mockReset().mockResolvedValue(undefined);
  env = {
    DB: db,
    LEAD_QUEUE: { send: sendQueue },
    MICROSOFT_ADS_WEBHOOK_TOKEN: secret,
  } as unknown as LeadBindings;
  vi.stubEnv('LEADBYTE_ENABLED', 'true');
  vi.stubEnv('LEAD_HASH_SECRET', 'synthetic-test-hash-secret-at-least-32-characters');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://bestcardash.com');
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  db.sqlite.close();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it('preserves original full name, derives multipart surname and prefers explicit names', () => {
  expect(microsoftLeadMapper(payload())).toMatchObject({
    firstname: 'Test',
    lastname: 'van der Example',
    metadata: { fullName: '  Test van der Example  ' },
  });
  expect(
    microsoftLeadMapper(payload({ firstName: 'Test van', lastName: 'der Example' })),
  ).toMatchObject({ firstname: 'Test van', lastname: 'der Example' });
  expect(microsoftLeadMapper(payload({ fullName: 'Mononym' })).lastname).toBeUndefined();
});
it('stores incomplete leads for review, audit and unknown consent without queueing', async () => {
  expect((await microsoftWebhook(request(), env)).status).toBe(200);
  expect(row()).toMatchObject({
    source: 'MICROSOFT_ADS',
    processing_status: 'pending_review',
    acceptterms: null,
    marketing_consent: null,
    phone1: '+27821234567',
  });
  expect(JSON.parse(String(row().metadata_json)).fullName).toBe('  Test van der Example  ');
  const event = db.sqlite.prepare('SELECT * FROM webhook_events').get()!;
  expect(JSON.parse(String(event.payload_json))).toEqual(payload());
  expect(event.received_at).toBeTypeOf('number');
  expect(sendQueue).not.toHaveBeenCalled();
});
it('persists before queueing and deduplicates intermediary retries at database level', async () => {
  sendQueue.mockImplementation(async ({ leadId }) => {
    expect(row().submission_key).toBe(leadId);
  });
  await microsoftWebhook(request(qualified()), env);
  const response = await microsoftWebhook(request(qualified()), env);
  expect(await response.json()).toMatchObject({ duplicate: true });
  expect(db.sqlite.prepare('SELECT count(*) n FROM submissions').get()?.n).toBe(1);
  expect(
    db.sqlite
      .prepare("SELECT count(*) n FROM webhook_events WHERE processing_status='DUPLICATE'")
      .get()?.n,
  ).toBe(1);
  expect(sendQueue).toHaveBeenCalledTimes(1);
  expect(sendQueue).toHaveBeenCalledWith({ leadId: row().submission_key });
});
it.each(['', 'wrong-secret'])(
  'rejects invalid authentication without storing PII (%s)',
  async (token) => {
    expect((await microsoftWebhook(request(payload(), token), env)).status).toBe(401);
    expect(db.sqlite.prepare('SELECT count(*) n FROM webhook_events').get()?.n).toBe(0);
  },
);
it.each(['{', '[]', JSON.stringify({ note: 'x'.repeat(66000) })])(
  'rejects malformed or oversized JSON',
  async (body) => {
    expect((await microsoftWebhook(request(body), env)).status).toBe(400);
  },
);
it.each([
  { externalLeadId: undefined },
  { externalLeadId: 123 },
  { fullName: undefined },
  { source: 'google_ads' },
  { contactConsent: 'true' },
  { submittedAt: 'yesterday' },
  { qualification: [] },
  { email: undefined, phone: undefined },
])('rejects invalid contract fields and records a safe audit failure', async (extra) => {
  expect((await microsoftWebhook(request(payload(extra)), env)).status).toBe(400);
  expect(db.sqlite.prepare('SELECT error_message FROM webhook_events').get()?.error_message).toBe(
    'INVALID_PAYLOAD',
  );
  expect(sendQueue).not.toHaveBeenCalled();
});
it('redacts secrets in audit payloads and never logs contact data', async () => {
  await microsoftWebhook(
    request(payload({ apiKey: 'private', nested: { token: secret }, note: secret })),
    env,
  );
  const audit = String(
    db.sqlite.prepare('SELECT payload_json FROM webhook_events').get()?.payload_json,
  );
  expect(audit).not.toContain(secret);
  expect(audit).not.toContain('private');
  expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toMatch(/test@example|0821234567/);
});
it('recovers queue failure from the durable outbox', async () => {
  sendQueue.mockRejectedValueOnce(new Error('offline'));
  expect((await microsoftWebhook(request(qualified()), env)).status).toBe(200);
  expect(row().processing_status).toBe('pending');
  await recoverOutbox(env);
  expect(row().processing_status).toBe('queued');
});
it('returns 503 when the database cannot record the lead', async () => {
  vi.spyOn(db, 'prepare').mockImplementation(() => {
    throw new Error('private database details');
  });
  const response = await microsoftWebhook(request(), env);
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('private');
});
it.each([
  ['success', 'accepted', false],
  ['temporary_error', 'retry', true],
  ['api_rejected', 'rejected', false],
] as const)('uses the shared affiliate consumer for %s', async (state, status, retry) => {
  await microsoftWebhook(request(qualified()), env);
  const message = {
    id: 'test-message',
    body: { leadId: String(row().submission_key) },
    ack: vi.fn(),
    retry: vi.fn(),
  };
  const batch = {
    queue: 'bestcardash-leads',
    messages: [message],
  } as unknown as MessageBatch<LeadJob>;
  const send = vi
    .fn()
    .mockResolvedValue({
      state,
      message: 'Synthetic response',
      code: state === 'success' ? 1 : -8,
      leadId: 'test-affiliate-1',
    });
  await consumeLeads(batch, env, send);
  expect(row().processing_status).toBe(status);
  expect(retry ? message.retry : message.ack).toHaveBeenCalled();
  if (!retry) {
    await consumeLeads(batch, env, send);
    expect(send).toHaveBeenCalledTimes(1);
  }
  expect(db.sqlite.prepare('SELECT count(*) n FROM lead_attempts').get()?.n).toBe(1);
});
it('never queues tests or leads without verified contact consent and evidence', async () => {
  for (const [index, extra] of [
    { isTest: true },
    { contactConsent: null },
    { consentVersion: undefined },
    { qualification: {} },
  ].entries()) {
    await microsoftWebhook(
      request({ ...qualified(), ...extra, externalLeadId: `test-${index}` }),
      env,
    );
  }
  expect(sendQueue).not.toHaveBeenCalled();
});

````

### File: tests/reconciliation.test.ts

SHA-256: `7be06e1251718235b0d976913996754fe35cdbf92382febb162206b23ddfcd91`

````typescript
import { expect, it } from 'vitest';
import { reconcile } from '../lib/reconciliation.mjs';

it('matches exact IDs and flags different codes/phones', () => {
  const result = reconcile(
    [
      { request_id: 'a', leadbyte_lead_id: '123', phone1: '+27821234567', leadbyte_code: 1 },
      { request_id: 'b', leadbyte_lead_id: '456', phone1: '+27821234567', leadbyte_code: -8 },
    ],
    [
      { leadId: 123, phone1: '0821234567', code: 1 },
      { leadId: 456, code: 1 },
    ],
  );
  expect(result.results.map((row: { status: string }) => row.status)).toEqual([
    'matched_id',
    'matched_id_data_mismatch',
  ]);
});
it('treats phone-only matches as candidates and missing import rows as inconclusive', () => {
  const result = reconcile(
    [
      { request_id: 'a', leadbyte_lead_id: null, phone1: '+27821234567' },
      { request_id: 'b', leadbyte_lead_id: 'missing', phone1: '+27831234567' },
    ],
    [{ leadId: 123, phone1: '0821234567' }],
  );
  expect(result.results.map((row: { status: string }) => row.status)).toEqual([
    'phone_candidates_review',
    'not_in_import',
  ]);
  expect(result.vendorRowsWithoutExactMatch).toEqual([0]);
});
it('flags duplicate vendor IDs rather than choosing an arbitrary match', () => {
  expect(
    reconcile([{ request_id: 'a', leadbyte_lead_id: '1' }], [{ leadId: 1 }, { leadId: 1 }])
      .results[0].status,
  ).toBe('ambiguous_id');
});
it('rejects malformed exports', () => {
  expect(() => reconcile([], [{ arbitrary: 'field' }])).toThrow();
});

````

### File: tests/route.test.ts

SHA-256: `c8d16e02ffdc1e07d01a0891d29c051ef3f5f22c31141ca71a3d80034690f477`

````typescript
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rateLimit: vi.fn(), ingest: vi.fn() }));
vi.mock('../lib/rateLimit', () => ({ rateLimit: mocks.rateLimit }));
vi.mock('../lib/leadBindings', () => ({ leadBindings: async () => ({}) }));
vi.mock('../lib/leadService', async (original) => ({
  ...(await original<typeof import('../lib/leadService')>()),
  ingestLead: mocks.ingest,
}));
import { POST } from '../app/api/leads/route';
import { LeadConflict } from '../lib/leadService';
import { valid } from './fixtures';
function request(body: unknown = valid, origin = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({
      ...valid,
      submissionId: 'c402a01d-3f0a-4a5c-a312-34f80b3d3a8d',
      ...(body as object),
    }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
  vi.stubEnv('LEAD_HASH_SECRET', 'test-only-secret-at-least-32-characters');
  vi.stubEnv('LEADBYTE_ENABLED', 'true');
  mocks.rateLimit.mockResolvedValue({ allowed: true });
  mocks.ingest.mockResolvedValue({ status: 'queued' });
});
afterEach(() => vi.unstubAllEnvs());
it('uses common service with website consent and qualification, ignoring offer overrides', async () => {
  const response = await POST(request({ ...valid, offer_id: '999' }));
  expect(response.status).toBe(200);
  expect(mocks.ingest.mock.calls[0][1]).toMatchObject({
    source: 'WEBSITE',
    contactConsent: true,
    marketingConsent: null,
  });
  expect(mocks.ingest.mock.calls[0][1]).not.toHaveProperty('offer_id');
  expect((await response.json()).diagnostics.code).toBe('LEAD_RECEIVED');
});
it.each([
  ['age', 'under_18'],
  ['vehicle', 'no'],
  ['employment', 'unemployed'],
  ['income', 'under_10000'],
  ['terms', false],
  ['phone', '123'],
  ['email', 'invalid'],
])('rejects invalid %s', async (key, value) => {
  expect((await POST(request({ [key]: value }))).status).toBe(422);
  expect(mocks.ingest).not.toHaveBeenCalled();
});
it('rejects honeypot', async () =>
  expect((await POST(request({ website: 'spam' }))).status).toBe(400));
it('blocks honeypot bots', async () => {
  expect((await POST(request({ ...valid, website: 'spam' }))).status).toBe(400);
  expect(mocks.ingest).not.toHaveBeenCalled();
});
it('accepts the production site when using either apex or www origin', async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://bestcardash.com');
  const response = await POST(request(valid, 'https://www.bestcardash.com'));
  expect(response.status).toBe(200);
});
it('blocks cross-origin submissions', async () =>
  expect((await POST(request(valid, 'https://elsewhere.example'))).status).toBe(403));
it('retains rate limiting', async () => {
  mocks.rateLimit.mockResolvedValue({ allowed: false, retryAfter: 30 });
  const response = await POST(request());
  expect(response.status).toBe(429);
  expect(response.headers.get('Retry-After')).toBe('30');
  expect(mocks.ingest).not.toHaveBeenCalled();
});
it('rejects oversized body', async () =>
  expect((await POST(request({ extra: 'x'.repeat(17000) }))).status).toBe(400));
it('rejects malformed JSON', async () => {
  const response = await POST(
    new Request('http://localhost:3000/api/leads', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      body: '{',
    }),
  );
  expect(response.status).toBe(400);
});
it('rejects conflicting tokens', async () => {
  mocks.ingest.mockRejectedValue(new LeadConflict());
  expect((await POST(request())).status).toBe(409);
});
it('replays historical receipts', async () => {
  mocks.ingest.mockResolvedValue({
    legacyResult: {
      result: JSON.stringify({ state: 'success', message: 'Received' }),
      http_status: 200,
    },
  });
  expect((await POST(request())).status).toBe(200);
});
it('does not expose persistence exceptions', async () => {
  mocks.ingest.mockRejectedValue(new Error('private customer details'));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('private customer');
});

````

### File: tests/socialWebhooks.test.ts

SHA-256: `c3552c0f55c5aacffec34572d3381879d2c47f571662a53ef73da3d8be8b0ad7`

````typescript
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { createTestDatabase } from './d1Fixture';
import type { LeadBindings } from '../lib/leadBindings';
import {
  metaChallenge,
  receiveSocialWebhook,
  verifySocialSignature,
  type SocialProvider,
} from '../lib/socialWebhooks';
import { processSocialInbox } from '../lib/socialLeadProcessor';

const secret = 'synthetic-social-secret-at-least-32-characters';
let db: ReturnType<typeof createTestDatabase>;
let env: LeadBindings;
const send = vi.fn();
const meta = {
  object: 'page',
  entry: [
    {
      id: '123',
      changes: [{ field: 'leadgen', value: { leadgen_id: '456', form_id: '789', page_id: '123' } }],
    },
  ],
};
const tiktok = {
  object: 1,
  entry: [
    {
      id: '456',
      advertiser_id: '123',
      page_id: '789',
      lead_source: 'INSTANT_FORM',
      create_time: 1789999200,
      changes: [
        { field: 'name', value: 'Test van der Example' },
        { field: 'email', value: 'test@example.com' },
        { field: 'phone_number', value: '0821234567' },
      ],
    },
  ],
};
function request(
  provider: SocialProvider,
  data: unknown,
  time = Math.floor(Date.now() / 1000),
  key = secret,
) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  const signature =
    provider === 'META_ADS'
      ? `sha256=${createHmac('sha256', key).update(body).digest('hex')}`
      : `t=${time},s=${createHmac('sha256', key).update(`${time}.${body}`).digest('hex')}`;
  return new Request('https://bestcardash.com/api/webhooks/social', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [provider === 'META_ADS' ? 'x-hub-signature-256' : 'tiktok-signature']: signature,
    },
    body,
  });
}
const inbox = () => db.sqlite.prepare('SELECT * FROM social_webhook_inbox').get()!;
const lead = () => db.sqlite.prepare('SELECT * FROM submissions').get()!;
beforeEach(() => {
  db = createTestDatabase();
  send.mockReset().mockResolvedValue(undefined);
  env = {
    DB: db,
    LEAD_QUEUE: { send },
    META_APP_SECRET: secret,
    META_VERIFY_TOKEN: secret,
    META_PAGE_ID: '123',
    META_PAGE_ACCESS_TOKEN: 'synthetic-token',
    META_GRAPH_VERSION: 'v25.0',
    TIKTOK_APP_SECRET: secret,
    TIKTOK_ADVERTISER_ID: '123',
  } as unknown as LeadBindings;
  vi.stubEnv('LEAD_HASH_SECRET', secret);
  vi.stubEnv('LEADBYTE_ENABLED', 'true');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://bestcardash.com');
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  db.sqlite.close();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('verifies Meta subscription challenges without storing leads', async () => {
  expect(
    await metaChallenge(
      new Request(
        `https://bestcardash.com/api/webhooks/meta?hub.mode=subscribe&hub.challenge=1234&hub.verify_token=${secret}`,
      ),
      env,
    ).text(),
  ).toBe('1234');
  expect(
    metaChallenge(
      new Request(
        'https://bestcardash.com/api/webhooks/meta?hub.mode=subscribe&hub.challenge=1234&hub.verify_token=wrong',
      ),
      env,
    ).status,
  ).toBe(403);
});
it.each(['META_ADS', 'TIKTOK_ADS'] as const)(
  'rejects forged %s notifications before storing anything',
  async (provider) => {
    expect(
      (
        await receiveSocialWebhook(
          request(provider, provider === 'META_ADS' ? meta : tiktok, undefined, 'wrong'),
          env,
          provider,
        )
      ).status,
    ).toBe(403);
    expect(inbox()).toBeUndefined();
  },
);
it.each([-301, 301])('rejects stale or future TikTok delivery timestamps (%s)', async (offset) => {
  expect(
    (
      await receiveSocialWebhook(
        request('TIKTOK_ADS', tiktok, Math.floor(Date.now() / 1000) + offset),
        env,
        'TIKTOK_ADS',
      )
    ).status,
  ).toBe(403);
});
it('verifies exact raw bytes, not reserialized JSON', () => {
  const body = Buffer.from('{ "test": true }');
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  expect(verifySocialSignature('META_ADS', body, signature, secret)).toBe(true);
  expect(verifySocialSignature('META_ADS', Buffer.from('{"test":true}'), signature, secret)).toBe(
    false,
  );
});
it.each([
  '{',
  '[]',
  JSON.stringify({ object: 1, entry: [] }),
  JSON.stringify({ padding: 'x'.repeat(66000) }),
])('rejects invalid or oversized payloads', async (body) => {
  expect((await receiveSocialWebhook(request('TIKTOK_ADS', body), env, 'TIKTOK_ADS')).status).toBe(
    400,
  );
});
it('rejects notifications from other advertisers', async () => {
  env.TIKTOK_ADVERTISER_ID = '999';
  expect(
    (await receiveSocialWebhook(request('TIKTOK_ADS', tiktok), env, 'TIKTOK_ADS')).status,
  ).toBe(400);
  expect(inbox()).toBeUndefined();
});
it('requires a durable receipt before acknowledging and deduplicates repeated notifications', async () => {
  for (let i = 0; i < 2; i++)
    expect(
      (await receiveSocialWebhook(request('TIKTOK_ADS', tiktok), env, 'TIKTOK_ADS')).status,
    ).toBe(200);
  expect(db.sqlite.prepare('SELECT COUNT(*) n FROM social_webhook_inbox').get()?.n).toBe(1);
  vi.spyOn(db, 'prepare').mockImplementation(() => {
    throw new Error('db offline');
  });
  expect(
    (await receiveSocialWebhook(request('TIKTOK_ADS', tiktok), env, 'TIKTOK_ADS')).status,
  ).toBe(503);
});
it('processes native TikTok leads in test mode without affiliate delivery', async () => {
  await receiveSocialWebhook(request('TIKTOK_ADS', tiktok), env, 'TIKTOK_ADS');
  await processSocialInbox(env);
  expect(inbox().status).toBe('processed');
  expect(lead()).toMatchObject({
    source: 'TIKTOK_ADS',
    external_lead_id: '456',
    lastname: 'van der Example',
    processing_status: 'test',
  });
  expect(send).not.toHaveBeenCalled();
});
it('preserves TikTok numeric IDs beyond JavaScript safe integer range', async () => {
  env.TIKTOK_ADVERTISER_ID = '7123456789012345678';
  const raw = JSON.stringify(tiktok).replace(
    '"advertiser_id":"123"',
    '"advertiser_id":7123456789012345678',
  );
  expect((await receiveSocialWebhook(request('TIKTOK_ADS', raw), env, 'TIKTOK_ADS')).status).toBe(
    200,
  );
  await processSocialInbox(env);
  expect(JSON.parse(String(lead().metadata_json)).accountId).toBe('7123456789012345678');
});
it('fetches Meta details privately and maps the native form', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        id: '456',
        form_id: '789',
        created_time: '2026-09-21T14:00:00+0000',
        field_data: [
          { name: 'full_name', values: ['Test van der Example'] },
          { name: 'email', values: ['test@example.com'] },
        ],
      }),
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  await receiveSocialWebhook(request('META_ADS', meta), env, 'META_ADS');
  await processSocialInbox(env);
  expect(inbox().status).toBe('processed');
  expect(lead()).toMatchObject({
    source: 'META_ADS',
    processing_status: 'test',
    external_lead_id: '456',
  });
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer synthetic-token');
  expect(String(fetcher.mock.calls[0][0])).not.toContain('synthetic-token');
});
it('retries Meta fetch errors and recovers without losing the notification', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
  await receiveSocialWebhook(request('META_ADS', meta), env, 'META_ADS');
  await processSocialInbox(env);
  expect(inbox()).toMatchObject({
    status: 'pending',
    attempts: 1,
    error_code: 'PROCESSING_FAILED',
  });
  expect(lead()).toBeUndefined();
});
it('checkpoints large batches and resumes without inserting duplicates', async () => {
  await receiveSocialWebhook(
    request('TIKTOK_ADS', {
      object: 1,
      entry: Array.from({ length: 7 }, (_, i) => ({ ...tiktok.entry[0], id: String(100 + i) })),
    }),
    env,
    'TIKTOK_ADS',
  );
  await processSocialInbox(env);
  expect(inbox()).toMatchObject({ status: 'pending', cursor: 5 });
  await processSocialInbox(env);
  expect(inbox()).toMatchObject({ status: 'processed', cursor: 7 });
  expect(db.sqlite.prepare('SELECT COUNT(*) n FROM submissions').get()?.n).toBe(7);
});
it('queues a qualified live lead once across different notifications and preserves unknown consent', async () => {
  env.SOCIAL_LEADS_TEST_MODE = 'false';
  const answers = Object.fromEntries(
    Object.entries({
      age: '18_plus',
      vehicle: 'yes',
      employment: 'employed',
      income: '10000_plus',
      contactConsent: true,
    }).map(([key, value]) => [key, { columnId: key, values: { answer: value } }]),
  );
  env.TIKTOK_FORM_MAPPINGS = JSON.stringify({
    '789': { answers, consentText: 'Synthetic permission', consentVersion: 'test-v1' },
  });
  const changes = [
    ...tiktok.entry[0].changes,
    ...Object.keys(answers).map((field) => ({ field, value: 'answer' })),
  ];
  for (const time of [1, 2]) {
    await receiveSocialWebhook(
      request('TIKTOK_ADS', { object: 1, time, entry: [{ ...tiktok.entry[0], changes }] }),
      env,
      'TIKTOK_ADS',
    );
    await processSocialInbox(env);
  }
  expect(lead().processing_status).toBe('queued');
  expect(send).toHaveBeenCalledTimes(1);
  await receiveSocialWebhook(
    request('TIKTOK_ADS', { object: 1, entry: [{ ...tiktok.entry[0], id: '999' }] }),
    env,
    'TIKTOK_ADS',
  );
  await processSocialInbox(env);
  expect(
    db.sqlite
      .prepare("SELECT processing_status,acceptterms FROM submissions WHERE external_lead_id='999'")
      .get(),
  ).toMatchObject({ processing_status: 'pending_review', acceptterms: null });
  expect(send).toHaveBeenCalledTimes(1);
});

````

### File: tests/temporaryState.test.ts

SHA-256: `a8a271aab4a0097ae06525d401709e4692bd13771b3c214d185472b29002fa36`

````typescript
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TemporaryStore } from '../lib/temporaryStore';
import { claimSubmission, completeSubmission } from '../lib/submissions';
import { rateLimit } from '../lib/rateLimit';
import { browserAttempt, browserReceipt, saveBrowserReceipt } from '../lib/browserState';
import { createTestDatabase } from './d1Fixture';
const databaseState = vi.hoisted(() => ({
  db: null as ReturnType<typeof createTestDatabase> | null,
}));
vi.mock('../lib/database', () => ({ database: async () => databaseState.db }));
beforeEach(() => {
  databaseState.db = createTestDatabase();
  const storage = new Map<string, string>([
    ['cartrack-temporary-state', JSON.stringify({ attempts: [], receipts: {} })],
  ]);
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => storage.get(k) || null,
    setItem: (k: string, v: string) => storage.set(k, v),
  });
});
afterEach(() => {
  databaseState.db?.sqlite.close();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
it('expires memory entries and rejects capacity overflow', () => {
  const store = new TemporaryStore<number>(1);
  expect(store.set('a', 1, 200, 100)).toBe(true);
  expect(store.set('b', 2, 200, 100)).toBe(false);
  expect(store.get('a', 200)).toBeUndefined();
  expect(store.set('b', 2, 400, 201)).toBe(true);
});
it('claims only once concurrently in the database and replays results', async () => {
  const key = crypto.randomUUID();
  const results = await Promise.all([claimSubmission(key, 'hash'), claimSubmission(key, 'hash')]);
  expect(results.filter((r) => r.claimed)).toHaveLength(1);
  await completeSubmission(key, { state: 'success', message: 'Received' }, 200);
  const replay = await claimSubmission(key, 'hash');
  expect(!replay.claimed && replay.existing.httpStatus).toBe(200);
});
it('rate limits per Cloudflare client in the database', async () => {
  vi.stubEnv('DEPLOY_PLATFORM', 'cloudflare');
  vi.stubEnv('RATE_LIMIT_MAX', '2');
  const req = new Request('https://example.com', {
    headers: { 'cf-connecting-ip': '192.0.2.88' },
  });
  expect((await rateLimit(req)).allowed).toBe(true);
  expect((await rateLimit(req)).allowed).toBe(true);
  expect((await rateLimit(req)).allowed).toBe(false);
});
it('browser cooldown stops six attempts then expires', () => {
  for (let i = 0; i < 5; i++) expect(browserAttempt(1000000).allowed).toBe(true);
  expect(browserAttempt(1000000).allowed).toBe(false);
  expect(browserAttempt(1600001).allowed).toBe(true);
});
it('browser receipts retain outcome and attribution without contact fields and expire', () => {
  saveBrowserReceipt(
    'id',
    { state: 'success', message: 'Received' },
    { transaction_id: 'txn' },
    1000,
  );
  expect(browserReceipt('id', 1100)?.attribution.transaction_id).toBe('txn');
  expect(browserReceipt('id', 1100)).not.toHaveProperty('phone');
  expect(browserReceipt('id', 1801000)).toBeUndefined();
});
it('still works when browser storage is unavailable', () => {
  vi.stubGlobal('sessionStorage', {
    getItem: () => {
      throw new Error('disabled');
    },
    setItem: () => {
      throw new Error('disabled');
    },
  });
  expect(browserAttempt(Date.now()).allowed).toBe(true);
});

````

### File: tests/validation.test.ts

SHA-256: `acbba477b7f0f73d1029eea5c7af5fe024731df6d07c1eb4f39985cbd4c8d5cf`

````typescript
import { describe, expect, it } from 'vitest';
import { validateLead, cleanPhone, parseCallTime } from '../lib/validation';
import { captureAttribution } from '../lib/attribution';
// Synthetic fixture only: mocked tests never contact this number or the live API.
import { valid } from './fixtures';
describe('qualification', () => {
  it('fills the four confirmed eligibility fields without inventing an income bracket', () => {
    const result = validateLead({
      ...valid,
      age: undefined,
      vehicle: undefined,
      employment: undefined,
      income: undefined,
      eligibilityConfirmed: true,
    });
    expect(result.valid).toBe(true);
    expect(result.input).toMatchObject({
      age: '18_plus',
      vehicle: 'yes',
      employment: 'employed',
      income: '10000_plus',
      eligibilityConfirmed: true,
    });
  });
  it.each([false, undefined, 'true'])(
    'does not fill eligibility without boolean confirmation: %s',
    (eligibilityConfirmed) => {
      const result = validateLead({
        ...valid,
        age: undefined,
        vehicle: undefined,
        employment: undefined,
        income: undefined,
        eligibilityConfirmed,
      });
      expect(result.valid).toBe(false);
      expect(result.input.age).toBe('');
    },
  );
  it('does not override a non-qualifying answer even when confirmation is checked', () => {
    const result = validateLead({ ...valid, age: 'under_18', eligibilityConfirmed: true });
    expect(result.valid).toBe(false);
    expect(result.input.age).toBe('under_18');
  });
  it('accepts a qualifying lead', () => expect(validateLead(valid).valid).toBe(true));
  it.each([
    ['age', 'under_18', 'does_not_qualify_age'],
    ['vehicle', 'no', 'does_not_have_vehicle'],
    ['employment', 'unemployed', 'does_not_qualify_employment'],
    ['income', 'under_10000', 'does_not_qualify_income'],
  ])('rejects %s=%s locally', (key, value, reason) => {
    const r = validateLead({ ...valid, [key]: value });
    expect(r.valid).toBe(false);
    expect(r.reasons).toContain(reason);
  });
  it('requires consent', () =>
    expect(validateLead({ ...valid, terms: false }).errors.terms).toBeTruthy());
  it.each(['123', '+442071234567', '0211234567', '0821234567 ext 12'])(
    'rejects invalid/mobile-ineligible ZA phone %s',
    (phone) => expect(validateLead({ ...valid, phone }).valid).toBe(false),
  );
  it('normalises ZA national mobile', () =>
    expect(cleanPhone('082 123 4567')).toBe('+27821234567'));
  it('rejects unknown qualifying selections', () =>
    expect(validateLead({ ...valid, age: 'yes', income: '50000' }).valid).toBe(false));
  it('requires alphabetic names', () =>
    expect(validateLead({ ...valid, firstname: 'Test123' }).valid).toBe(false));
  it('supports accented multi-part names', () =>
    expect(validateLead({ ...valid, firstname: 'Tést', lastname: 'O’Testing' }).valid).toBe(true));
  it('rejects a rolled-over call date', () => expect(parseCallTime('2027-02-31T12:00')).toBeNull());
  it('rejects past preferred call times', () =>
    expect(validateLead({ ...valid, preferredtimeofcall: '2020-01-01T09:00' }).valid).toBe(false));
});
describe('attribution', () => {
  it('captures transaction_id', () =>
    expect(captureAttribution('?transaction_id=abc').transaction_id).toBe('abc'));
  it('preserves campaign parameters across navigation', () =>
    expect(captureAttribution('', { transaction_id: 'abc', utm_source: 'source' })).toEqual({
      transaction_id: 'abc',
      utm_source: 'source',
    }));
  it('captures an untrusted incoming offer only as attribution', () =>
    expect(captureAttribution('?offer_id=999').offer_id).toBe('999'));
  it('supports aff_id links and limits keys', () =>
    expect(captureAttribution('?aff_id=27144&phone=secret')).toEqual({ affiliate_id: '27144' }));
});

````

### File: tsconfig.json

SHA-256: `1fe85b00295f636c95916643a97619e2bf7183c9dc13c99dc7a7eae9e835c862`

````json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules", ".open-next", ".wrangler"]
}

````

### File: vitest.config.ts

SHA-256: `30ca55931d1f5a7f6637841ad7afb5d32204e4400c5521cfa70240d90809a229`

````typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
    execArgv: ['--experimental-sqlite'],
  },
});

````

### File: worker.mjs

SHA-256: `e38df7020d20f6a7f01e63e644597195c4cbbbe438d5fdf7372ab3b3ba0a0620`

````javascript
import nextWorker from './.open-next/worker.js';
import { cleanupDatabase } from './lib/databaseMaintenance';
import { consumeLeads } from './lib/leadConsumer';
import { recoverOutbox } from './lib/leadService';
import { processSocialInbox } from './lib/socialLeadProcessor';

const worker = {
  fetch: nextWorker.fetch,
  async queue(batch, env) {
    await consumeLeads(batch, env);
  },
  async scheduled(controller, env) {
    await recoverOutbox(env);
    await processSocialInbox(env);
    if (controller.cron === '17 2 * * *') await cleanupDatabase(env.DB);
  },
};

export default worker;

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from './.open-next/worker.js';

````

## Part D ? source manifest and handoff limits

Embedded reference source files: 96. Additional generated configuration files: wrangler.jsonc and config/indexnow.json.

File | SHA-256 | UTF-8 bytes
--- | --- | ---
.dev.vars.example | 526c727f7a820bb7c264d34cb345c8ffb65e8abaf50f736a173627d8faa6df2e | 882
.env.example | 556f13a3c950ed7010109ca2510bcb4ea698ba730268ba51b4db12d4f35ee185 | 1223
.gitignore | 8367da5fdfa133bb6280da5cc78370bcda872a2740bf7181d9eea3639214ca20 | 234
AGENTS.md | 63f2c50380ed6303237cce215ce27af1d620d094c215e28d1b1538a3c070e3bb | 678
app/api/leads/route.ts | 88252e8aba81a803a939c6279533f58a2f4c89f3772089534e7658507b1d6c93 | 7421
app/api/webhooks/google-ads/route.ts | 7e3bbd26821c92407d20253187a964b60441abff6bd3cfc1c84a62a92353e3c5 | 413
app/api/webhooks/meta/route.ts | 9d16a8e6c2f9a226cf304eeec050f8e560be042b82708c7b1e3006c2d8e77ee9 | 727
app/api/webhooks/microsoft/route.ts | 78e0adf49d76048b7668f74848e6fa014e6ca91692cafe65d46dc57fca92d0a5 | 445
app/api/webhooks/tiktok/route.ts | 402a51d6024ea3015c02fcb8fd1974a8691a1e9da77192377755b1a06e67b7c8 | 556
app/favicon.ico/route.ts | 5dabb366f93dee332fee0487015f9303cfb6b9b33f6bd98b2dc8b1f23d95847c | 241
app/globals.css | a55d14b8b102f2c8d2f606617abe3c741acb26c1bdcf6e8dfa60e8b6f247588a | 17283
app/layout.tsx | 77d29933722ec6243c0cb0ad573d3882fe4316996969a084c5e7d1ceb513f5e7 | 2319
app/page.tsx | 09e04a6f357cbf8d69cd44a2d35b0e107990e1bf051d82ff560f67ee5d9077d5 | 3958
app/privacy/page.tsx | 026e73a3efb8fcd66e2f47dcb166f8cfeb968921b14f39ff5e827dac03c99ac6 | 3563
app/robots.ts | 6d0b3412d502cfc591ef71dd13d6e5539e9db4eea222a536cd07aadc4856e6f8 | 398
app/sitemap.ts | cdbdbbb78cf3739b6e299a13e3053959a28cc37bb305500e098f4edb30fbfabd | 330
app/terms/page.tsx | 3c59e3fe1216e4076eb3d4addd591cae2fb16c6761e0ea19880e95fc3af4ddb4 | 1791
components/QuoteExperience.tsx | d7f344eb266e45d002dde913c4ad42656af3c968fbf44a543cf6f98d24460773 | 1271
components/form/LeadForm.tsx | e62d88e863b4845ed64c6778dfefebd45d4e198b228515edf88d43e3bcda1a3e | 11177
config/google-ads-mappings.example.json | 551498366c2741ce16a7ad7833d3fa07f7d89b0bff9d9a2ad0d8311ba04efcaa | 1419
config/social-form-mappings.example.json | 6d8ca3902bf01e257a561cfeeb77c2c78c5eeaad8e282cf566a01719484b92b3 | 1129
eslint.config.mjs | e0668fcdf419b86c39b3956226325d34830ee3672ab34e8ce7de0c69cd7666b9 | 438
lib/analytics.ts | da9714d7fd9d802d3c7d0abcc7b10d1f1df2383272e3e0c24f0c712610b0f438 | 798
lib/attribution.ts | 0dbe51a578a32a0bcbebf4d933e64c62a0ee7d33c391148707a91d29304365ef | 2788
lib/browserState.ts | 17b801a85e4499b20051d37ff24902c38f0c7404a1f15a7a00f987c5ebd79c0f | 2163
lib/config.ts | ab5dbd633c792de0f0ea982a8a42ef8b1635accfe5b4af678a43b11913aa4462 | 3056
lib/database.ts | 88d56b965346c8286ea68066dc17042ceecf74f7bd18142761f05ef375114791 | 1075
lib/databaseMaintenance.ts | 0a25734141309d9b972e9cd94c58a0b9ada5963c2ff335fad8ab2ab57e9a4a3d | 229
lib/diagnostics.ts | 4e07f504d3d4a3be496192f1c7eb7c2684ad8ca63b65fc9f1ed2cd4b6288417c | 1139
lib/googleLeadMapper.ts | 741e74e4beab35d3cc105d128df7fb211e0a612add703ecd7572289b92e51815 | 4459
lib/googleWebhook.ts | 154f048668cad8dca69146be9a9531dd4d42055d1e296bd33316f91976acb21e | 3423
lib/hosting.ts | 05f2c7b5ed9b616d10841dc4e50e3a87f8739563a91786224bedd6155c9eb0f9 | 869
lib/leadBindings.ts | aa3a6b7897ce29fccb6e6b3d2a7c8e6193dffea7fa79c6ce4ea71abf55879747 | 970
lib/leadConsumer.ts | 7252a0055b3a04054ac14e992550bd22057f62027d61e4f3b0ae85ba4705d3de | 8474
lib/leadModel.ts | 94db49e64dfbc979973340d35696f3963381aa84427cfae83558b821470af6ce | 1832
lib/leadService.ts | b5d1eb61568a944401b475bf2c601f89a3215ce51485162de9744e653f28d2d7 | 8209
lib/leadbyte.ts | 762c0d5089e6e06deb45f8111f0e93d948d413d52178ce961fc9f41de5f0466b | 7764
lib/logger.ts | 8a250757bcdbd94611b47da6ec0ecb83e4d22a56df3abfdc47cc286634094ea0 | 1462
lib/microsoftAds.ts | b58a939ba877a866e94f6525fe36dc8f634a8f8cef1c149c53f305cc5279037a | 1154
lib/microsoftLeadMapper.ts | eb1a8cd8f6a16975bd57bb456387de79f46c8b6082882502fa6a765a1ea2dd1e | 3499
lib/microsoftWebhook.ts | e666abe7acdb9ab73ce7e4f137c67cd59a1e4818be5ccb5468a8bd3ac2db35d6 | 3002
lib/rateLimit.ts | 29bfade113c0a38698f6b460c847c1f8bc5d7f610c6f9366ac53fb9cc6b5ce37 | 1331
lib/reconciliation.mjs | 8ef7080cf390ae5a87eddadc9c7e7e7c89a08f43be40d7ad8469c36f15661d10 | 2763
lib/socialLeadProcessor.ts | 1d3d73e94ce2fbfd77ed9975a276fd7152cb5ae11ea38540d40d58c21daf8290 | 8632
lib/socialWebhooks.ts | 1cf3c44c403dbd544e46f0046b6b918ec274bac17c2654e5b8fe8a03ceab3376 | 5792
lib/submissionKey.ts | b4d8626a650956baf77a8e51e93476d91c02626c5dc9bc13789cc42a43041815 | 770
lib/submissions.ts | e067cf6e82d41d77dd9356dc46fc504a1195bd86fca5412eb8dd7ca1f47db6cb | 4449
lib/temporaryStore.ts | f2d322d413d97dcd880c1ebc78412ce8f0b46ed6cfceb97239eb1ea432e907bc | 803
lib/validation.ts | 3b362b2eac9de9ce409d8fe8a50dff129239bdf6111693b3a05265d5daa7c4e6 | 5160
lib/webhookPayload.ts | a011317e934c7f460a24b3c0ae1b1e44e3556ada010afa8a9d1b14707b782994 | 2244
migrations/0001_submission_storage.sql | 407bb828088de9eab5dccbf188cc46af2242d15fe9ac65fb86a41acbc17bcdd7 | 648
migrations/0002_lead_reporting.sql | 3969dbf0f80bde8cc878d44d36b05865b97b0df221dc1264238e0dd54ebaa993 | 3854
migrations/0003_contact_email.sql | f6fe218cdeb303e64047969671e4b3471e8f61e21ac609faceef7046347d14ef | 137
migrations/0004_lead_pipeline.sql | 66543239e199e7458e07799da7b28855aa30fe267fb59d642775313233c66c55 | 2750
migrations/0005_microsoft_ads_reporting.sql | c3a76975b427101fb9d6e16f95208f644b34daff5a9c2d5f357b84479b4e2d96 | 1047
migrations/0006_social_webhook_inbox.sql | ea2c883e0ef12d7928f44f54d873a74ef49fc698582bb38d32b2d624f2255fb5 | 549
next-env.d.ts | 1862ac4bbbc5192d4bf562161df66ea547ed3e67173100656ab606ae9797db2b | 288
next.config.ts | d27d94342e794b137d95811afb3619cdaa76309651a27f5633e24f1f4607d602 | 1330
open-next.config.ts | 48a47e57593373c29b88d2d1bd46d29e602fd051c19afc28f3b0be17f94ae1d4 | 109
package.json | 5b47844c5d6e22993fda71254f13a8fb541e20a4de8790e25413f60c1a49a5dd | 2188
playwright.config.ts | ec63bbb35da6d7130d4ed6c7eb82c6b2ebc5ac1c14efd0649b9740fc8da355ac | 327
postcss.config.mjs | 258faa39968594a46c2cf72ba120fb353e788ef2acc3265ddbfbc6400dd80761 | 83
public/_headers | 243f83a85be7196e6382459068447d056353cabfdc9b85725ff9e6ddf794e97e | 69
reports/daily.sql | c9cfaaffc14a0eef0247cc61ff564e12c432ed18addf93474f9c0c1a53bfa14f | 182
reports/microsoft-ads.sql | 98f0cf6009bed54f736aa9c0e2e8d20c8ca2c7dd1791770e0b76efac80192e9b | 485
reports/pipeline-issues.sql | dff2a26922d99d429c61dd93869c148a8a89d9b63e302375051ee11d34f32803 | 553
reports/reconciliation-issues.sql | 64d2af9d06f6ade1b6c15bd835e12dcc79d582e6af0f43f99e9699d65e44e6fc | 968
scripts/build-cloudflare.mjs | 7a3fc5217cf228f55cf91e2be6db6e592a4eb70a8ca9356360da3f422b7a3b30 | 679
scripts/check-deployment.mjs | cff7080b23b56ac64d6b724bbd502a60171d18b23029e38c8ca3d98a39370564 | 779
scripts/deploy-cloudflare.mjs | b741f987a21d5ef410a3e5d839959837d8d83b99f4d417ca0401524009f5453b | 1072
scripts/export-report.mjs | 9c7c1d9e371fbdbfcac96eba78249f78990c26adaa5fc3a2d69dda01d9bfb4d4 | 4888
scripts/indexnow.mjs | a39e958e98b5c8c99aeb897f4314eb5cd710ac5e798d5b380020d6eabbadc88e | 3787
scripts/query-report.mjs | 314a94de328f94650f1d031939b27905a2dbfe26634fee9e40f2f61a77ed4e2b | 762
scripts/reconcile-report.mjs | 50f37f505f2c626328da21bdfe342298b0e1eb497405d8ceb3c7d11540af3b03 | 1111
scripts/setup-local.mjs | 8aba480b4a9808cabfc55cd9d37605611cefa746332a980ba7c46e05bdb480f2 | 1139
scripts/test-lead-worker.mjs | 6234ed57d914b1c668c83cb64230aef17fefa7f132b3d331cd3b1675a7e111ec | 6756
tests/browser/landing.spec.ts | 7d2d1ed496273d8e2a553641f059fd0805e73da2c9efccc127b75cec71269310 | 8012
tests/d1Fixture.ts | ba2dd852f0999888e5559d09470c5d042c00e126e2c62ec559cf62b9a9ebe690 | 1450
tests/database.test.ts | 6633d46584f92f23ee86bc3e2bd78fda27eeebd53e944c663e25f136f979233b | 3838
tests/diagnostics.test.ts | f37c69c447459c7697ad288df4c7498ee8e0e0e4c1056cdaeef2fa9d37890232 | 3891
tests/fixtures.ts | 775b1da5cf39b02b32e984811eb1e20feb31ee9026334e815338d6e3cea62eec | 322
tests/hosting.test.ts | 3eef3e27c85afa9511707521fdf445b54564b0bf02de4fe7a4014b96afc6a988 | 2213
tests/indexnow.test.ts | e274253ed412d08e3f80e9dfedefde5dbe2be70fd29ba983c60317c968101fbc | 2373
tests/leadPipeline.test.ts | 128c4f0537f4663351c035bb3fc9868941ab67be9bb5b4237b88247e2809bbf4 | 13804
tests/leadRecording.test.ts | 4cdbd003442e19730d1327cb069f439d33f71ff7ecaa57956a9ee629d73fc8cf | 11280
tests/leadbyte.test.ts | 356da71f03ad68b6ebd7e5391bae6692a568c58f3e2234052a3a1abe9bbf9cf2 | 5291
tests/microsoftAds.test.ts | 41aef04aa855dfab4c69ca574be1031c7687f046dd1b62e89bb6c84ebaa51a90 | 4945
tests/microsoftWebhook.test.ts | f1d8cd95f9f7e42421640ac671bd0bc70cc794d6996b46b636a11a41d5b6fd61 | 8000
tests/reconciliation.test.ts | 7be06e1251718235b0d976913996754fe35cdbf92382febb162206b23ddfcd91 | 1523
tests/route.test.ts | c8d16e02ffdc1e07d01a0891d29c051ef3f5f22c31141ca71a3d80034690f477 | 4279
tests/socialWebhooks.test.ts | c3552c0f55c5aacffec34572d3381879d2c47f571662a53ef73da3d8be8b0ad7 | 9808
tests/temporaryState.test.ts | a8a271aab4a0097ae06525d401709e4692bd13771b3c214d185472b29002fa36 | 3246
tests/validation.test.ts | acbba477b7f0f73d1029eea5c7af5fe024731df6d07c1eb4f39985cbd4c8d5cf | 3833
tsconfig.json | 1fe85b00295f636c95916643a97619e2bf7183c9dc13c99dc7a7eae9e835c862 | 641
vitest.config.ts | 30ca55931d1f5a7f6637841ad7afb5d32204e4400c5521cfa70240d90809a229 | 313
worker.mjs | e38df7020d20f6a7f01e63e644597195c4cbbbe438d5fdf7372ab3b3ba0a0620 | 692

The source is an implementation snapshot reviewed on 20 October 2026. The live-state review is historical context, not configuration for the new company. No secrets, customer records, dependency lockfile, installed packages, compiled assets or binary brand assets are embedded. External hosting accounts, platform subscriptions, approved consent and vendor credentials must be supplied/provisioned for the new project. The AI builder must implement the required refactor and verify the target deployment rather than merely copy this file.
