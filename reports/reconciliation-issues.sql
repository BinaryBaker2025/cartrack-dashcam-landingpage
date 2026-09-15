-- Read-only operational checks. No contact details in this result.
SELECT request_id, submitted_at_utc, delivery_status, leadbyte_lead_id,
  leadbyte_code, leadbyte_code_description, diagnostic_code,
  CASE
    WHEN delivery_status = 'pending' THEN 'Pending: verify whether delivery started/completed'
    WHEN delivery_status = 'uncertain' THEN 'Uncertain: reconcile before retrying'
    WHEN delivery_status = 'accepted' AND leadbyte_lead_id IS NULL THEN 'Accepted without a LeadByte ID'
    WHEN delivery_status = 'not_sent_disabled' THEN 'Recorded locally; delivery was disabled'
    WHEN leadbyte_code IS NOT NULL AND leadbyte_code_description IS NULL THEN 'Unrecognised LeadByte code'
  END AS review_reason
FROM lead_reporting
WHERE delivery_status IN ('pending', 'uncertain', 'not_sent_disabled')
  OR (delivery_status = 'accepted' AND leadbyte_lead_id IS NULL)
  OR (leadbyte_code IS NOT NULL AND leadbyte_code_description IS NULL)
ORDER BY created_at DESC;
