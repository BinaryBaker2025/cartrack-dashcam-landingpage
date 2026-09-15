# Cloudflare deployment

## Configured resources

- Account: Shariefholt@gmail.com's Account.
- Worker: `cartrack-dashcam-landingpage`.
- URL: https://cartrack-dashcam-landingpage.shariefholt.workers.dev
- D1: `cartrack_dashcam_landing`, bound as `DB`; database ID is in `wrangler.jsonc`.
- `LEAD_HASH_SECRET` is stored as a Worker secret.
- Live lead delivery and search indexing are disabled, matching the setup state.

For subsequent deployments, run `npm run deploy`. The first-time steps below are for recreating the setup in another account; do not recreate resources or rotate the existing secret for a routine deployment.

## Architecture

- Cloudflare Workers runs Next.js through OpenNext and serves bundled assets.
- Cloudflare D1 stores full lead records, LeadByte results and atomic rate-limit counters.
- The same Worker runs daily cleanup at 02:17 UTC (04:17 South Africa).
- Qualified contact details are recorded in D1 before delivery to LeadByte. See [LEAD-REPORTING.md](LEAD-REPORTING.md) for reporting and reconciliation.
- No R2 bucket is needed by the current site: it does not use runtime ISR or dynamic image optimization.

This migration keeps the existing Next.js framework; the installed OpenNext version declares support for this project's Next.js 16.3.5. References: [OpenNext setup](https://opennext.js.org/cloudflare/get-started), [D1 setup](https://developers.cloudflare.com/d1/get-started/).

## First deployment to workers.dev

1. Run `npx wrangler login`, then `npx wrangler whoami`. Select the intended account by adding its `account_id` to `wrangler.jsonc` if multiple accounts are available.
2. Run `npx wrangler d1 create cartrack_dashcam_landing`. Replace the all-zero `database_id` in `wrangler.jsonc` with the returned ID. The binding name stays `DB`. Do not reuse a production database for a preview/staging Worker.
3. In Cloudflare Workers & Pages, find or create the account's workers.dev subdomain. Add `NEXT_PUBLIC_SITE_URL` to `vars` in `wrangler.jsonc` as `https://cartrack-dashcam-landingpage.<your-subdomain>.workers.dev`, with no trailing slash. Do not invent the account subdomain.
4. Generate a production-only hash secret and set it with `npx wrangler secret put LEAD_HASH_SECRET`. Use at least 32 random characters, retain it securely, and keep it stable across deployments. Local setup generates a separate development secret; do not copy that into production. Wrangler may offer to create the Worker when setting its first secret.
5. Run `npm run deploy`. This validates the database ID and origin, builds the Worker, applies remote migrations, and deploys code, assets and the cleanup schedule. It does not enable live lead delivery.
6. Open the resulting URL and `/api/leads`. With delivery disabled, readiness should return HTTP 503 and `SUBMISSIONS_DISABLED`; `DATABASE_UNAVAILABLE` or `INTERNAL_ERROR` indicates a binding/migration problem. A missing hash secret returns `CONFIG_HASH_SECRET_REQUIRED`.
7. Verify public operator details and the existing campaign configuration. When ready to receive real leads, set `LEADBYTE_ENABLED` to `true` in `wrangler.jsonc` and deploy again. Readiness should now return 200 / `READY`. This check never sends a lead. Keep `SITE_INDEXABLE=false` for the temporary address.

The build wrapper overrides local `.env` and `.env.local` hosting settings, preventing the old Netlify origin or a local development URL from entering the Cloudflare build. Runtime settings live in `wrangler.jsonc`; secret values stay in Cloudflare.

## Local setup and preview

```sh
npm ci
npm run setup:local
npm run dev
```

`next dev` uses the local D1 binding through OpenNext. Local setup preserves unrelated environment settings but sets safe development defaults and disables real delivery. Files `.env.local`, `.dev.vars`, `.wrangler/` and `.open-next/` are ignored.

To test the real Workers runtime, run `npm run build:cloudflare` then `npm run preview`. For an API smoke test, use the configured production origin in requests. `.dev.vars` can override runtime variables locally, so set its `NEXT_PUBLIC_SITE_URL` to the configured HTTPS origin during a production-mode readiness test. Keep delivery disabled. Do not send a real lead during infrastructure verification.

OpenNext warns that Windows builds are not fully supported. Use Linux Workers Builds or WSL if a Windows adapter build fails; the normal Next.js build alone is not proof that the Worker bundle works.

## Git deployments

Connect this repository to the `cartrack-dashcam-landingpage` Worker in Workers Builds. Use Node 24, build command `npm ci`, and deploy command `npm run deploy`. Keep the same database ID and runtime settings in version control. Restrict automatic deployment to the production branch. Disable automatic preview branch deployment until a separate staging Worker and database are configured.

Do not set a Pages output directory: this is a Worker deployment, not a static Pages export. No Netlify adapter or function is needed for the Cloudflare deployment.

## Database operations

- Local schema: `npm run db:migrate:local`
- Remote schema: `npm run db:migrate:remote`
- Inspect remotely using the D1 dashboard; there is no public database browsing endpoint.
- Before later schema changes, export with `npx wrangler d1 export DB --remote --output=backup.sql` and store the backup securely outside the repository.
- Monitor cron executions and errors in Cloudflare observability. Failed cleanup can extend retention; alert on failures. Cloudflare backup and log retention are separate from application cleanup.
- Pending records may mean delivery happened but confirmation was lost. Reconcile with LeadByte before any manual redelivery. Do not clear the database or rotate the hash secret as a retry mechanism.

Daily cleanup preserves all lead records and delivery history. Rate-limit records expire within their configured windows (10 minutes by default) and are physically removed daily. Lead records contain contact information, consent, attribution and vendor results; restrict database/report access to authorised operators. Retention and manual deletion are operator-managed.

## Domain cutover and rollback

When a domain is ready, attach it under Worker Settings > Domains & Routes, set the exact new origin in `wrangler.jsonc`, redeploy, verify canonical links and form origin checks, then update campaign destinations. Keep the former Netlify deployment available until Cloudflare is verified and traffic is moved. Do not delete the old site or move unrelated DNS/email services as part of this app migration.

Worker versions can be rolled back from Cloudflare. A code rollback does not undo D1 migrations; the schema migrations are additive. The old Netlify deployment still uses per-instance memory and does not share the D1 records, so avoid serving live campaign traffic from both hosts simultaneously.
