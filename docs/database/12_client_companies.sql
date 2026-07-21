-- =============================================================================
-- MISMO — Client company CRM (platform back-office)
-- Safe to run multiple times (idempotent).
-- =============================================================================

CREATE TABLE IF NOT EXISTS client_companies (
  id                      TEXT PRIMARY KEY,
  managed_by_org_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  linked_org_id           TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  company_name            TEXT NOT NULL,
  address1                TEXT NOT NULL DEFAULT '',
  address2                TEXT NOT NULL DEFAULT '',
  city                    TEXT NOT NULL DEFAULT '',
  state                   TEXT NOT NULL DEFAULT '',
  zip                     TEXT NOT NULL DEFAULT '',
  country                 TEXT NOT NULL DEFAULT 'USA',
  telephone               TEXT NOT NULL DEFAULT '',
  fax                     TEXT NOT NULL DEFAULT '',
  toll_free               TEXT NOT NULL DEFAULT '',
  website                 TEXT NOT NULL DEFAULT '',
  employee_count          INT,
  office_count            INT,
  jestar_account_rep      TEXT NOT NULL DEFAULT '',
  signup_date             DATE,
  active_date             DATE,
  initial_setup_amount    NUMERIC(12, 2),
  initial_setup_paid_date DATE,
  monthly_support_fee     NUMERIC(12, 2),
  monthly_employee_rate   NUMERIC(12, 2),
  billing_increment       TEXT NOT NULL DEFAULT '',
  payment_mode            TEXT NOT NULL DEFAULT '',
  client_login_email      TEXT,
  client_login_password   TEXT,
  inactive_date           DATE,
  inactive_reason         TEXT NOT NULL DEFAULT '',
  status                  TEXT NOT NULL DEFAULT 'active',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_companies_managed ON client_companies(managed_by_org_id);
CREATE INDEX IF NOT EXISTS idx_client_companies_name ON client_companies(company_name);

CREATE TABLE IF NOT EXISTS client_contacts (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL REFERENCES client_companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT '',
  title           TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',
  is_primary      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_contacts_client ON client_contacts(client_id);

CREATE TABLE IF NOT EXISTS client_documents (
  id                  TEXT PRIMARY KEY,
  client_id           TEXT NOT NULL REFERENCES client_companies(id) ON DELETE CASCADE,
  title               TEXT NOT NULL DEFAULT '',
  file_name           TEXT NOT NULL DEFAULT '',
  notes               TEXT NOT NULL DEFAULT '',
  uploaded_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_documents_client ON client_documents(client_id);

CREATE TABLE IF NOT EXISTS client_notes (
  id                  TEXT PRIMARY KEY,
  client_id           TEXT NOT NULL REFERENCES client_companies(id) ON DELETE CASCADE,
  body                TEXT NOT NULL,
  created_by_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by_name     TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_notes_client ON client_notes(client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS client_payments (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL REFERENCES client_companies(id) ON DELETE CASCADE,
  amount          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  method          TEXT NOT NULL DEFAULT '',
  reference       TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_payments_client ON client_payments(client_id, paid_at DESC);

-- RLS: manage within the ops org that owns the client record
ALTER TABLE client_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_companies_access ON client_companies;
CREATE POLICY client_companies_access ON client_companies
  FOR ALL TO authenticated
  USING (managed_by_org_id = public.current_org_id() AND public.is_admin_or_hr())
  WITH CHECK (managed_by_org_id = public.current_org_id() AND public.is_admin_or_hr());

DROP POLICY IF EXISTS client_contacts_access ON client_contacts;
CREATE POLICY client_contacts_access ON client_contacts
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

DROP POLICY IF EXISTS client_documents_access ON client_documents;
CREATE POLICY client_documents_access ON client_documents
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

DROP POLICY IF EXISTS client_notes_access ON client_notes;
CREATE POLICY client_notes_access ON client_notes
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

DROP POLICY IF EXISTS client_payments_access ON client_payments;
CREATE POLICY client_payments_access ON client_payments
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
