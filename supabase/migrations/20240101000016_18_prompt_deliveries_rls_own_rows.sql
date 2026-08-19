-- =============================================================================
-- prompt_deliveries RLS: own row or HR within the caller's org only
-- Safe to run multiple times.
-- =============================================================================
-- Always require org_id = current_org_id() so user_id alone cannot write into
-- another tenant. Employees may insert/update their own deliveries; HR/admin
-- may manage all deliveries in the org.
-- =============================================================================

DROP POLICY IF EXISTS org_isolation_insert ON prompt_deliveries;
DROP POLICY IF EXISTS org_isolation_update ON prompt_deliveries;
DROP POLICY IF EXISTS org_isolation_select ON prompt_deliveries;
DROP POLICY IF EXISTS org_isolation_delete ON prompt_deliveries;

CREATE POLICY org_isolation_select ON prompt_deliveries
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

CREATE POLICY org_isolation_insert ON prompt_deliveries
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.current_org_id()
    AND (
      user_id = public.current_app_user_id()
      OR public.is_admin_or_hr()
    )
  );

CREATE POLICY org_isolation_update ON prompt_deliveries
  FOR UPDATE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (
      user_id = public.current_app_user_id()
      OR public.is_admin_or_hr()
    )
  )
  WITH CHECK (
    org_id = public.current_org_id()
    AND (
      user_id = public.current_app_user_id()
      OR public.is_admin_or_hr()
    )
  );

CREATE POLICY org_isolation_delete ON prompt_deliveries
  FOR DELETE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND public.is_admin_or_hr()
  );
