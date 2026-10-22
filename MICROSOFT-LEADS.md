# Microsoft leads delivered by an intermediary

## Website UET configuration (October 2026)

The root layout installs UET tag `187282616` once on every page, with automatic SPA
page tracking. Account reference supplied by the advertiser: `G107EBXA`. This reference
is not an API credential or a native lead form ID and is not needed in the browser tag.

Consent defaults to `ad_storage: denied` before loading UET. The advertising preference
panel at the bottom of every page offers accept/decline and a way to reopen the choice.
The choice persists in local storage and is separate from callback permission. UET can
send cookieless measurement signals while denied. Enhanced conversion identifiers are
sent only with advertising consent and a successful website API response, immediately
before the custom UET event `lead_submit_success`. Duplicates, rejected submissions and
browser receipt replays do not fire this event. No revenue value is invented.

Before launch, check the existing conversion goal: its UET event action must match
`lead_submit_success` if using this custom event. If the goal uses another action, align
that configuration before relying on reports. Destination-page goals need their actual
configured URL; this application shows an inline thank-you state. Enable enhanced
conversions in Microsoft Advertising and verify with UET Tag Helper after deployment.
The goal configuration and account settings have not been inspected or changed here.

MSCLKID is a click identifier, not a native lead form ID. Its existing session capture
and lead persistence remain in place. Installing UET does not enable account auto-tagging:
verify MSCLKID auto-tagging in Microsoft Advertising and test a real ad-click landing URL.
Campaign IDs, native form IDs and a supported upstream delivery integration are still
needed only for the separate native-lead workflow below. No offline conversion uploader
or Microsoft reporting API authentication is configured by this browser integration.

