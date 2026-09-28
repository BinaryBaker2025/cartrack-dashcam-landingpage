# Direct Cloudflare lead webhooks

These endpoints receive native platform callbacks directly. No Zapier, Make, or other
relay is involved. Facebook and Instagram Instant Form ads use the same Meta Page
`leadgen` subscription. These are lead integrations, separate from Bing's IndexNow.

| Platform             | Callback URL after deployment                 |
| -------------------- | --------------------------------------------- |
| Facebook / Instagram | `https://bestcardash.com/api/webhooks/meta`   |
| TikTok Instant Forms | `https://bestcardash.com/api/webhooks/tiktok` |

## Deployment and credentials

Run `npm run deploy` to build, apply migration `0006_social_webhook_inbox.sql`,
deploy to Cloudflare, and notify IndexNow. This implementation has not itself
registered external subscriptions or supplied your platform credentials.
The existing D1 database, lead queue, and five-minute recovery cron are reused.
Allow these callback paths through any Cloudflare Access or interactive bot challenge.
Keep HTTPS enabled. A missing secret/account configuration returns HTTP 503.

Set runtime secrets using `npx wrangler secret put NAME` (prompted input):

- `META_APP_SECRET`: Meta app secret for signature verification.
- `META_VERIFY_TOKEN`: independently generated random token, at least 32 characters;
  enter the same value in Meta's callback verification setup.
- `META_PAGE_ACCESS_TOKEN`: Page access token with lead retrieval access.
- `TIKTOK_APP_SECRET`: API for Business application's signing secret.

Set runtime configuration in `wrangler.jsonc` vars or through Worker secrets:

- `META_PAGE_ID`: the Facebook Page owning your Facebook/Instagram forms.
- `META_GRAPH_VERSION`: a supported Graph version enabled for your app, e.g. `v25.0`;
  confirm in your app dashboard. No unversioned Graph requests are sent.
- `META_FORM_MAPPINGS`: form-ID keyed JSON based on the example in
  `config/social-form-mappings.example.json`.
- `TIKTOK_ADVERTISER_ID`: your authorized ad account ID, as a string.
- `TIKTOK_FORM_MAPPINGS`: the same mapping format, keyed by TikTok `page_id`.
- `SOCIAL_LEADS_TEST_MODE`: defaults to `true` when absent. Use `false` only after
  verification with test leads and the actual form answers/consent.

Each callback currently accepts one configured Meta Page or TikTok advertiser.
The receiver checks those account IDs as well as cryptographic signatures.

## Meta: Facebook and Instagram

1. In your Meta developer app configure the Page Webhooks callback with the Meta
   URL above and your `META_VERIFY_TOKEN`. The GET handler echoes `hub.challenge`
   only when `hub.mode=subscribe` and the token matches.
2. Subscribe to Page `leadgen` events, grant the app the necessary Page/lead permissions
   (including `leads_retrieval`), and assign lead access in your Business settings.
   Complete any required app review/business verification for your account.
3. Subscribe the app to your Page's `leadgen` field through
   `POST /{page-id}/subscribed_apps` using your supported Graph API version and
   Page access token. This is required in addition to configuring the app callback.
4. Generate a lead with Meta's Lead Ads Testing Tool. The server verifies the raw
   body using `X-Hub-Signature-256`, saves the notification, and retrieves the lead
   by `leadgen_id` using the Page token. It verifies the returned lead/form IDs.
5. Confirm `source=META_ADS` and `processing_status=test` in D1 before live activation.

Instagram Instant Form ad leads owned by the configured Page follow this same path;
this is not a webhook for Instagram DMs or profile contact buttons.

## TikTok: native Marketing API subscription

Use your TikTok API for Business app with Marketing API access and advertiser admin
authorization. Register the callback via:

`POST https://business-api.tiktok.com/open_api/v1.3/subscription/subscribe/`

Send `Content-Type: application/json` and this JSON from a private API client:

```json
{
  "app_id": "YOUR_APP_ID",
  "secret": "YOUR_APP_SECRET",
  "subscribe_entity": "LEAD",
  "callback_url": "https://bestcardash.com/api/webhooks/tiktok",
  "subscription_detail": {
    "access_token": "YOUR_MARKETING_API_ACCESS_TOKEN",
    "advertiser_id": "YOUR_ADVERTISER_ID",
    "lead_source": "INSTANT_FORM",
    "page_id": "YOUR_INSTANT_FORM_PAGE_ID"
  }
}
```

Save the returned `subscription_id`. Repeat for another form, or omit `page_id`
to subscribe to all Instant Forms in that advertiser account. Configure mappings
for each form. Revoking the subscription's access token stops webhook delivery;
reauthorize and register again if that happens.

The callback accepts TikTok's native `object: 1`, `entry[]`, and `changes[]` payload.
It verifies `TikTok-Signature` (`t=...,s=...`) using HMAC-SHA256 of the timestamp,
a period, and the raw request body; delivery timestamps must be within five minutes.
It preserves 64-bit numeric advertiser/form/ad IDs as exact strings. Lead answers
arrive in the callback, so a separate retrieval token is not needed by this Worker.
Use TikTok's test lead tools while test mode is enabled and verify the signed
callback in your account before enabling live delivery. Unsigned callbacks are rejected.

## Mapping, consent, and tests

Field names default to `first_name`, `last_name`, `email`, `phone_number`, plus
`full_name` for Meta or `name` for TikTok. Copy the mapping example, replace the
form ID, question names, and answer labels with actual platform values. Answer
matching is exact. Do not copy the example consent text into production.
Only single string answers are mapped; multi-select, object, and null answers stay
unknown and cannot implicitly grant consent or pass qualification.

Qualification and consent are never inferred from submitting a form. Missing answers
stay unknown; the existing pipeline retains incomplete live leads for review and
does not send them to the affiliate. Map explicit contact permission separately
from future marketing permission and include the actual consent wording/version.
Test mode prevents affiliate delivery even if a test form is fully qualified.
Platform test IDs must not be reused for live submissions: retries do not overwrite leads.

## Recovery and monitoring

Authenticated notifications are committed to `social_webhook_inbox` before HTTP 200.
Processing starts after the response; the five-minute cron recovers interrupted work.
Progress within batches is checkpointed. Provider/DB failures retry with backoff,
then become `failed` after ten attempts. Inspect failures and fix credentials or
mappings before resetting `status='pending', attempts=0, next_attempt_at=0,
lease_until=0` for the specific inbox ID. Keep its cursor to resume unfinished work.
Processed raw notifications are retained for 30 days. Failed notifications remain
for investigation; they contain personal information and need operator retention review.
Tokens and raw contact data are not logged.

```sql
SELECT id, provider, status, attempts, cursor, error_code, received_at
FROM social_webhook_inbox WHERE status != 'processed' ORDER BY received_at;
SELECT source, processing_status, COUNT(*) AS count
FROM submissions WHERE source IN ('META_ADS','TIKTOK_ADS')
GROUP BY source, processing_status;
```

Duplicates are guarded both by notification hash and the shared provider/lead-ID
unique key. A changed notification for an already-stored lead cannot deliver it twice.
No live platform credentials are included in automated tests.

## Official references

- Meta Webhooks: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/
- Meta lead retrieval: https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/
- TikTok lead subscriptions: https://business-api.tiktok.com/portal/docs?id=1810521739537409
- TikTok subscription API: https://business-api.tiktok.com/portal/docs?id=1739092028876801
- TikTok signatures: https://business-api.tiktok.com/portal/docs?id=1759978341579777
