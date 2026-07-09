-- =============================================================================
-- MISMO — Demo login directory (users + departments only, NO business data)
-- Run AFTER 06_production_bootstrap.sql
--
-- Creates the employee directory used for demos. Does NOT insert reports,
-- prompts, investigations, memos, or other sample workflow data.
--
-- Then run: npm run demo:provision-auth
-- (creates matching Supabase Auth users with password MismoDemo1!)
-- =============================================================================

UPDATE organizations SET name = 'Mismo', updated_at = now() WHERE id = 'org-mismo-1';

INSERT INTO departments (id, org_id, name) VALUES
  ('dept-1', 'org-mismo-1', 'Engineering'),
  ('dept-2', 'org-mismo-1', 'Sales'),
  ('dept-3', 'org-mismo-1', 'Marketing'),
  ('dept-4', 'org-mismo-1', 'HR'),
  ('dept-5', 'org-mismo-1', 'Operations')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, org_id, role, first_name, last_name, email, phone, employee_id, location, department_id, manager_id, hired_date, state, status) VALUES
  ('user-admin-1', 'org-mismo-1', 'HR', 'Sarah', 'Kitay', 'hr@mismo.com', NULL, NULL, NULL, 'dept-4', NULL, NULL, NULL, 'active'),
  ('user-admin-2', 'org-mismo-1', 'ADMIN', 'Michael', 'Rodriguez', 'michael.rodriguez@mismo.com', NULL, NULL, NULL, 'dept-4', NULL, NULL, NULL, 'active'),
  ('user-hr-sarah', 'org-mismo-1', 'HR', 'Sarah', 'Kitay', 'sarah.kitay@mismo.com', '+1-555-0120', NULL, NULL, 'dept-4', NULL, NULL, NULL, 'active'),
  ('user-manager-1', 'org-mismo-1', 'MANAGER', 'Jordan', 'Lee', 'jordan.lee@mismo.com', '+1-555-0120', NULL, NULL, 'dept-1', NULL, NULL, NULL, 'active'),
  ('user-client-1', 'org-mismo-1', 'CLIENT', 'Pat', 'Campbell', 'pat.campbell@clientco.com', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'active'),
  ('user-emp-sarah', 'org-mismo-1', 'EMPLOYEE', 'Sarah', 'Kitay', 'sarahkitay@mismo.com', '+1-555-0100', 'EMP-1001', 'San Francisco HQ', 'dept-1', 'user-manager-1', '2023-06-15', 'CA', 'active'),
  ('user-emp-1', 'org-mismo-1', 'EMPLOYEE', 'Alex', 'Morgan', 'employee@mismo.com', '+1-555-0101', 'EMP-1002', 'New York, Floor 12', 'dept-1', 'user-manager-1', '2022-03-01', 'NY', 'active'),
  ('user-emp-2', 'org-mismo-1', 'EMPLOYEE', 'Jordan', 'Taylor', 'jordan.taylor@mismo.com', '+1-555-0102', NULL, NULL, 'dept-1', 'user-manager-1', '2023-01-10', 'TX', 'active'),
  ('user-emp-3', 'org-mismo-1', 'EMPLOYEE', 'Casey', 'Williams', 'casey.williams@mismo.com', NULL, NULL, NULL, 'dept-2', 'user-manager-1', NULL, NULL, 'active'),
  ('user-emp-4', 'org-mismo-1', 'EMPLOYEE', 'Riley', 'Johnson', 'riley.johnson@mismo.com', NULL, NULL, NULL, 'dept-3', 'user-manager-1', NULL, NULL, 'active'),
  ('user-emp-5', 'org-mismo-1', 'EMPLOYEE', 'Morgan', 'Davis', 'morgan.davis@mismo.com', NULL, NULL, NULL, 'dept-5', 'user-manager-1', NULL, NULL, 'active'),
  ('user-emp-6', 'org-mismo-1', 'EMPLOYEE', 'Quinn', 'Brown', 'quinn.brown@mismo.com', NULL, NULL, NULL, 'dept-1', 'user-manager-1', NULL, NULL, 'active'),
  ('user-emp-7', 'org-mismo-1', 'EMPLOYEE', 'Avery', 'Wilson', 'avery.wilson@mismo.com', NULL, NULL, NULL, 'dept-2', 'user-manager-1', NULL, NULL, 'active'),
  ('user-emp-8', 'org-mismo-1', 'EMPLOYEE', 'Sam', 'Garcia', 'sam.garcia@mismo.com', NULL, NULL, NULL, 'dept-1', 'user-manager-1', NULL, NULL, 'active')
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  department_id = EXCLUDED.department_id,
  manager_id = EXCLUDED.manager_id,
  updated_at = now();
