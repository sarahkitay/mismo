-- =============================================================================
-- Prompts UPDATE: allow INCIDENT seed path (employees), not only HR
-- Safe to run multiple times. Run if 16 was already applied with HR-only UPDATE.
-- =============================================================================

DROP POLICY IF EXISTS org_isolation_update ON prompts;

CREATE POLICY org_isolation_update ON prompts
  FOR UPDATE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (
      public.is_admin_or_hr()
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
