-- =============================================================================
-- MISMO — Production bootstrap (no sample users or demo data)
-- Run AFTER 01_full_schema.sql, 04_rls_policies.sql, and 05_auth_bridge.sql
-- =============================================================================
--
-- Creates a single empty organization. HR users are provisioned via:
--   1. Insert a row in public.users (see example below)
--   2. Create matching user in Supabase Auth (Dashboard or Admin API)
--   3. Link auth_user_id (automatic via handle_new_auth_user when emails match)
--
-- Set VITE_ORG_ID in the frontend to match organizations.id.
-- =============================================================================

INSERT INTO organizations (id, name, settings)
VALUES (
  'org-mismo-1',
  'Organization',
  '{
    "allowAnonymousReports": true,
    "enableSMS": false,
    "enableEmail": true,
    "showRecentActivityOnDashboard": true,
    "showReportsRequiringAttentionOnDashboard": true,
    "thresholds": {
      "atRiskNoResponseDays": 14,
      "atRiskMinResponseRate": 0.7,
      "criticalSLAHours": 24
    }
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  settings = EXCLUDED.settings,
  updated_at = now();

-- Example: provision first HR admin (replace values before running)
-- 1) Create Auth user in Supabase Dashboard with the same email
-- 2) Uncomment and run:
--
-- INSERT INTO users (
--   id, org_id, role, first_name, last_name, email, status
-- ) VALUES (
--   'user-hr-1',
--   'org-mismo-1',
--   'HR',
--   'HR',
--   'Admin',
--   'hr@yourcompany.com',
--   'active'
-- )
-- ON CONFLICT (org_id, email) DO NOTHING;
--
-- After sign-in, auth_user_id is linked automatically when emails match.
