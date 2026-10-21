# Lead records, reporting and LeadByte reconciliation

**Bing website attribution:** Migration 0005 adds `microsoft_ads_leads`. Run
`npm run report:microsoft` for counts by ad campaign and processing status. Website source
and consent remain `WEBSITE`; the acquisition channel is recorded separately as `MICROSOFT_ADS`.
See [BING-ADS.md](BING-ADS.md) for click-ID capture, deployment and measurement limitations.

**Pipeline update:** New website and Google leads use asynchronous delivery. See [LEAD-PIPELINE.md](LEAD-PIPELINE.md) for migration 0004, source/consent fields, audit tables, processing states and retry semantics. `npm run report:pipeline` lists review, retry, failed and stalled records without customer details. The original states below describe historical synchronous submissions; new retryable failures are no longer classified as final rejections.

## What is saved

Each valid, qualified form submission with consent is written to Cloudflare D1 **before** contacting LeadByte. An atomic submission-token claim prevents double-clicks or replayed requests from creating duplicate lead records or deliveries. The database must accept the record before a lead can be sent.

The `submissions` table now contains:

| Data                   | Stored fields                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Contact                | `firstname`, `lastname`, normalized ZA `phone1`                                                                                        |
| Submission             | `request_id`, creation/completion times, fingerprint and token hash                                                                    |
| Consent                | `acceptterms`, `optinurl`, `optindate`, `consent_version`                                                                              |
| Campaign               | `campaign_id=DASHCAMS`, `supplier_id=27144`, `offer_id=3046`                                                                           |
| Callback               | Optional `preferredtimeofcall`, in the actual submitted format                                                                         |
| Exact submitted fields | `payload_json`; the values used for the form-encoded POST                                                                              |
| Qualification          | Age/vehicle/employment/income answers in `qualification_json`                                                                          |
| Attribution            | Allowlisted affiliate, transaction and UTM fields in `attribution_json`                                                                |
| Delivery               | `delivery_status`, application HTTP status, diagnostic code, uncertainty flag                                                          |
| LeadByte result        | `leadbyte_code`, `leadbyte_lead_id`, response text, `info` JSON, raw response, vendor timestamp, processing time, upstream HTTP status |

Only the documented fields go to LeadByte. Attribution stays in our database. Incoming tracking parameters cannot change the actual offer or campaign. The supplied guide allows multiple offer IDs; this particular landing page retains its established Dashcams offer `3046`.

Incomplete, invalid, unqualified, non-consenting, honeypot and rate-limited attempts are not contact lead records. They are rejected before recording. The browser already stops invalid forms before making an API request.

## Delivery states and response codes

| State               | Meaning                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `pending`           | Stored locally; no final delivery result saved yet. An old pending row needs investigation.          |
| `accepted`          | LeadByte returned numeric code `1` on a successful HTTP response.                                    |
| `duplicate`         | LeadByte returned `-2`: duplicate/resubmission.                                                      |
| `rejected`          | Another documented or unknown non-success vendor code, including `-3`/`-100`.                        |
| `uncertain`         | Timeout, network error, non-success HTTP status or malformed response; delivery might have happened. |
| `not_sent_disabled` | Qualified form recorded, but live delivery was disabled. No LeadByte request was made.               |
| `legacy_unknown`    | Older operational record without the new lead details; excluded from new reporting views.            |

`leadbyte_codes` contains code `1` and **all 18 rejection codes supplied in the ShyInc guide**, with their exact descriptions. Unknown codes are preserved with a null description, rather than being discarded. `lead_reporting` joins these descriptions to each full lead record. Missing vendor values stay null; no lead ID, success code, timestamp or processing time is invented.

For valid responses, all supplied result fields are retained, including HLR `info.status` and `info.code`. Raw bodies are private database data, never public form responses. Responses over the existing 64,000-character bound are marked uncertain with a size diagnostic rather than stored whole. The full result is not available after a timeout or a failed final database write; the retained uncertain/pending record identifies the case for investigation.

The supplied LeadByte duplicate window is **one submission per 90 days**. LeadByte enforces that phone/campaign rule. Our token-based replay protection is separate and survives deployments. An accepted submission is not proof of a sale, conversion, billability or later campaign disposition.

## Retention and access

Lead records and their vendor results are **no longer automatically deleted**. The daily cron deletes only expired rate-limit buckets. The original `expires_at` field remains for migration compatibility but is ignored for lead retention. Define an operator-managed retention/deletion policy when ready; routine deployment and cleanup will preserve this reporting history.

Reports are accessed through the authenticated Cloudflare account/D1 console, local Wrangler commands, or the password-protected owner dashboard described in [OWNER-REPORTING.md](OWNER-REPORTING.md). No database token is exposed to the browser. Exported detail reports contain contact information: store them securely and do not commit them. The `artifacts/` directory is ignored by Git.

## Reports

Daily counts (no contact details), grouped by South African date, campaign, offer, delivery status and vendor code:

```sh
npm run report:daily
```

Cases needing investigation (pending, uncertain, not sent, accepted without a vendor ID, unknown codes):

```sh
npm run report:issues
```

Export a summary for an inclusive South African date range:

```sh
npm run report -- 2026-09-01 2026-09-30 summary artifacts/september-summary.json
```

Export the same period with complete lead details for reconciliation:

```sh
npm run report -- 2026-09-01 2026-09-30 details artifacts/september-leads.json
```

Exports page through the full date range, rather than silently truncating at one page. They are live reads, not a locked database snapshot; in-flight delivery states may change while an export runs. For final reconciliation, rerun after the period closes and pending submissions settle. Existing output files are never overwritten.

## Match against LeadByte

The supplied guide describes the submit endpoint, not a retrieval/reporting API. Automatic pulling and downstream dispositions cannot be configured from this guide alone. Obtain a LeadByte export for the **same campaign, supplier and date range**. Normalize it into a JSON array (or `{ "leads": [...] }`) with `leadId`, optional string `phone1`, and optional numeric submission `code`:

```json
[{ "leadId": 123456, "phone1": "0613394600", "code": 1 }]
```

Keep phone values as strings to retain leading zeroes. Do not map a downstream sales/disposition status into the submission `code` field.

```sh
npm run reconcile -- artifacts/september-leads.json artifacts/leadbyte-september.json artifacts/september-matches.json
```

The matcher uses exact LeadByte IDs first, checks supplied phone/code values for mismatches, flags duplicate IDs, and lists unmatched rows. A normalized phone match is only a **candidate requiring review**, since the same phone may occur on several attempts. `not_in_import` means absent from the supplied file, not proof that LeadByte never received it. Review the export scope and uncertain deliveries before retrying anything. The matcher does not resend leads or change database history.

No live submission was enabled as part of this reporting change. Forms submitted while delivery is disabled are now retained as `not_sent_disabled`, and are not automatically queued or sent later. Enable delivery separately when the campaign is ready.
