-- =============================================================================
-- MISMO — Split reports RLS so employees can file anonymous reports
-- Run AFTER 04_rls_policies.sql. Safe to run multiple times (idempotent).
-- =============================================================================
--
-- The original single FOR ALL policy required created_by_user_id = self for
-- non-admins, which blocked anonymous employee submissions (null creator).
-- This splits the policy per command:
--   * SELECT  — HR/admin see all; employees see only cases they filed.
--   * INSERT  — HR/admin unrestricted; employees may file their own or an
--               anonymous case (created_by_user_id must be null when anon).
--   * UPDATE  — HR/admin, or the creator of a case they filed.
--   * DELETE  — HR/admin only.
-- =============================================================================

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reports_access ON reports;
DROP POLICY IF EXISTS reports_select ON reports;
DROP POLICY IF EXISTS reports_insert ON reports;
DROP POLICY IF EXISTS reports_update ON reports;
DROP POLICY IF EXISTS reports_delete ON reports;

CREATE POLICY reports_select ON reports
  FOR SELECT TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (
      public.is_admin_or_hr()
      OR created_by_user_id = public.current_app_user_id()
    )
  );

CREATE POLICY reports_insert ON reports
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.current_org_id()
    AND (
      public.is_admin_or_hr()
      OR created_by_user_id = public.current_app_user_id()
      OR (is_anonymous = true AND created_by_user_id IS NULL)
    )
  );

CREATE POLICY reports_update ON reports
  FOR UPDATE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (
      public.is_admin_or_hr()
      OR created_by_user_id = public.current_app_user_id()
    )
  )
  WITH CHECK (
    org_id = public.current_org_id()
    AND (
      public.is_admin_or_hr()
      OR created_by_user_id = public.current_app_user_id()
    )
  );

CREATE POLICY reports_delete ON reports
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin_or_hr());
