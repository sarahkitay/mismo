-- =============================================================================
-- MISMO — Resolve app session at login (bypasses RLS chicken-and-egg)
-- Run AFTER 05_auth_bridge.sql and 07_demo_logins.sql
-- =============================================================================
--
-- Authenticated users call resolve_app_session_for_auth() after sign-in when JWT
-- custom claims are not yet present. Links auth.users to public.users by email
-- when auth_user_id is null, then returns app_user_id / org_id / user_role.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.resolve_app_session_for_auth()
RETURNS TABLE (app_user_id TEXT, org_id TEXT, user_role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auth_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  auth_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));

  IF auth_email <> '' THEN
    UPDATE public.users u
    SET auth_user_id = auth.uid(), updated_at = now()
    WHERE u.auth_user_id IS NULL
      AND lower(trim(u.email)) = auth_email;
  END IF;

  RETURN QUERY
  SELECT u.id, u.org_id, u.role::text
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_app_session_for_auth() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_app_session_for_auth() TO authenticated;
