# Bing / Microsoft Advertising launch

## What is implemented

For leads delivered by a CRM, Zapier or another intermediary, use the authenticated
[`/api/webhooks/microsoft` integration](MICROSOFT-LEADS.md). It accepts our own JSON contract;
it does not assume native Microsoft webhook support. The website path below remains available.

This release supports **Bing ads that send visitors to the BestCarDash website**:

```text
Bing ad → bestcardash.com → existing website form → LeadService → D1 → Queue → LeadByte
```

The Google webhook remains available and unchanged. The Bing path captures Microsoft's
`msclkid`, campaign/ad group/ad IDs and UTM tags, stores them with the website lead, and
provides a dedicated D1 reporting view. It uses the same qualification, consent, idempotency,
outbox, retry and DLQ behavior as other website leads.

There is **no Microsoft-hosted lead-form webhook** in this release. Microsoft’s public ad
extension API documentation does not provide a verified lead-form delivery/authentication
contract for this implementation. If the account has a hosted-form pilot/export option,
obtain its official documentation and a redacted payload before implementing its mapper.
Do not give the team an invented `/api/webhooks/microsoft-ads` URL or Google's webhook key.

## Give the marketing team these settings

**Final URL / website destination:**

```text
https://bestcardash.com/
```

**Privacy notice:**

```text
https://bestcardash.com/privacy
```

**Final URL suffix** (paste without a leading `?`):

```text
utm_source=bing&utm_medium=cpc&utm_campaign=bestcardash_dashcam&ms_campaign_id={CampaignId}&ms_adgroup_id={AdGroupId}&ms_ad_id={AdId}&utm_term={Keyword}
```

`bestcardash_dashcam` is a campaign label; change it per campaign if desired. Microsoft fills
the numeric IDs and keyword when serving the ad. Use the account's URL test/preview to
verify expansion. Unresolved `{...}` identifiers are discarded by the app.

Enable **Add Microsoft Click ID (MSCLKID) to URLs to allow conversion tracking** in the
account-level settings. Microsoft adds `msclkid` automatically; do not put a fixed click ID
into the live suffix. The final suffix goes in the campaign/ad URL options, not a webhook field.

No new Microsoft API key, OAuth app, webhook secret, or additional queue is needed for this
website path. Campaign creation, budget and activation remain with the marketing team.

## Deploy

From the project folder, with the existing Worker/D1 and queues already configured:

```sh
npm test
npm run db:migrate:local
npm run deploy
```

`npm run deploy` builds, applies remote migrations and deploys. If this is the first deployment
of the shared queue pipeline, create its resources using [LEAD-PIPELINE.md](LEAD-PIPELINE.md)
first. A Google webhook key is needed only to activate Google lead forms, not for Bing website ads.

Migration `0005_microsoft_ads_reporting.sql` adds the `microsoft_ads_leads` reporting view
and an acquisition-channel index. It does not modify existing lead rows or duplicate contact
columns. Migration 0004 remains required for the common queue pipeline.

## Storage and attribution behavior

- The existing session attribution code captures the URL values and sends them with `/api/leads`.
- Supported click IDs are 32 hexadecimal characters or hyphenated UUIDs. Numeric campaign/ad IDs
  stay strings, preserving large IDs. Malformed values and unknown body properties are discarded.
- IDs remain in `attribution_json`; campaign, ad group and ad IDs also use the existing
  `source_campaign_id`, `ad_group_id` and `ad_id` fields.
- `campaign_id` stays `DASHCAMS`, the affiliate campaign. Incoming URL values cannot override it.
- Ingestion `source` and `consent_source` stay `WEBSITE`. `metadata_json.acquisitionSource` is
  `MICROSOFT_ADS` for a valid click ID (without a conflicting source) or recognised paid Bing UTMs.
- URL attribution is self-reported marketing evidence, not authenticated proof that Microsoft
  sent a lead. It never changes consent or qualification.
- A plain Bing organic UTM is not classified as paid advertising. A missing click ID is not invented.
- The browser retains attribution in the current session across ordinary page navigation.
  A new campaign/click replaces the previous advertising attribution; it does not mix old campaign
  IDs with new ones. Affiliate referral fields retain their existing behavior.
- Duplicate submission tokens retain the original attribution and never create a second delivery.
  The click ID is not used as a lead idempotency key: a click and a submitted lead are different things.
- No MSCLKID or new advertising fields are forwarded to LeadByte or written to normal console logs.
- No extra tracking SDK, advertising cookie, external script or Microsoft network call is added.

## Verify before campaign launch

Run the synthetic tests; they do not submit fake contacts to the affiliate:

```sh
npm test
npm run test:worker
node node_modules/@playwright/test/cli.js test --grep "Bing click attribution"
```

The browser test follows a Bing-tagged URL, navigates to a clean URL, fills the form and checks
the request's attribution with the HTTP submission intercepted. Unit/integration tests verify
actual D1 persistence and the shared queue consumer against a mocked affiliate.

For a manual **local** test, first run `npm run setup:local` (disables live affiliate delivery),
then `npm run dev`, and visit:

```text
http://localhost:3000/?utm_source=bing&utm_medium=cpc&utm_campaign=synthetic_test&msclkid=0123456789abcdef0123456789abcdef&ms_campaign_id=123&ms_adgroup_id=456&ms_ad_id=789
```

Submit synthetic details only locally while `LEADBYTE_ENABLED=false`. Expect the existing
disabled-delivery message and a retained D1 record; that is deliberate, not successful live delivery.
Inspect it without printing contact information:

```sh
npx wrangler d1 execute DB --local --command "SELECT request_id,source_campaign_id,ad_group_id,ad_id,processing_status FROM microsoft_ads_leads ORDER BY created_at DESC LIMIT 10"
```

For production, use only campaign-approved details for an end-to-end test. Verify the ad's
final URL contains the expanded IDs and `msclkid`, submit the form, then inspect its lead status:

```sh
npm run report:microsoft
npm run report:pipeline
```

In the authenticated D1 console, `SELECT * FROM microsoft_ads_leads ORDER BY created_at DESC LIMIT 20`
includes click IDs but no customer contact fields. Restrict click-ID access to authorised operators.
The standard detailed report export now also exposes `acquisition_source` and `msclkid`.

## Conversion tracking is a separate next step

Capturing a lead in D1 does **not** automatically register a conversion in Microsoft Advertising.
No UET tag ID, conversion goal or Microsoft API credentials have been supplied, so no live conversion
reporting has been enabled. The team should supply the UET tag ID, intended conversion event/goal,
and measurement/consent requirements if that integration is wanted.

The saved click ID and affiliate acceptance timestamp can support future accepted-lead conversion
reporting. A website receipt means the lead was saved; `processing_status=accepted` means LeadByte
accepted it. Neither establishes a sale or a payable conversion.

## Official references checked

- [Microsoft URL tracking and final URL suffixes](https://learn.microsoft.com/en-us/advertising/guides/url-tracking-upgraded-urls?view=bingads-13)
- [Microsoft click IDs and Conversions API prerequisites](https://learn.microsoft.com/en-us/advertising/guides/uet-conversion-api-integration?view=bingads-13)
- [Microsoft Advertising ad extensions](https://learn.microsoft.com/en-us/advertising/guides/ad-extensions?view=bingads-13)
