# Hosting and application audit — 15 September 2026

## Follow-up: production secret repaired

At the user's request, a new cryptographically random production `LEAD_HASH_SECRET` was generated and uploaded directly to Cloudflare's Worker secret storage. Its value was not printed or written to the repository. The old value was not recovered; existing records remain, but their old duplicate-protection hashes will not match the new secret.

Cloudflare now lists the secret. Live `/api/leads` returns HTTP 503 / `SUBMISSIONS_DISABLED`, confirming that the secret/configuration and database readiness checks pass. Delivery remains disabled. No lead was submitted. The initial audit below describes the state before this repair.

## Result

The website is deployed and public pages work, but lead submissions are not ready.
The live Worker is missing `LEAD_HASH_SECRET`, and `LEADBYTE_ENABLED` is `false`.

## Verified

- Active Worker version: `237d06ea-2d78-4e9e-a102-647501d65d54` (18:40 UTC).
- Homepage, privacy, terms and robots.txt return HTTP 200 over HTTPS.
- `/api/leads` returns HTTP 503 with `CONFIG_HASH_SECRET_REQUIRED`.
- Worker secret listing is empty; the active version has no hash-secret binding.
- Active `DB` binding matches database `f90b223b-d425-45b8-9260-f7b9e30a612c` in the repository.
- Remote D1 is reachable, has no pending migrations, and contains the expected submission, rate-limit and reporting schema. Two submission records exist; no contact fields were read.
- Active Worker has fetch and scheduled handlers, assets and self-reference bindings, production environment/platform values and the configured workers.dev origin.
- Rate limit is configured as 10 requests per 600 seconds.
- Cleanup cron is installed for 02:17 UTC (04:17 South Africa). Its handler deletes expired rate-limit records only. A real scheduled execution was not observed.
- Cloudflare persisted invocation logs are enabled.
- Search indexing is disabled in configuration and live responses (`noindex, nofollow`; robots disallows crawling).
- Local development secrets pass the application's minimum length check. Local env files are ignored; only env examples are tracked. Local values were not printed or copied to production.
- Legacy `.env` keys `DATABASE_URL`, `DATA_RETENTION_DAYS` and `CRON_SECRET` are unused by the current Cloudflare application. D1 uses the Worker binding; cleanup uses the scheduled handler.

## Validation

- 128 automated unit/API/database tests passed.
- 10 local browser tests passed: seven viewport sizes, automated accessibility, validation, attribution and duplicate-submit protection. Vendor responses are mocked.
- ESLint and TypeScript checks passed.
- Full Next.js and OpenNext Cloudflare build passed on this Windows workspace (OpenNext emits its Windows support warning).
- Browser tests emitted a non-blocking suggestion to eagerly load the above-the-fold product image.

## Outstanding configuration

1. Restore the previous production `LEAD_HASH_SECRET` as a Worker runtime secret if available. Existing submission digests depend on its value, so do not substitute a development secret or silently rotate it. Use `npx wrangler secret put LEAD_HASH_SECRET --config wrangler.jsonc` and enter the value privately. The app requires at least 32 characters. If the original is lost, a new production secret requires acknowledging that existing duplicate-protection hashes will no longer match.
2. After restoration, check `/api/leads` again. With the current delivery setting, the expected result is HTTP 503 / `SUBMISSIONS_DISABLED`, indicating that configuration and database readiness checks passed.
3. Enable `LEADBYTE_ENABLED` in `wrangler.jsonc` only when campaign delivery is intended, then deploy and check for HTTP 200 / `READY`. Real vendor delivery has not been tested in this audit. Dashboard edits to repository-managed variables can be overwritten by deployment.
4. Git deployment must explicitly run the OpenNext build before upload. The previously suggested combined command is `npm run build:cloudflare && npx wrangler deploy`. This does not apply future database migrations. The repository's `npm run deploy` script includes configuration validation, the build, remote migrations and upload.
5. A remote D1 CLI check initially failed to select an account despite the repository account setting. It succeeded with `CLOUDFLARE_ACCOUNT_ID=8e5c9c94197c950548bd0e188beb0007` explicitly set. Use this environment value if the same error occurs in a migration job.

No production secrets, variables, code, database records or delivery settings were changed by this audit. The current Cloudflare Builds dashboard commands and future Git-triggered deployments were not directly verified.

References: [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [variable configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), [OpenNext build and deploy](https://opennext.js.org/cloudflare/howtos/dev-deploy).
