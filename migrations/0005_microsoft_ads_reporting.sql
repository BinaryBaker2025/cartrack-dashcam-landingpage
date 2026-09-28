-- Reuse the existing attribution JSON and ad campaign columns. No lead rows change.
-- Ingestion source stays WEBSITE; acquisitionSource identifies the advertising channel.
CREATE VIEW microsoft_ads_leads AS
SELECT submission_key AS lead_id, request_id, source AS ingestion_source,
  created_at, completed_at, updated_at, source_campaign_id, campaign_name, ad_group_id, ad_id,
  json_extract(attribution_json, '$.msclkid') AS msclkid,
  json_extract(attribution_json, '$.utm_source') AS utm_source,
  json_extract(attribution_json, '$.utm_medium') AS utm_medium,
  json_extract(attribution_json, '$.utm_campaign') AS utm_campaign,
  json_extract(attribution_json, '$.utm_term') AS utm_term,
  processing_status, delivery_status, retry_count, leadbyte_code, leadbyte_lead_id,
  diagnostic_code, is_test
FROM submissions
WHERE source = 'WEBSITE' AND json_extract(metadata_json, '$.acquisitionSource') = 'MICROSOFT_ADS';

CREATE INDEX submissions_acquisition_created
  ON submissions(json_extract(metadata_json, '$.acquisitionSource'), created_at);
