-- In-app notifications for dashboard (email events also create rows here).
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS app_notifications (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL DEFAULT '',
  action_page     TEXT,
  action_params   JSONB NOT NULL DEFAULT '{}'::jsonb,
  related_email   TEXT,
  email_status    TEXT,
  actor_user_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_user_created
  ON app_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_notifications_org_unread
  ON app_notifications (org_id, user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_notifications_select ON app_notifications;
DROP POLICY IF EXISTS app_notifications_update ON app_notifications;
DROP POLICY IF EXISTS app_notifications_insert ON app_notifications;
DROP POLICY IF EXISTS app_notifications_delete ON app_notifications;

CREATE POLICY app_notifications_select ON app_notifications
  FOR SELECT TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (
      user_id = public.current_app_user_id()
      OR public.is_admin_or_hr()
    )
  );

CREATE POLICY app_notifications_update ON app_notifications
  FOR UPDATE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND user_id = public.current_app_user_id()
  )
  WITH CHECK (
    org_id = public.current_org_id()
    AND user_id = public.current_app_user_id()
  );

-- Inserts are performed by Edge Functions with service role; authenticated
-- clients may insert for self (e.g. local demo) when org matches.
CREATE POLICY app_notifications_insert ON app_notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.current_org_id()
    AND (
      user_id = public.current_app_user_id()
      OR public.is_admin_or_hr()
    )
  );

CREATE POLICY app_notifications_delete ON app_notifications
  FOR DELETE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (
      user_id = public.current_app_user_id()
      OR public.is_admin_or_hr()
    )
  );
