-- Preserve existing records. Email is retained locally, not added to the vendor payload.
ALTER TABLE submissions ADD COLUMN email TEXT;
