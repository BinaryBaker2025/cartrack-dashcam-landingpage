-- Only pseudonymous identifiers and safe response data: no raw contact details.
CREATE TABLE submissions (
  submission_key TEXT PRIMARY KEY NOT NULL,
  fingerprint TEXT NOT NULL,
  result TEXT,
  http_status INTEGER,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  expires_at INTEGER NOT NULL,
  consent_version TEXT NOT NULL
);
CREATE INDEX submissions_expiry ON submissions(expires_at);
CREATE INDEX submissions_created ON submissions(created_at);

CREATE TABLE rate_limits (
  bucket_key TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX rate_limits_expiry ON rate_limits(expires_at);
