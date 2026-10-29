# Owner reporting

The owner dashboard is `/reports`, with the custom domain `reports.bestcardash.com` configured in Wrangler. The subdomain root redirects to `/reports`. The dashboard includes a Change history page at `/reports/history` showing commits on this repository's GitHub `main` branch, newest first. It reads public commit metadata directly from GitHub after owner authentication; only committed and pushed changes appear. It is not live until deployment.

## Enable

1. Set a unique, randomly generated password of at least 24 characters using `npx wrangler secret put REPORTING_PASSWORD`. Enter it at the hidden prompt. Keep it in the owner's password manager.
2. Run `npm run deploy`. This applies migration 0007 and deploys the Worker and configured custom domain. The domain must belong to the configured Cloudflare account.
3. Open `https://reports.bestcardash.com` and use username `owner` and the configured password in the browser sign-in prompt.

## Automatic deployment from GitHub

In Cloudflare, open Workers & Pages > cartrack-dashcam-landingpage > Settings > Builds. Keep the production branch connected to this repository and use:

- Build command: `npm run build:cloudflare`
- Deploy command: `npm run db:migrate:remote && npx wrangler deploy`

The migration command is required for the new analytics table. Commit migration 0007, `wrangler.jsonc`, the reporting UI/API, and the Worker changes together. The custom-domain entry in `wrangler.jsonc` attaches `reports.bestcardash.com` to this Worker during deployment; no separate reporting app or database is needed. Keep `NEXT_PUBLIC_SITE_URL` pointing to the public landing site.

`REPORTING_PASSWORD` is a runtime Worker secret and persists across normal deployments. Do not put it in GitHub, Wrangler `vars`, or public build variables. After the production build succeeds, confirm `reports.bestcardash.com` appears in Worker Settings > Domains & Routes, then open it in a private browser window. It should prompt for credentials; after sign-in, verify the dashboard loads without a reporting-unavailable error. Existing conflicting DNS records for that exact subdomain must be resolved if Cloudflare reports a domain attachment conflict.

For local development run `npm run setup:local`, then `npm run dev` and open `http://localhost:3000/reports`. During `next dev`, loopback hosts (`localhost`, `127.0.0.1`, and `::1`) can read reports without a password. Reports use the local D1 database, so production leads will not appear. Other hosts and production builds still require owner credentials. For the Cloudflare preview set `REPORTING_PASSWORD` in the ignored `.env.local` as well as `.dev.vars` and apply `npm run db:migrate:local`. The API independently checks credentials; the production Worker also protects the reporting page, API and all requests on the reporting hostname. Missing or short passwords disable access outside local development. Use HTTPS in production. Browser Basic authentication persists until the browser session is closed; this shared owner credential does not provide per-user audit history or MFA.

## Data

The dashboard reads the existing `lead_reporting` and `lead_daily_summary` views, with date filters in South African time, source and delivery summaries, searchable contact records and 50-row pagination. Test records are included and marked. Summary totals ignore contact search. Detailed payloads, consent evidence and raw upstream responses remain available in the private D1 view and existing export scripts, rather than being sent to the dashboard.

Migration 0007 adds anonymous daily event counters. Existing form events now POST only the event name to `/api/analytics`; no contact details or visitor identifiers are stored in the analytics table. A separate IP-derived temporary rate-limit bucket limits event writes without consuming lead submission limits. These are browser event counts, not unique people, ad-platform analytics or sales. Bots and repeat visits can inflate counts; blocked requests can undercount. Historical activity cannot be reconstructed. Tracking failures never stop form submission. LeadByte acceptance comes from SQL, not browser events.

Reports and API responses are private/no-store and noindex. The dashboard is read-only. Refresh is manual. Never place the reporting password in a public environment variable or URL.

## Excel export

Use **Export Excel** beside the lead records after applying the desired date range and search. The `.xlsx` download includes every matching lead across all pages, an overview of delivery/source/activity counts and daily lead totals. Summary sheets use the full date range; search applies to the Leads sheet only. Phone numbers and identifiers remain text, and contact values cannot become spreadsheet formulas. Exports contain private contact information. They are live reads, not historical snapshots; the download records its generation time. Large exports that exceed database or workbook limits fail visibly; use a shorter date range in that case.
