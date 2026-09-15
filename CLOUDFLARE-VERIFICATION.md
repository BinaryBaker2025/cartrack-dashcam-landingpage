# Cloudflare verification — 15 September 2026

## Reporting update — current deployment

Worker version `e4865eff-7d15-4769-a026-f4abea23f29f` adds full lead storage and LeadByte reporting. Migration `0002_lead_reporting.sql` passed on local and remote D1. Lead details, consent, attribution, payload, vendor IDs, codes and results are now retained. Daily cleanup deletes only rate-limit records.

128 tests passed, including actual SQLite execution of recording-before-delivery, all 18 rejection codes, replay protection, disabled/uncertain deliveries, South African report dates and reconciliation matching. Production build, TypeScript and ESLint passed. Authenticated daily/issue queries and a detail export worked against remote D1 (zero lead records at verification). Live readiness returned the expected `SUBMISSIONS_DISABLED` after checking the new reporting schema; the updated privacy notice was verified live. No test contact was submitted to production or LeadByte.

See [LEAD-REPORTING.md](LEAD-REPORTING.md) for report and reconciliation commands. The initial deployment checks below are historical; their earlier submission-retention behaviour has been replaced by this update.

## Deployed resources

- Site: https://cartrack-dashcam-landingpage.shariefholt.workers.dev
- Account: Shariefholt@gmail.com's Account.
- Worker version: `bcd461e0-554a-45b9-9499-94591a179d1a`.
- Existing D1 database `cartrack_dashcam_landing` migrated and bound as `DB`.
- Production `LEAD_HASH_SECRET` created as a Cloudflare Worker secret.
- Daily cleanup deployed: `17 2 * * *` UTC.

## Passed checks

- Next.js production build and OpenNext Cloudflare bundle.
- TypeScript typecheck and ESLint.
- 98 unit/API/database tests, including concurrent claims, rate limits, uncertain delivery preservation, database failure and retention cleanup using real SQLite queries.
- 10 Playwright tests, including seven responsive sizes, accessibility, validation and duplicate-click handling.
- Remote D1 migration applied successfully; subsequent migration run found nothing pending.
- Live `/`, `/privacy`, `/terms`, `/robots.txt` and product image returned HTTP 200.
- Live canonical URL uses the Cloudflare origin; page security headers and noindex were present.
- Live `/api/leads` readiness checked the database schema and hash secret, then returned the expected 503 / `SUBMISSIONS_DISABLED`.
- A live empty-body validation smoke request returned 422 / `VALIDATION_FAILED`. D1 showed one rate-limit bucket and zero submission records afterward. No contact details or leads were sent to LeadByte.

## Operating state

Live lead delivery remains disabled, matching the previous local setup. Search indexing remains disabled for the temporary address. The original Netlify service was not deleted; campaign destinations and a future custom domain still need to point to Cloudflare when ready. Deployment source changes are in this local workspace; they have not been committed or pushed. Git-based automatic deployment must use these changes and the commands in `CLOUDFLARE.md`.

The cleanup schedule is deployed and its SQL is tested locally; its first scheduled production execution has not yet occurred. No live campaign submission was performed.
