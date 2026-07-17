-- =============================================================================
-- MISMO — Row Level Security (multi-tenant org isolation)
-- Run AFTER 01_full_schema.sql and 05_auth_bridge.sql
-- =============================================================================
--
-- JWT custom claims (set on login via Edge Function or auth hook):
--   org_id       TEXT  — tenant id (organizations.id)
--   app_user_id  TEXT  — public.users.id
--   user_role    TEXT  — EMPLOYEE | HR | ADMIN | ...
--
-- FRONTEND must use authenticated role + RLS, OR call Mismo API with service role.
-- Never ship service_role key to the browser.
-- =============================================================================

-- Helper functions
-- These resolve tenant context from JWT custom claims when present (set by the
-- optional access-token hook), and otherwise fall back to looking up the signed
-- in user in public.users via auth.uid(). SECURITY DEFINER lets the fallback
-- lookup bypass RLS so the app works whether or not the hook is enabled and
-- avoids recursion when evaluated inside a users policy. See 11_rls_claims_fallback.sql.
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'org_id', ''),
    (SELECT u.org_id FROM public.users u WHERE u.auth_user_id = auth.uid() LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'app_user_id', ''),
    (SELECT u.id FROM public.users u WHERE u.auth_user_id = auth.uid() LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'user_role', ''),
    (SELECT u.role::text FROM public.users u WHERE u.auth_user_id = auth.uid() LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_hr()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_user_role() IN ('ADMIN', 'HR', 'SUPER_ADMIN', 'MANAGER');
$$;

-- Macro-style: enable org isolation on a table
CREATE OR REPLACE FUNCTION public.enable_org_rls(table_name TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', table_name);
  EXECUTE format('DROP POLICY IF EXISTS org_isolation_select ON %I;', table_name);
  EXECUTE format('DROP POLICY IF EXISTS org_isolation_insert ON %I;', table_name);
  EXECUTE format('DROP POLICY IF EXISTS org_isolation_update ON %I;', table_name);
  EXECUTE format('DROP POLICY IF EXISTS org_isolation_delete ON %I;', table_name);

  EXECUTE format(
    'CREATE POLICY org_isolation_select ON %I FOR SELECT TO authenticated
     USING (org_id = public.current_org_id());',
    table_name
  );
  EXECUTE format(
    'CREATE POLICY org_isolation_insert ON %I FOR INSERT TO authenticated
     WITH CHECK (org_id = public.current_org_id());',
    table_name
  );
  EXECUTE format(
    'CREATE POLICY org_isolation_update ON %I FOR UPDATE TO authenticated
     USING (org_id = public.current_org_id())
     WITH CHECK (org_id = public.current_org_id());',
    table_name
  );
  EXECUTE format(
    'CREATE POLICY org_isolation_delete ON %I FOR DELETE TO authenticated
     USING (org_id = public.current_org_id() AND public.is_admin_or_hr());',
    table_name
  );
END;
$$;

-- Apply to org-scoped business tables (users + reports have custom policies below)
SELECT public.enable_org_rls('departments');
SELECT public.enable_org_rls('prompts');
SELECT public.enable_org_rls('prompt_deliveries');
SELECT public.enable_org_rls('prompt_responses');
-- reports: custom policy below (employees see own cases only)
SELECT public.enable_org_rls('investigations');
SELECT public.enable_org_rls('policies');
SELECT public.enable_org_rls('company_resources');
SELECT public.enable_org_rls('emergency_hotlines');
SELECT public.enable_org_rls('announcements');
SELECT public.enable_org_rls('nudges');
SELECT public.enable_org_rls('activity_events');
SELECT public.enable_org_rls('audit_logs');
SELECT public.enable_org_rls('metrics_snapshots');
SELECT public.enable_org_rls('check_in_deferrals');
SELECT public.enable_org_rls('wage_hour_screening_acknowledgements');
SELECT public.enable_org_rls('org_hr_law_watchlists');
SELECT public.enable_org_rls('outreach_coach_sessions');
SELECT public.enable_org_rls('hr_law_notifications');
SELECT public.enable_org_rls('ai_job_runs');

-- Users: self profile or HR/admin directory within org
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_org_member ON users;
CREATE POLICY users_org_member ON users
  FOR ALL TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (
      id = public.current_app_user_id()
      OR public.is_admin_or_hr()
    )
  )
  WITH CHECK (
    org_id = public.current_org_id()
    AND public.is_admin_or_hr()
  );

-- Reports: employees see own; HR/admin see org register.
-- Split by command so employees can file anonymous reports (null creator)
-- without being able to read the org-wide register.
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reports_access ON reports;
DROP POLICY IF EXISTS reports_select ON reports;
DROP POLICY IF EXISTS reports_insert ON reports;
DROP POLICY IF EXISTS reports_update ON reports;
DROP POLICY IF EXISTS reports_delete ON reports;

-- Read: HR/admin see the whole org; employees see only cases they filed.
CREATE POLICY reports_select ON reports
  FOR SELECT TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (
      public.is_admin_or_hr()
      OR created_by_user_id = public.current_app_user_id()
    )
  );

-- Insert: HR/admin unrestricted; any org member may file their own case or an
-- anonymous case (created_by_user_id must be null when anonymous).
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

-- Update: HR/admin, or the creator of a non-anonymous case they filed.
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

-- Delete: HR/admin only.
CREATE POLICY reports_delete ON reports
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin_or_hr());

-- HR law corpus is platform-wide read; writes service-role only
ALTER TABLE hr_law_jurisdictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_law_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_law_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY hr_laws_read ON hr_law_jurisdictions FOR SELECT TO authenticated USING (true);
CREATE POLICY hr_law_records_read ON hr_law_records FOR SELECT TO authenticated USING (true);
CREATE POLICY hr_law_updates_read ON hr_law_updates FOR SELECT TO authenticated USING (true);

-- Organizations: users read own org only
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_read_own ON organizations
  FOR SELECT TO authenticated
  USING (id = public.current_org_id());
