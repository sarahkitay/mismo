#!/usr/bin/env node
/**
 * Seed demo directory (org, departments, users) via service role, then provision Auth + links.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ORG_ID = 'org-mismo-1';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD?.trim() || 'MismoDemo1!';

const DEPARTMENTS = [
  { id: 'dept-1', name: 'Engineering' },
  { id: 'dept-2', name: 'Sales' },
  { id: 'dept-3', name: 'Marketing' },
  { id: 'dept-4', name: 'HR' },
];

const DEMO_USERS = [
  { id: 'user-admin-1', role: 'HR', first_name: 'Sarah', last_name: 'Kitay', email: 'hr@mismo.com', department_id: 'dept-4' },
  { id: 'user-admin-2', role: 'ADMIN', first_name: 'Michael', last_name: 'Rodriguez', email: 'michael.rodriguez@mismo.com', department_id: 'dept-4' },
  { id: 'user-hr-sarah', role: 'HR', first_name: 'Sarah', last_name: 'Kitay', email: 'sarah.kitay@mismo.com', department_id: 'dept-4' },
  { id: 'user-manager-1', role: 'MANAGER', first_name: 'Jordan', last_name: 'Lee', email: 'jordan.lee@mismo.com', department_id: 'dept-1' },
  { id: 'user-client-1', role: 'CLIENT', first_name: 'Pat', last_name: 'Campbell', email: 'pat.campbell@clientco.com', department_id: null },
  { id: 'user-emp-sarah', role: 'EMPLOYEE', first_name: 'Sarah', last_name: 'Kitay', email: 'sarahkitay@mismo.com', department_id: 'dept-1', manager_id: 'user-manager-1' },
  { id: 'user-emp-1', role: 'EMPLOYEE', first_name: 'Alex', last_name: 'Morgan', email: 'employee@mismo.com', department_id: 'dept-1', manager_id: 'user-manager-1' },
  { id: 'user-emp-2', role: 'EMPLOYEE', first_name: 'Jordan', last_name: 'Taylor', email: 'jordan.taylor@mismo.com', department_id: 'dept-1', manager_id: 'user-manager-1' },
  { id: 'user-emp-3', role: 'EMPLOYEE', first_name: 'Casey', last_name: 'Williams', email: 'casey.williams@mismo.com', department_id: 'dept-2', manager_id: 'user-manager-1' },
  { id: 'user-emp-4', role: 'EMPLOYEE', first_name: 'Riley', last_name: 'Johnson', email: 'riley.johnson@mismo.com', department_id: 'dept-3', manager_id: 'user-manager-1' },
  { id: 'user-emp-5', role: 'EMPLOYEE', first_name: 'Morgan', last_name: 'Davis', email: 'morgan.davis@mismo.com', department_id: 'dept-ops', manager_id: 'user-manager-1' },
  { id: 'user-emp-6', role: 'EMPLOYEE', first_name: 'Quinn', last_name: 'Brown', email: 'quinn.brown@mismo.com', department_id: 'dept-1', manager_id: 'user-manager-1' },
  { id: 'user-emp-7', role: 'EMPLOYEE', first_name: 'Avery', last_name: 'Wilson', email: 'avery.wilson@mismo.com', department_id: 'dept-2', manager_id: 'user-manager-1' },
  { id: 'user-emp-8', role: 'EMPLOYEE', first_name: 'Sam', last_name: 'Garcia', email: 'sam.garcia@mismo.com', department_id: 'dept-1', manager_id: 'user-manager-1' },
];

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const root = resolve(__dirname, '..');
const merged = {
  ...loadEnvFile(resolve(root, 'services/api/.env')),
  ...loadEnvFile(resolve(root, '.env.local')),
};

const url = process.env.SUPABASE_URL || merged.SUPABASE_URL || merged.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || merged.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureOrg() {
  const { error } = await supabase.from('organizations').upsert({
    id: ORG_ID,
    name: 'Mismo',
    settings: {
      allowAnonymousReports: true,
      enableSMS: false,
      enableEmail: true,
      showRecentActivityOnDashboard: true,
      showReportsRequiringAttentionOnDashboard: true,
      thresholds: { atRiskNoResponseDays: 14, atRiskMinResponseRate: 0.7, criticalSLAHours: 24 },
    },
  });
  if (error) throw error;
}

async function ensureDepartments() {
  for (const d of DEPARTMENTS) {
    const { error } = await supabase.from('departments').upsert(
      { id: d.id, org_id: ORG_ID, name: d.name },
      { onConflict: 'id' }
    );
    if (error) console.warn(`department ${d.id}: ${error.message}`);
  }
}

async function ensureUsers() {
  const now = new Date().toISOString();
  const rows = DEMO_USERS.map((u) => ({
    id: u.id,
    org_id: ORG_ID,
    role: u.role,
    first_name: u.first_name,
    last_name: u.last_name,
    email: u.email,
    department_id: u.department_id,
    manager_id: u.manager_id ?? null,
    status: 'active',
    updated_at: now,
  }));
  const { error } = await supabase.from('users').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

async function ensureAuthUser(email) {
  const { data: listed, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) throw listErr;
  const existing = listed.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    const { error: updateErr } = await supabase.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (updateErr) throw updateErr;
    return existing.id;
  }
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (createErr) throw createErr;
  return created.user.id;
}

async function linkAppUser(appUserId, authUserId) {
  const { data, error } = await supabase
    .from('users')
    .update({ auth_user_id: authUserId, updated_at: new Date().toISOString() })
    .eq('id', appUserId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`no public.users row for ${appUserId}`);
}

async function main() {
  console.log('Seeding demo org, departments, and users…');
  await ensureOrg();
  await ensureDepartments();
  await ensureUsers();

  console.log(`Provisioning ${DEMO_USERS.length} auth users (password: ${DEMO_PASSWORD})…`);
  for (const user of DEMO_USERS) {
    const authUserId = await ensureAuthUser(user.email);
    await linkAppUser(user.id, authUserId);
    console.log(`ready     ${user.email}`);
  }

  const { count } = await supabase.from('users').select('id', { count: 'exact', head: true });
  console.log(`Done. ${count ?? 0} directory users in database.`);
  console.log('If login still fails, run docs/database/09_resolve_app_session.sql in the SQL editor once.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
