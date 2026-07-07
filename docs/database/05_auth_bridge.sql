-- =============================================================================
-- MISMO — Auth bridge (Supabase Auth ↔ public.users)
-- Run AFTER 01_full_schema.sql
-- =============================================================================
--
-- Links auth.users to application users and sets JWT custom claims for RLS.
-- Deploy as Supabase Database Webhook / Auth Hook / Edge Function on sign-in.
-- =============================================================================

-- Lookup app user by auth id
CREATE OR REPLACE FUNCTION public.app_user_for_auth(auth_uid UUID)
RETURNS TABLE (
  app_user_id TEXT,
  org_id TEXT,
  user_role TEXT,
  email TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.org_id, u.role::text, u.email::text
  FROM public.users u
  WHERE u.auth_user_id = auth_uid
  LIMIT 1;
$$;

-- Provision link when Supabase Auth user is created (invite / sign-up)
CREATE OR REPLACE FUNCTION public.link_auth_user_to_app_user(
  p_auth_user_id UUID,
  p_app_user_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET auth_user_id = p_auth_user_id, updated_at = now()
  WHERE id = p_app_user_id AND auth_user_id IS NULL;
END;
$$;

-- Optional: auto-create profile row on auth.users insert (if email matches)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users u
  SET auth_user_id = NEW.id, updated_at = now()
  WHERE u.email = NEW.email AND u.auth_user_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Custom access token hook (enable in Supabase Dashboard → Authentication → Hooks)
-- Returns claims merged into JWT for RLS policies in 04_rls_policies.sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims JSONB;
  auth_uid UUID;
  app_row RECORD;
BEGIN
  claims := event -> 'claims';
  auth_uid := (event ->> 'user_id')::uuid;

  SELECT * INTO app_row FROM public.app_user_for_auth(auth_uid);

  IF app_row.app_user_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{org_id}', to_jsonb(app_row.org_id));
    claims := jsonb_set(claims, '{app_user_id}', to_jsonb(app_row.app_user_id));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(app_row.user_role));
  END IF;

  RETURN jsonb_build_object('claims', claims);
END;
$$;

-- Grant execute to supabase_auth_admin (required for auth hooks)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.app_user_for_auth TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_auth_user_to_app_user TO service_role;