Microsoft references: [UET installation](https://help.ads.microsoft.com/apex/index/3/en/56688),
[Consent Mode](https://www.about.ads.microsoft.com/en/blog/post/february-2026/advanced-consent-mode-preserving-accurate-measurement-while-respecting-user-privacy).

This is a BestCarDash JSON contract for a trusted CRM, Zapier workflow or another supported
delivery integration. It is **not** a claim that Microsoft Advertising natively posts webhooks,
or that Zapier has a native Bing lead-form trigger. The upstream integration must actually
be able to retrieve the lead. Google and the existing Bing website path remain available.

## Endpoint and authentication

After deployment: `POST https://bestcardash.com/api/webhooks/microsoft`

Headers:

```text
Content-Type: application/json
Authorization: Bearer <MICROSOFT_ADS_WEBHOOK_TOKEN>
```

Generate a separate random token of at least 32 characters. Store it as the Cloudflare Worker
secret `MICROSOFT_ADS_WEBHOOK_TOKEN`, and in the intermediary's private credential settings.
Never put it in a form, URL, client-side script or public document. Google uses its own secret.

```sh
npx wrangler secret put MICROSOFT_ADS_WEBHOOK_TOKEN
npm run deploy
```

The deploy script builds, applies pending D1 migrations and deploys. The existing shared D1,
main queue, DLQ and scheduled outbox recovery must already be provisioned; see LEAD-PIPELINE.md.
No new migration or queue is needed for this endpoint. No production deployment or token
configuration has been performed automatically.

For local use, put a separate local token in ignored `.dev.vars`. Use `npm run dev` after
`npm run db:migrate:local`. Local HTTP is allowed only on localhost with `DEPLOY_ENV=development`.
Keep `LEADBYTE_ENABLED=false` for manual local testing.

## Payload contract

Required: a stable string `externalLeadId`, either `fullName` or `firstName`, and at least
one of `email` / `phone`. Incomplete contact details are retained for review, not delivered.
All IDs must be JSON strings, including campaign IDs, to avoid numeric precision loss.
Optional fields should be omitted or null rather than supplied as empty strings.
Maximum request body: 64 KiB. Boolean fields accept only JSON true, false or null.

Example synthetic test payload (save as `microsoft-test.json`):

```json
{
  "source": "microsoft_ads",
  "externalLeadId": "crm:synthetic-test-001",
  "fullName": "Test van der Example",
  "email": "test@example.com",
  "phone": "0821234567",
  "campaignId": "123456",
  "adGroupId": "234567",
  "adId": "987654",
  "formId": "test-form-1",
  "submittedAt": "2026-09-21T14:00:00Z",
  "qualification": {
    "age": "18_plus",
    "vehicle": "yes",
    "employment": "employed",
    "income": "10000_plus"
  },
  "contactConsent": true,
  "marketingConsent": false,
  "consentText": "Synthetic test contact permission; replace with the actual wording shown to the customer.",
  "consentVersion": "synthetic-test-v1",
  "consentTimestamp": "2026-09-21T14:00:00Z",
  "isTest": true
}
```

Also supported: `firstName`, `lastName`, `campaignName`. Separate names take precedence.
When only fullName is available, the first word becomes firstname and the entire remainder
becomes lastname. A single name has no invented surname and stays incomplete. The exact
original fullName is retained in `metadata_json.fullName` and the sanitized webhook payload.

`submittedAt` and `consentTimestamp` are ISO timestamps with a timezone. Receipt time is
generated by the server. Consent time is not inferred from receipt time.

## Instructions for the marketing / CRM team

1. Configure a supported lead source in the intermediary. Confirm it can retrieve actual
   Microsoft-origin leads; creating this destination endpoint does not provide an upstream trigger.
2. Collect name, email, mobile, age 18+, vehicle access, employment, income R10,000+ and explicit
   permission to contact the customer about this offer. Collect future marketing consent separately.
3. Add a server-side HTTP POST action to the endpoint above, with the two headers and JSON body.
4. Map the upstream lead's persistent ID to `externalLeadId`. Prefix IDs by the CRM/account if
   necessary to avoid collisions. Keep the same ID across retries; do not use a new UUID or execution
   timestamp per attempt. An intermediary may generate an ID only if it persists and reuses it.
5. Map answers explicitly. Qualified values are `18_plus`, `yes`, `employed` (or `self_employed`),
   and `10000_plus`. Negative values include `under_18`, `no`, `unemployed`, `under_10000`.
   Unknown/missing answers must stay missing, never become yes. Shared campaign rules determine eligibility.
6. Map contactConsent and marketingConsent from actual answers. Include the exact contact consent
   wording and version shown by the form. Do not copy the synthetic example into a live workflow.
7. Send an `isTest: true` lead first. Confirm HTTP 200 and a `test` status in D1. Send it again with
   the same ID and confirm `duplicate: true`. Test leads never enter affiliate delivery.
8. Enable real delivery only after checking mapping and consent. Set `isTest: false` for actual
   submissions. A test ID must not be reused as a live ID: duplicates do not overwrite stored leads.

## Responses, retries and processing

- 200: safely recorded (or duplicate). Response contains `leadId`, `duplicate`, `status`.
  This is a receipt, not proof of affiliate acceptance. The status may still be `pending` even
  when publishing has just completed; query D1 for the authoritative current processing state.
- 400: malformed JSON, oversized body, wrong types or missing contract fields; correct the mapping.
- 401: missing/incorrect Bearer token. 403: non-HTTPS request outside local development.
- 503: unavailable configuration/database; the intermediary can retry with the same externalLeadId.

The database's existing unique `(source, external_lead_id)` index enforces idempotency.
Source is always `MICROSOFT_ADS` regardless of any other incoming fields. Repeated IDs create
duplicate audit events and retain the original lead; corrected data requires an operator workflow.
Do not bypass qualification review by sending a new ID for the same submission.

Qualified leads with contact permission and consent wording/version use the existing LeadService,
transactional outbox, queue and affiliate consumer. Unknown consent/qualification stays pending_review;
explicit disqualification is rejected. Marketing consent is separate and never inferred. Queue publish
failures are recovered by cron after durable persistence. Temporary affiliate failures retry; permanent
rejections are stored and acknowledged. The existing DLQ and uncertain-delivery safeguards are reused.

Raw JSON content is retained in `webhook_events.payload_json` after secret-field/value redaction;
whitespace/key serialization is not retained byte-for-byte. Authentication headers are never stored.
Malformed/unauthenticated bodies are not retained; safe diagnostic events are logged instead.
Normalized fields, original phone, metadata and state are in `submissions`; affiliate responses and
attempt history use the existing `lead_attempts` and submission result columns.

## Test and inspect

Example Bash request using a token supplied through the environment (do not commit its value):

```sh
curl -X POST 'http://localhost:3000/api/webhooks/microsoft' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $MICROSOFT_ADS_WEBHOOK_TOKEN" \
  --data-binary @microsoft-test.json
```

```sh
npm test
npm run test:worker
npm run build:cloudflare
npx wrangler d1 execute DB --local --command "SELECT request_id,processing_status,diagnostic_code FROM submissions WHERE source='MICROSOFT_ADS' ORDER BY created_at DESC LIMIT 20"
npx wrangler d1 execute DB --remote --command "SELECT id,lead_id,processing_status,error_message FROM webhook_events WHERE provider='MICROSOFT_ADS' ORDER BY received_at DESC LIMIT 20"
npm run report:pipeline
```

Automated Microsoft tests use real SQLite migrations and the shared queue consumer with a mock
affiliate. They cover mapping, audit, authentication, invalid bodies, idempotency, persistence-before-queue,
outbox recovery, success/rejection/retry and review/test suppression. No real customer leads are sent.

If Microsoft later publishes native delivery, add authentication and payload conversion in a provider
adapter. Keep the stable source/lead identity and shared LeadService/consumer intact.
