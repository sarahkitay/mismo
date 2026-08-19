-- =============================================================================
-- Prompts: HR/admin write policies + note on per-org core prompt ids
-- Safe to run multiple times.
-- =============================================================================
--
-- Symptom fixed in app code: upserting shared id `prompt-core-incident` from a
-- second tenant failed RLS UPDATE USING (row belongs to another org).
-- App now uses org-scoped core ids and insert/update instead of blind upsert.
--
-- Also restrict INSERT/UPDATE on prompts to HR/admin (SELECT stays org-wide
-- so employees can still read active check-ins).
-- =============================================================================

DROP POLICY IF EXISTS org_isolation_insert ON prompts;
DROP POLICY IF EXISTS org_isolation_update ON prompts;
DROP POLICY IF EXISTS org_isolation_delete ON prompts;

CREATE POLICY org_isolation_insert ON prompts
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.current_org_id()
    AND (
      public.is_admin_or_hr()
      -- Employees may seed the mandatory daily incident check-in if missing.
      OR type = 'INCIDENT'
    )
  );

CREATE POLICY org_isolation_update ON prompts
  FOR UPDATE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (
      public.is_admin_or_hr()
      -- Same allowance as INSERT: employees may touch the core incident check-in.
      OR type = 'INCIDENT'
    )
  )
  WITH CHECK (
    org_id = public.current_org_id()
    AND (
      public.is_admin_or_hr()
      OR type = 'INCIDENT'
    )
  );

CREATE POLICY org_isolation_delete ON prompts
  FOR DELETE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND public.is_admin_or_hr()
  );

-- Keep SELECT as org isolation (employees need to read the active check-in).
-- enable_org_rls already created org_isolation_select; recreate if missing.
DROP POLICY IF EXISTS org_isolation_select ON prompts;
CREATE POLICY org_isolation_select ON prompts
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
