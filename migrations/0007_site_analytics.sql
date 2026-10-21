-- Aggregate event counts only: no cookies, visitor identifiers or contact data.
CREATE TABLE site_event_daily (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event)
);
