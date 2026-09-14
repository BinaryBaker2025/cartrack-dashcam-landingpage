# CarTrack Cameras

Next.js App Router, React, TypeScript and Tailwind landing page matching the supplied CarTrack reference. The form posts to our own `/api/leads` Netlify Function, which validates and forwards qualified leads to LeadByte. **No database, Prisma, external storage service or scheduled cleanup is required.** This follows the updated request for temporary browser state.

## Local setup

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Do not overwrite an existing `.env`; edit it instead. Open http://localhost:3000. Node 22.13+ or Node 24 is recommended. Live submission defaults to `LEADBYTE_ENABLED=false`.

## Netlify deployment

Follow [NETLIFY.md](NETLIFY.md). Import the Git repository, build with `npm run build`, publish `.next`, and add the environment variables in Netlify's dashboard for Builds and Functions. The Next.js adapter automatically creates the API function. No database initialization or standalone functions directory is needed.

## Request flow

1. Session storage captures whitelisted campaign attribution.
2. Shared client validation checks names, ZA mobile, eligibility, consent and optional call time. Local rejection emits the corresponding analytics event and never posts to LeadByte.
3. The browser checks for an existing successful/duplicate receipt and a temporary attempt limit. It sends qualified input and its random submission token to `/api/leads`.
4. The function checks Origin, JSON content type, 16 KiB body limit, honeypot, request token and all qualification rules again.
5. Temporary in-memory server checks reduce repeated requests on the same warm function instance. No raw contact information is retained in these maps.
6. The server POSTs only documented fields to LeadByte with a timeout. Numeric code 1 is the only success condition. Friendly errors distinguish duplicates, rejections and temporary failures.
7. Success replaces the form. A temporary browser receipt prevents the same input from being submitted again in that tab even after refresh. Server logs contain a request ID, code and redacted response, not the complete phone number.

## Temporary state and its limits

The small browser record uses `sessionStorage`, not IndexedDB: no database API or additional dependency is needed. It contains attempt times, submission tokens, payload digests, safe success/duplicate messages, timestamps and attribution. It never stores raw names or mobile numbers. Browser cooldown is five attempts per ten minutes. Receipts expire after 30 minutes, with cleanup when storage is accessed. Attribution/tokens last for the browser session; closing a tab usually clears session storage, although browser restore can preserve it. Storage errors fall back to page memory.

Browser state is a convenience, not a security boundary: visitors can clear or modify it, open another tab, or call the endpoint without the page. Server memory rate limits default to ten requests per ten-minute fixed window, per platform-reported IP within one warm function instance. Submission tokens/outcomes expire after 30 minutes. Maps are bounded to 5,000 entries each, clean expired entries on access, and reject new entries if full.

**Server memory is not shared across Netlify instances and disappears on restart, deployment or cold start. There is no globally enforced rate limit, durable idempotency guarantee, central lead history or central attribution log.** LeadByte remains responsible for authoritative duplicate decisions and lead records. No hidden external storage service has been added. For stronger abuse protection later, use hosting-level protections or shared server state; browser storage alone cannot supply that guarantee.

Timeouts/network failures can mean LeadByte received a request but the response was lost. There is no automatic retry. The UI retains the same token on retry, but that only helps if the same server instance still has the entry. Reconcile uncertain outcomes with the campaign manager rather than repeatedly submitting. The supplied API does not document an upstream idempotency field.

## Qualification and validation

- First/last names: present, maximum 80 characters, Unicode alphabetic names with accents, spaces, apostrophes or hyphens between name parts; no numbers.
- Mobile: `libphonenumber-js/max` validates a South African mobile and normalizes it to E.164 `+27...`; foreign numbers, landlines and extensions are rejected.
- Age: explicit 18+ confirmation.
- Vehicle: owned or accessible, yes.
- Employment: employed or self-employed. Self-employment is an assumption to confirm with the manager.
- Income: R10,000 or more per month. Gross/net and personal/household were unspecified; confirm with the manager.
- Consent: explicit true.
- Optional call time: real future date within 30 days, interpreted as South African time.

Local qualification reason codes are `does_not_qualify_age`, `does_not_have_vehicle`, `does_not_qualify_employment`, `does_not_qualify_income`. Direct API rejections log only categories/request IDs. The app does not determine downstream affordability, market, Do Not Call or billability.

## LeadByte mapping

POST `https://returnxdigital.leadbyte.co.uk/api/submit.php?campid=DASHCAMS&sid=27144&returnjson=yes` using `application/x-www-form-urlencoded`.

| Field | Value |
| --- | --- |
| firstname / lastname | Sanitized names |
| phone1 | Validated E.164 ZA mobile |
| optinurl | Configured landing page origin plus `/` |
| optindate | Actual server submission time, `dd/mm/yyyy hh:mm:ss`, Africa/Johannesburg |
| acceptterms | Literal true |
| offer_id | Always 3046 |
| preferredtimeofcall | Optional South African local datetime in the same format; omitted when empty |

The endpoint and DASHCAMS / 27144 / 3046 campaign are allowlisted. Incoming offer parameters cannot override them. Attribution and qualification fields are not forwarded as undocumented API fields.

Handled error codes: -9, -8, -7, -6, -5, -4, -3, -2, -19, -17, -16, -15, -14, -13, -12, -11, -100, -10. Code -2 shows duplicate; -5 requests correction; -3/-100 are temporary failures. Malformed/non-JSON responses, timeouts and network/HTTP errors never report success. Logs retain actual codes and response text with known contact values, phone-like numeric sequences and email addresses redacted; vendor info arrays are omitted.

