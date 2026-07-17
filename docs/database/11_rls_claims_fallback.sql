-- =============================================================================
-- MISMO — Make RLS work without the custom access-token hook
-- Run AFTER 04_rls_policies.sql. Safe to run multiple times (idempotent).
-- =============================================================================
--
-- The RLS helpers originally read tenant context ONLY from JWT custom claims
-- (org_id / app_user_id / user_role). Those claims are injected by a Supabase
-- "custom access token" auth hook that must be enabled in the dashboard. When
-- the hook is not enabled, a signed-in user's JWT contains only 'sub', so:
--   current_org_id()   -> null
--   is_admin_or_hr()   -> null/false
-- ...which makes every org-scoped policy reject reads AND writes. Symptom:
-- newly created records disappear on refresh because the insert was blocked.
--
-- Fix: fall back to resolving org/user/role from public.users via auth.uid().
-- These run as SECURITY DEFINER so the internal lookup bypasses RLS (prevents
-- infinite recursion when the helper is evaluated inside a users policy).
-- =============================================================================

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

-- is_admin_or_hr() already delegates to current_user_role(); redefined here only
-- to guarantee it exists with the expected role set.
CREATE OR REPLACE FUNCTION public.is_admin_or_hr()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_user_role() IN ('ADMIN', 'HR', 'SUPER_ADMIN', 'MANAGER');
$$;

GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_hr() TO authenticated;
