-- Durable receipt before acknowledging native provider callbacks.
CREATE TABLE social_webhook_inbox (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  cursor INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  processed_at INTEGER
);
CREATE INDEX social_inbox_pending ON social_webhook_inbox(status, next_attempt_at);
