-- Reusable Cloudflare D1 / SQLite schema. Apply once to an empty database.
-- Equivalent to migrations 0001 through 0003; no customer data included.
-- Use this file OR the original migrations, not both.

CREATE TABLE submissions (
  submission_key TEXT PRIMARY KEY NOT NULL,
  fingerprint TEXT NOT NULL,
  result TEXT,
  http_status INTEGER,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  expires_at INTEGER NOT NULL,
  consent_version TEXT NOT NULL
, record_version INTEGER NOT NULL DEFAULT 0, request_id TEXT, firstname TEXT, lastname TEXT, phone1 TEXT, optinurl TEXT, optindate TEXT, acceptterms TEXT, offer_id TEXT, campaign_id TEXT, supplier_id TEXT, preferredtimeofcall TEXT, payload_json TEXT, qualification_json TEXT, attribution_json TEXT, delivery_status TEXT NOT NULL DEFAULT 'legacy_unknown', leadbyte_code INTEGER, leadbyte_lead_id TEXT, leadbyte_response TEXT, leadbyte_info_json TEXT, leadbyte_raw_response TEXT, leadbyte_timestamp TEXT, leadbyte_process_time REAL, upstream_http_status INTEGER, diagnostic_code TEXT, delivery_uncertain INTEGER NOT NULL DEFAULT 0, email TEXT);

CREATE TABLE rate_limits (
  bucket_key TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE leadbyte_codes (code INTEGER PRIMARY KEY, description TEXT NOT NULL);

CREATE INDEX submissions_expiry ON submissions(expires_at);

CREATE INDEX submissions_created ON submissions(created_at);

CREATE INDEX rate_limits_expiry ON rate_limits(expires_at);

CREATE INDEX submissions_phone ON submissions(phone1, created_at);

CREATE INDEX submissions_leadbyte_id ON submissions(leadbyte_lead_id);

CREATE INDEX submissions_delivery ON submissions(delivery_status, created_at);

CREATE INDEX submissions_code ON submissions(leadbyte_code, created_at);

CREATE UNIQUE INDEX submissions_request_id ON submissions(request_id) WHERE request_id IS NOT NULL;

CREATE VIEW lead_reporting AS
SELECT s.*, c.description AS leadbyte_code_description,
  date(s.created_at / 1000, 'unixepoch', '+2 hours') AS submitted_date_sa,
  datetime(s.created_at / 1000, 'unixepoch') AS submitted_at_utc,
  json_extract(s.attribution_json, '$.affiliate_id') AS affiliate_id,
  json_extract(s.attribution_json, '$.transaction_id') AS transaction_id,
  json_extract(s.attribution_json, '$.utm_source') AS utm_source,
  json_extract(s.attribution_json, '$.utm_campaign') AS utm_campaign
FROM submissions s LEFT JOIN leadbyte_codes c ON c.code = s.leadbyte_code
WHERE s.record_version = 1;

CREATE VIEW lead_daily_summary AS
SELECT submitted_date_sa, campaign_id, supplier_id, offer_id,
  delivery_status, leadbyte_code, leadbyte_code_description, COUNT(*) AS leads
FROM lead_reporting
GROUP BY submitted_date_sa, campaign_id, supplier_id, offer_id,
  delivery_status, leadbyte_code, leadbyte_code_description;

INSERT INTO leadbyte_codes (code, description) VALUES
  (-100, 'Internal error'),
  (-19, 'Exchange is not enabled'),
  (-17, 'Number matched CTPS database'),
  (-16, 'Number matched DNCR database'),
  (-15, 'Number matched TPS database'),
  (-14, 'IP address country rejection'),
  (-13, 'Landline rejection'),
  (-12, 'Email rejection'),
  (-11, 'IP address blocked'),
  (-10, 'PAF rejection'),
  (-9, 'Campaign not active'),
  (-8, 'HLR rejection'),
  (-7, 'Supplier not authorised'),
  (-6, 'Filter rejection'),
  (-5, 'Validation error'),
  (-4, 'Campaign cap reached'),
  (-3, 'Remote system error'),
  (-2, 'Duplicate or resubmission'),
  (1, 'Accepted');
