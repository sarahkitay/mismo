-- Optional job title / custom role label on directory users
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title TEXT;
