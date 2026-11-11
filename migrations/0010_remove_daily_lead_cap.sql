-- Release leads held by the former local daily cap for normal outbox recovery.
UPDATE lead_outbox SET available_at = 0, published_at = NULL
WHERE lead_id IN (SELECT submission_key FROM submissions WHERE processing_status = 'deferred');
DROP INDEX IF EXISTS lead_attempts_daily_cap;
