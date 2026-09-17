# CarTrack Cameras

Next.js landing page hosted on **Cloudflare Workers**, with **Cloudflare D1** for full lead records, LeadByte reporting/reconciliation and shared rate limiting. LeadByte remains the external campaign delivery service.

## Local development

```sh
npm ci
npm run setup:local
npm run dev
```

Use Node 22.13+ (or Node 24). Setup creates ignored `.env.local` and `.dev.vars` files with a random local hash secret, disables live lead delivery, and applies D1 migrations locally. It preserves unrelated settings and never prints the secret. Open http://localhost:3000.

## Cloudflare deployment

The configured site is [bestcardash.com](https://bestcardash.com/) with the [www.bestcardash.com](https://www.bestcardash.com/) variant accepted as the same production origin. It uses the Cloudflare account and the existing `cartrack_dashcam_landing` D1 database. Follow [CLOUDFLARE.md](CLOUDFLARE.md) for deployment and operations.

## Request flow and storage

1. The browser validates eligibility, consent, names, ZA mobile and optional call time. Session storage retains attribution and safe receipts without raw contact fields.
2. `/api/leads` enforces same-origin JSON requests, body size, honeypot and server validation.
3. D1 atomically counts requests per hashed Cloudflare client IP and time window. Default: ten requests per ten minutes, shared across all Worker instances.
4. D1 atomically claims a hashed submission token and stores the qualified lead, consent, submitted payload and attribution before contacting LeadByte. The stable `LEAD_HASH_SECRET` makes these identifiers consistent across instances and deployments.
5. Only validated, documented fields are sent to LeadByte. Numeric code 1 is success; duplicates, rejection and uncertain delivery have separate outcomes.
6. D1 records the LeadByte ID, numeric code, response text, info, raw response, timestamp, processing time, HTTP status and diagnostics alongside a safe browser replay response. Repeating the same token replays the stored result; changing its payload is rejected. Pending claims remain blocked if an upstream response or database completion is lost.
7. A daily Worker cron deletes expired rate-limit buckets only. Lead records and vendor results are retained for reporting and are no longer automatically deleted.

The database retains names, normalized phone numbers, qualification/consent details, campaign attribution and delivery results. Read [LEAD-REPORTING.md](LEAD-REPORTING.md) for the schema, status definitions, authenticated exports and LeadByte matching commands. Raw contact information and vendor detail are not exposed in public API responses or diagnostic logs.

Qualified forms are recorded even when delivery is disabled, with status `not_sent_disabled`. Invalid/unqualified/non-consenting submissions are rejected before creating a contact record. No automatic delivery queue or retry is enabled. A timeout can mean LeadByte received the lead: pending/uncertain records must be reconciled before manual redelivery. LeadByte enforces the supplied 90-day duplicate rule; a local record alone is not proof of vendor acceptance or a billable conversion.

## Configuration

`.env.example` lists app settings. For Cloudflare, set public/build-time configuration in Workers Builds and matching runtime values in `wrangler.jsonc`. `NEXT_PUBLIC_SITE_URL` must be the exact HTTPS workers.dev origin, without a path. It affects canonical links and the allowed submission origin. Store `LEAD_HASH_SECRET` as a Worker secret, never a public variable. Keep it stable across deployments.

`LEADBYTE_ENABLED=false` and `SITE_INDEXABLE=false` are the deployment defaults. `DEPLOY_PLATFORM=cloudflare` trusts Cloudflare's `CF-Connecting-IP`; `DEPLOY_ENV=production` is also required to enable indexing. Worker preview URLs are disabled. Use a separate Worker/database and disable live delivery for staging.

## LeadByte mapping

The endpoint is allowlisted to `https://returnxdigital.leadbyte.co.uk/api/submit.php`, campaign `DASHCAMS`, SID `27144`, offer `3046`. Fields: `firstname`, `lastname`, normalized ZA `phone1`, `optinurl`, South African `optindate`, `acceptterms=true`, `offer_id`, and optional `preferredtimeofcall`. Attribution and qualification fields are not invented as upstream API fields.

Qualification requires age 18+, access to a vehicle, employed/self-employed, monthly income R10,000+, explicit consent and a valid ZA mobile. Preferred calls must be within the next 30 days. Client checks are repeated on the server.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build:cloudflare
npm run preview
```

`npm test` uses synthetic fixtures, mocked LeadByte calls and real SQLite execution of the D1 schema/queries. `npm run test:e2e` runs the existing Playwright UI suite. Readiness at `/api/leads` checks app configuration, hash secret, database tables and the live-delivery toggle without sending a lead.

See [VERIFICATION.md](VERIFICATION.md) for earlier UI checks and [ASSETS.md](ASSETS.md) for asset provenance. Those earlier verification results do not establish a successful Cloudflare deployment. Live campaign tests need a manager-provided test number; do not submit synthetic fixtures to LeadByte.
