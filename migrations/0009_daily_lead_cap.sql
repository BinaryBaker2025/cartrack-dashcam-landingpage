ALTER TABLE lead_outbox ADD COLUMN available_at INTEGER NOT NULL DEFAULT 0;
CREATE INDEX lead_attempts_daily_cap ON lead_attempts(started_at, lead_id);