## Environment variables

Use `.env.example` as the complete template. Set values in Netlify's UI for Builds and Functions; redeploy after changing them.

| Variable | Value / purpose |
| --- | --- |
| NEXT_PUBLIC_SITE_URL | `http://localhost:3000` locally; exact HTTPS public origin in production |
| DEPLOY_PLATFORM | `netlify` when hosted on Netlify; selects its client-address header |
| LEADBYTE_ENDPOINT | `https://returnxdigital.leadbyte.co.uk/api/submit.php` |
| LEADBYTE_CAMPID | DASHCAMS |
| LEADBYTE_SID | 27144 |
| LEADBYTE_OFFER_ID | 3046 |
| LEADBYTE_ENABLED | false during setup; true when ready for live delivery |
| LEADBYTE_TIMEOUT_MS | 10000 default, bounded to 20 seconds |
| RATE_LIMIT_MAX | 10, temporary per-instance server limit |
| RATE_LIMIT_WINDOW_SECONDS | 600, minimum 60 seconds |
| SITE_INDEXABLE | false until approved; previews remain noindex |
| CAMPAIGN_OPERATOR_NAME | Real responsible operator, required for live production delivery |
| PRIVACY_CONTACT_EMAIL | Real privacy address, required for live production delivery |

Netlify supplies `CONTEXT` during builds. Vercel compatibility uses its supplied `VERCEL`/`VERCEL_ENV`. No application database credentials, hash secret, cron secret or retention setting is required. Old DATABASE_URL/CRON_SECRET/LEAD_HASH_SECRET/DATA_RETENTION_DAYS values are ignored and can be removed from the hosting dashboard. Existing ignored local SQLite files are not used or automatically deleted.

## Attribution and analytics

Session attribution preserves affiliate_id, offer_id, transaction_id, aff_sub, utm_source, utm_medium, utm_campaign, utm_content, utm_term; aff_id is accepted as an affiliate alias. Present parameters update the session; missing ones do not erase it. Attribution is saved with the browser receipt, not in a central database or server log. This is not a reporting archive. Do not put personal data into tracking parameters.

Events: landing_page_view, form_started, qualification_failed, form_validation_failed, lead_submit_started, lead_submit_success, lead_submit_rejected, lead_submit_error. `configureAnalytics()` accepts a provider adapter; by default no analytics network requests run. Events contain state/failed field names/reason categories, not contact details. Browser receipt replays do not count as new API success events.

No documented transaction-ID field or conversion postback was supplied, so no field/pixel is invented. Ask the manager to update the affiliate tracking destination and confirm how conversions are attributed. Weekly reporting must come from the campaign platform/LeadByte.

## Tests

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Automated LeadByte tests are mocked and use synthetic numbers only. Coverage includes all originally requested qualification/vendor/offer/attribution/double-submit cases, expiry/capacity of memory stores, browser cooldown/receipts and storage fallback. Browser checks cover 375, 390, 430, 768, 1024, 1280 and 1440px, inline errors, successful submission, repeated clicks and automated accessibility. No field conversion rate or Core Web Vitals score is guaranteed.

## Manual campaign test

Obtain a valid test mobile number and test authorization from the manager. Use exactly **Test / Testing**; never use the synthetic automated fixture number in the live form. Configure the approved HTTPS site URL and operator/privacy values. Enable live delivery for the approved test, redeploy, submit once with qualifying answers and consent, and ask the manager to verify receipt and exclude it from billing. Confirm E.164, South African timestamps, employment/income rules and callback expectations. Keep preview delivery disabled. Do not repeatedly retry uncertain responses.

## Design, assets and operations

See [ASSETS.md](ASSETS.md) for original asset URLs and reference/layout notes. No visible reference assets are missing; no generated/stock substitutes are used. The supplied brief explicitly excluded a public price. The form is taller than the original to accommodate mandatory qualification/consent. Terms/privacy pages describe current temporary processing and need operator approval before launch.

The server keeps validation, input sanitization, same-origin checks, honeypot, body size limit, timeout and safe error handling. Security headers and staging noindex remain. Logs are separate from temporary memory; their retention is controlled by the hosting operator. Full phone numbers, names, raw request bodies and credentials are not intentionally logged.

Internal commercial terms remain R55 CPL, minimum conversion requirement 10%, weekly disposition/stat updates. These are not public marketing claims. LeadByte/campaign reports determine non-billable Duplicate, Do Not Call, Test, age/employment disqualification, lost_affordability and lost_no_market. The site does not fabricate downstream outcomes.

## Key files

- `app/page.tsx`, `app/globals.css`: reference-based responsive page.
- `components/form/LeadForm.tsx`: qualification, consent and all form states.
- `app/api/leads/route.ts`: server-only API proxy and validation.
- `lib/leadbyte.ts`, `lib/validation.ts`: mapping, response handling and shared rules.
- `lib/browserState.ts`, `lib/submissionKey.ts`, `lib/attribution.ts`: temporary browser state.
- `lib/temporaryStore.ts`, `lib/submissions.ts`, `lib/rateLimit.ts`: bounded per-instance memory protection.
- `lib/hosting.ts`, `netlify.toml`: Netlify/Vercel context and build configuration.
- `tests/`: mocked unit/API and browser coverage.

Remaining launch inputs: real domain, approved creative/consent/operator details, campaign test number, qualification interpretation, affiliate destination/postback contract and weekly reporting access. No deployment or live submission is performed by local checks.
