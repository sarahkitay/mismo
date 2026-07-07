-- =============================================================================
-- MISMO — Private file storage buckets
-- Run AFTER 01_full_schema.sql (Supabase Dashboard → Storage, or SQL below)
-- =============================================================================
--
-- storage_key column format: {org_id}/{entity}/{record_id}/{uuid}-{filename}
-- Example: org-mismo-1/reports/report-123/abc-paystub.pdf
--
-- FRONTEND: Never reference vendor storage URLs directly. Use signed URLs from API.
-- =============================================================================

-- Create buckets (idempotent via storage API; run in Dashboard if SQL insert fails)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'mismo-files',
    'mismo-files',
    false,
    52428800,  -- 50 MB
    ARRAY[
      'application/pdf',
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'text/plain', 'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ]::text[]
  ),
  (
    'mismo-signatures',
    'mismo-signatures',
    false,
    2097152,   -- 2 MB
    ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
  )
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Helper: extract org_id from storage path (first path segment)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.storage_org_id(object_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT split_part(object_name, '/', 1);
$$;

-- -----------------------------------------------------------------------------
-- RLS: authenticated users read/write only their org prefix
-- Requires JWT custom claim: org_id (see 05_auth_bridge.sql)
-- -----------------------------------------------------------------------------

CREATE POLICY "mismo_files_org_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id IN ('mismo-files', 'mismo-signatures')
  AND public.storage_org_id(name) = (auth.jwt() ->> 'org_id')
);

CREATE POLICY "mismo_files_org_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('mismo-files', 'mismo-signatures')
  AND public.storage_org_id(name) = (auth.jwt() ->> 'org_id')
);

CREATE POLICY "mismo_files_org_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('mismo-files', 'mismo-signatures')
  AND public.storage_org_id(name) = (auth.jwt() ->> 'org_id')
);

CREATE POLICY "mismo_files_org_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id IN ('mismo-files', 'mismo-signatures')
  AND public.storage_org_id(name) = (auth.jwt() ->> 'org_id')
);

-- Service role bypasses RLS for admin exports / migration jobs (server only).
