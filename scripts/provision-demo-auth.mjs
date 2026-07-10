#!/usr/bin/env node
/**
 * Demo bootstrap: Auth users + link public.users.auth_user_id by email.
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from services/api/.env or .env.local
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_PASSWORD = process.env.DEMO_PASSWORD?.trim() || 'MismoDemo1!';

const DEMO_USERS = [
  { id: 'user-admin-1', email: 'hr@mismo.com', role: 'HR' },
  { id: 'user-admin-2', email: 'michael.rodriguez@mismo.com', role: 'ADMIN' },
  { id: 'user-hr-sarah', email: 'sarah.kitay@mismo.com', role: 'HR' },
  { id: 'user-manager-1', email: 'jordan.lee@mismo.com', role: 'MANAGER' },
  { id: 'user-client-1', email: 'pat.campbell@clientco.com', role: 'CLIENT' },
  { id: 'user-emp-sarah', email: 'sarahkitay@mismo.com', role: 'EMPLOYEE' },
  { id: 'user-emp-1', email: 'employee@mismo.com', role: 'EMPLOYEE' },
  { id: 'user-emp-2', email: 'jordan.taylor@mismo.com', role: 'EMPLOYEE' },
  { id: 'user-emp-3', email: 'casey.williams@mismo.com', role: 'EMPLOYEE' },
  { id: 'user-emp-4', email: 'riley.johnson@mismo.com', role: 'EMPLOYEE' },
  { id: 'user-emp-5', email: 'morgan.davis@mismo.com', role: 'EMPLOYEE' },
  { id: 'user-emp-6', email: 'quinn.brown@mismo.com', role: 'EMPLOYEE' },
  { id: 'user-emp-7', email: 'avery.wilson@mismo.com', role: 'EMPLOYEE' },
  { id: 'user-emp-8', email: 'sam.garcia@mismo.com', role: 'EMPLOYEE' },
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
const apiEnv = loadEnvFile(resolve(root, 'services/api/.env'));
const localEnv = loadEnvFile(resolve(root, '.env.local'));
const merged = { ...apiEnv, ...localEnv };

const url =
  process.env.SUPABASE_URL ||
  merged.SUPABASE_URL ||
  merged.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || merged.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local or services/api/.env).');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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
  const { error } = await supabase
    .from('users')
    .update({ auth_user_id: authUserId, updated_at: new Date().toISOString() })
    .eq('id', appUserId);
  if (error) throw error;
}

async function main() {
  console.log(`Provisioning ${DEMO_USERS.length} demo auth users (password: ${DEMO_PASSWORD})…`);
  for (const user of DEMO_USERS) {
    const authUserId = await ensureAuthUser(user.email);
    try {
      await linkAppUser(user.id, authUserId);
      console.log(`linked    ${user.email} → ${user.id}`);
    } catch (err) {
      console.warn(`skip link ${user.email}: ${err instanceof Error ? err.message : err}`);
      console.warn('  Run docs/database/07_demo_logins.sql if public.users rows are missing.');
    }
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
