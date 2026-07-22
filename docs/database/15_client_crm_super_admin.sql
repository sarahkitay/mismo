-- =============================================================================
-- MISMO — Restrict client CRM to SUPER_ADMIN (Mismo Internal) only
-- Safe to run multiple times (idempotent).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() = 'SUPER_ADMIN';
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

DROP POLICY IF EXISTS client_companies_access ON client_companies;
CREATE POLICY client_companies_access ON client_companies
  FOR ALL
  USING (managed_by_org_id = public.current_org_id() AND public.is_super_admin())
  WITH CHECK (managed_by_org_id = public.current_org_id() AND public.is_super_admin());

DROP POLICY IF EXISTS client_contacts_access ON client_contacts;
CREATE POLICY client_contacts_access ON client_contacts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM client_companies c
      WHERE c.id = client_id
        AND c.managed_by_org_id = public.current_org_id()
        AND public.is_super_admin()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_companies c
      WHERE c.id = client_id
        AND c.managed_by_org_id = public.current_org_id()
        AND public.is_super_admin()
    )
  );

DROP POLICY IF EXISTS client_documents_access ON client_documents;
CREATE POLICY client_documents_access ON client_documents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM client_companies c
      WHERE c.id = client_id
        AND c.managed_by_org_id = public.current_org_id()
        AND public.is_super_admin()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_companies c
      WHERE c.id = client_id
        AND c.managed_by_org_id = public.current_org_id()
        AND public.is_super_admin()
    )
  );

DROP POLICY IF EXISTS client_notes_access ON client_notes;
CREATE POLICY client_notes_access ON client_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM client_companies c
      WHERE c.id = client_id
        AND c.managed_by_org_id = public.current_org_id()
        AND public.is_super_admin()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_companies c
      WHERE c.id = client_id
        AND c.managed_by_org_id = public.current_org_id()
        AND public.is_super_admin()
    )
  );

DROP POLICY IF EXISTS client_payments_access ON client_payments;
CREATE POLICY client_payments_access ON client_payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM client_companies c
      WHERE c.id = client_id
        AND c.managed_by_org_id = public.current_org_id()
        AND public.is_super_admin()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_companies c
      WHERE c.id = client_id
        AND c.managed_by_org_id = public.current_org_id()
        AND public.is_super_admin()
    )
  );

DROP POLICY IF EXISTS client_support_access ON client_support_entries;
DROP POLICY IF EXISTS client_support_entries_access ON client_support_entries;
CREATE POLICY client_support_access ON client_support_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM client_companies c
      WHERE c.id = client_id
        AND c.managed_by_org_id = public.current_org_id()
        AND public.is_super_admin()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM client_companies c
      WHERE c.id = client_id
        AND c.managed_by_org_id = public.current_org_id()
        AND public.is_super_admin()
    )
  );
