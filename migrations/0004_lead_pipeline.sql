-- Additive: historical synchronous submissions are never automatically queued.
ALTER TABLE submissions ADD COLUMN source TEXT NOT NULL DEFAULT 'WEBSITE';
ALTER TABLE submissions ADD COLUMN external_lead_id TEXT;
ALTER TABLE submissions ADD COLUMN source_campaign_id TEXT;
ALTER TABLE submissions ADD COLUMN campaign_name TEXT;
ALTER TABLE submissions ADD COLUMN ad_group_id TEXT;
ALTER TABLE submissions ADD COLUMN ad_id TEXT;
ALTER TABLE submissions ADD COLUMN form_id TEXT;
ALTER TABLE submissions ADD COLUMN marketing_consent INTEGER;
ALTER TABLE submissions ADD COLUMN consent_text TEXT;
ALTER TABLE submissions ADD COLUMN consent_timestamp TEXT;
ALTER TABLE submissions ADD COLUMN consent_source TEXT;
ALTER TABLE submissions ADD COLUMN submitted_at TEXT;
ALTER TABLE submissions ADD COLUMN original_phone TEXT;
ALTER TABLE submissions ADD COLUMN metadata_json TEXT;
ALTER TABLE submissions ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE submissions ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN updated_at INTEGER;
ALTER TABLE submissions ADD COLUMN lease_until INTEGER;
ALTER TABLE submissions ADD COLUMN attempt_id TEXT;
ALTER TABLE submissions ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX submissions_source_external ON submissions(source, external_lead_id)
  WHERE external_lead_id IS NOT NULL;
CREATE INDEX submissions_processing ON submissions(processing_status, updated_at);

CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  external_lead_id TEXT,
  received_at INTEGER NOT NULL,
  processed_at INTEGER,
  processing_status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  error_message TEXT,
  lead_id TEXT REFERENCES submissions(submission_key)
);
CREATE INDEX webhook_events_lead ON webhook_events(lead_id, received_at);
CREATE INDEX webhook_events_status ON webhook_events(processing_status, received_at);

-- Transactional outbox closes the D1 commit / queue publish failure window.
CREATE TABLE lead_outbox (
  lead_id TEXT PRIMARY KEY REFERENCES submissions(submission_key),
  created_at INTEGER NOT NULL,
  published_at INTEGER,
  publish_attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX lead_outbox_pending ON lead_outbox(published_at, created_at);

CREATE TABLE lead_attempts (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES submissions(submission_key),
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  outcome TEXT NOT NULL,
  result_json TEXT
);
CREATE INDEX lead_attempts_lead ON lead_attempts(lead_id, started_at);

CREATE TABLE lead_dead_letters (
  message_id TEXT PRIMARY KEY,
  lead_id TEXT,
  received_at INTEGER NOT NULL,
  reason TEXT NOT NULL
);
