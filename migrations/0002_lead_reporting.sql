-- Additive migration: preserve existing submission tokens and safe replay responses.
-- expires_at is retained for compatibility but is no longer used to delete leads.
ALTER TABLE submissions ADD COLUMN record_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN request_id TEXT;
ALTER TABLE submissions ADD COLUMN firstname TEXT;
ALTER TABLE submissions ADD COLUMN lastname TEXT;
ALTER TABLE submissions ADD COLUMN phone1 TEXT;
ALTER TABLE submissions ADD COLUMN optinurl TEXT;
ALTER TABLE submissions ADD COLUMN optindate TEXT;
ALTER TABLE submissions ADD COLUMN acceptterms TEXT;
ALTER TABLE submissions ADD COLUMN offer_id TEXT;
ALTER TABLE submissions ADD COLUMN campaign_id TEXT;
ALTER TABLE submissions ADD COLUMN supplier_id TEXT;
ALTER TABLE submissions ADD COLUMN preferredtimeofcall TEXT;
ALTER TABLE submissions ADD COLUMN payload_json TEXT;
ALTER TABLE submissions ADD COLUMN qualification_json TEXT;
ALTER TABLE submissions ADD COLUMN attribution_json TEXT;
ALTER TABLE submissions ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'legacy_unknown';
ALTER TABLE submissions ADD COLUMN leadbyte_code INTEGER;
ALTER TABLE submissions ADD COLUMN leadbyte_lead_id TEXT;
ALTER TABLE submissions ADD COLUMN leadbyte_response TEXT;
ALTER TABLE submissions ADD COLUMN leadbyte_info_json TEXT;
ALTER TABLE submissions ADD COLUMN leadbyte_raw_response TEXT;
ALTER TABLE submissions ADD COLUMN leadbyte_timestamp TEXT;
ALTER TABLE submissions ADD COLUMN leadbyte_process_time REAL;
ALTER TABLE submissions ADD COLUMN upstream_http_status INTEGER;
ALTER TABLE submissions ADD COLUMN diagnostic_code TEXT;
ALTER TABLE submissions ADD COLUMN delivery_uncertain INTEGER NOT NULL DEFAULT 0;

CREATE INDEX submissions_phone ON submissions(phone1, created_at);
CREATE INDEX submissions_leadbyte_id ON submissions(leadbyte_lead_id);
CREATE INDEX submissions_delivery ON submissions(delivery_status, created_at);
CREATE INDEX submissions_code ON submissions(leadbyte_code, created_at);
CREATE UNIQUE INDEX submissions_request_id ON submissions(request_id) WHERE request_id IS NOT NULL;

CREATE TABLE leadbyte_codes (code INTEGER PRIMARY KEY, description TEXT NOT NULL);
INSERT INTO leadbyte_codes(code, description) VALUES
  (1, 'Accepted'),
  (-9, 'Campaign not active'),
  (-8, 'HLR rejection'),
  (-7, 'Supplier not authorised'),
  (-6, 'Filter rejection'),
  (-5, 'Validation error'),
  (-4, 'Campaign cap reached'),
  (-3, 'Remote system error'),
  (-2, 'Duplicate or resubmission'),
  (-19, 'Exchange is not enabled'),
  (-17, 'Number matched CTPS database'),
  (-16, 'Number matched DNCR database'),
  (-15, 'Number matched TPS database'),
  (-14, 'IP address country rejection'),
  (-13, 'Landline rejection'),
  (-12, 'Email rejection'),
  (-11, 'IP address blocked'),
  (-100, 'Internal error'),
  (-10, 'PAF rejection');

-- Reporting views deliberately exclude legacy rows without a full lead record.
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
