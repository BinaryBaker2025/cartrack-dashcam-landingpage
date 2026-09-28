-- Aggregate operational report, no contact fields or click IDs.
SELECT date(created_at / 1000, 'unixepoch', '+2 hours') AS submitted_date_sa,
  source_campaign_id, ad_group_id, ad_id, processing_status,
  COUNT(*) AS leads,
  SUM(CASE WHEN msclkid IS NOT NULL THEN 1 ELSE 0 END) AS leads_with_click_id
FROM microsoft_ads_leads
WHERE is_test = 0
GROUP BY submitted_date_sa, source_campaign_id, ad_group_id, ad_id, processing_status
ORDER BY submitted_date_sa DESC, source_campaign_id;
