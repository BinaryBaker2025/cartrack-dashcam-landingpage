-- No customer contact fields. Use the internal lead ID to investigate privately.
SELECT submission_key AS lead_id, source, processing_status, delivery_status,
  retry_count, diagnostic_code, leadbyte_code, leadbyte_lead_id,
  datetime(updated_at / 1000, 'unixepoch') AS updated_utc
FROM submissions
WHERE processing_status IN ('pending_review','retry','failed','dead_letter','uncertain','not_sent_disabled','rejected')
   OR (processing_status IN ('pending','queued','processing') AND updated_at < (unixepoch() - 900) * 1000)
ORDER BY updated_at DESC;
