CREATE TABLE IF NOT EXISTS site_validation_failure_daily (
  day TEXT NOT NULL,
  field TEXT NOT NULL,
  reason TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, field, reason)
);
