# Reusable lead database

`schema.sql` is the complete Cloudflare D1 / SQLite schema from this project, equivalent to migrations 0001–0003. It includes all columns, defaults, indexes, reporting views and 19 LeadByte response-code descriptions. It contains no customer records, credentials or database identifiers.

## Install in another project

For the same D1 migration setup, copy `schema.sql` into the **new project's** `migrations/0001_initial.sql`. Configure that project's own D1 database with binding `DB` and `migrations_dir: "migrations"`, then run from that project:

```sh
npx wrangler d1 migrations apply DB --local
npx wrangler d1 migrations apply DB --remote
```

Apply to an empty database. Use this consolidated schema OR this project's original three migrations, not both. Do not reuse this project's database ID. This is SQLite SQL, not a PostgreSQL/MySQL schema.

## Structure

| Object | Purpose |
| --- | --- |
| `submissions` | One row per claimed submission token: contact details, consent, campaign, qualification, attribution, exact outgoing payload, delivery outcome and safe replay response. |
| `rate_limits` | Atomic request counters per hashed client/time-window bucket. |
| `leadbyte_codes` | Lookup descriptions for accepted/rejected LeadByte codes. Unknown codes remain valid and have no lookup description. |
| `lead_reporting` | Full lead records (`record_version = 1`), with code descriptions, UTC time, South African reporting date and selected attribution fields. |
| `lead_daily_summary` | Counts grouped by South African date, campaign, supplier, offer, delivery status and vendor code. |

Indexes cover submission expiry, creation time, phone/time, vendor lead ID, delivery status/time, vendor code/time, unique non-null request IDs, and rate-limit expiry. Phone numbers and vendor IDs are text. Phone numbers are not unique: repeated attempts can be retained. There is no foreign-key constraint on vendor codes, allowing unknown responses to be recorded.

## Application behavior to preserve

The schema provides storage; these behaviors are implemented by the application:

1. Validate qualification, contact details and consent before recording a lead. Check the rate limit before recording it.
2. Atomically insert the full lead with `record_version = 1`, `delivery_status = 'pending'`, and `expires_at = 0`, using `ON CONFLICT(submission_key) DO NOTHING RETURNING submission_key`. Only the request that claims the token may send to LeadByte. The schema's defaults of `0` and `legacy_unknown` exist for older records, so new leads must explicitly set version and state.
3. If the token already exists, compare the stored fingerprint and use the existing safe response or pending state. Do not deliver it again. Token replay protection is separate from LeadByte's duplicate checks.
4. Save the final response and vendor details with `WHERE submission_key = ? AND result IS NULL`, setting `completed_at`. The original code does not automatically resend uncertain, pending or disabled deliveries.
5. Periodically delete only expired rate-limit rows: `DELETE FROM rate_limits WHERE expires_at <= ?`. Lead records are retained; their `expires_at` is a compatibility field, not a deletion deadline.

`created_at`, `completed_at` and `expires_at` use Unix **milliseconds**. JSON is serialized into TEXT columns: `result`, `payload_json`, `qualification_json`, `attribution_json` and `leadbyte_info_json`. Keep `result` restricted to the safe client-facing response. Raw vendor responses belong in `leadbyte_raw_response`.

Delivery states are `pending`, `accepted`, `duplicate`, `rejected`, `uncertain`, `not_sent_disabled` and `legacy_unknown`. The application assigns these; SQL does not enforce an enum. `delivery_uncertain` is an integer flag, `0` or `1`.

The reporting date uses a fixed UTC+02:00 offset for South Africa. Adapt both reporting and date-range queries if the new project uses another timezone. Email is retained locally in this project and is not sent in its LeadByte payload.

## Reusing the implementation

Use these source files as the reference when transferring the workflow; copy their dependencies too:

- `lib/database.ts`: server-side D1 `DB` binding and readiness check.
- `lib/submissions.ts`: claim, store and complete submissions.
- `lib/rateLimit.ts` and `lib/databaseMaintenance.ts`: atomic counters and cleanup.
- `app/api/leads/route.ts`: request validation, replay handling and delivery orchestration.
- `lib/leadbyte.ts`: payload construction and vendor response handling.
- `reports/` and reporting/reconciliation scripts in `scripts/`: reporting and export behavior.
- `LEAD-REPORTING.md`: detailed workflow and reconciliation guidance.

Campaign, supplier, offer, consent version, qualification rules, attribution allowlist and vendor configuration must match the new project. In particular, the existing submission code uses campaign `DASHCAMS` and supplier `27144`; these are application values, not schema defaults. Database access and reports stay server-side or through authenticated operator tooling.

The exported SQL was executed in a fresh in-memory SQLite database and its table/view columns, index definitions and seeded response codes were compared with the original migrations.
