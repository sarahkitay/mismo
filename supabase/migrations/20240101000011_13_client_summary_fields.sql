-- =============================================================================
-- MISMO — Extend client contacts + customer support history
-- =============================================================================

ALTER TABLE client_contacts ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT '';
ALTER TABLE client_contacts ADD COLUMN IF NOT EXISTS office_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE client_contacts ADD COLUMN IF NOT EXISTS direct_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE client_contacts ADD COLUMN IF NOT EXISTS extension TEXT NOT NULL DEFAULT '';
ALTER TABLE client_contacts ADD COLUMN IF NOT EXISTS cell_phone TEXT NOT NULL DEFAULT '';

-- Backfill office_phone from legacy phone when empty
UPDATE client_contacts
SET office_phone = phone
WHERE (office_phone IS NULL OR office_phone = '') AND phone IS NOT NULL AND phone <> '';

CREATE TABLE IF NOT EXISTS client_support_entries (
  id                  TEXT PRIMARY KEY,
  client_id           TEXT NOT NULL REFERENCES client_companies(id) ON DELETE CASCADE,
  body                TEXT NOT NULL,
  created_by_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by_name     TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_support_client ON client_support_entries(client_id, created_at DESC);

ALTER TABLE client_support_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_support_access ON client_support_entries;
CREATE POLICY client_support_access ON client_support_entries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_companies c
      WHERE c.id = client_id
        AND c.managed_by_org_id = public.current_org_id()
        AND public.is_admin_or_hr()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_companies c
      WHERE c.id = client_id
        AND c.managed_by_org_id = public.current_org_id()
        AND public.is_admin_or_hr()
    )
  );
