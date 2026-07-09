#!/usr/bin/env node
/**
 * Create Supabase Auth users for demo directory emails (password: MismoDemo1!).
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from services/api/.env
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_PASSWORD = process.env.DEMO_PASSWORD?.trim() || 'MismoDemo1!';

const DEMO_EMAILS = [
  'hr@mismo.com',
  'michael.rodriguez@mismo.com',
  'sarah.kitay@mismo.com',
  'jordan.lee@mismo.com',
  'pat.campbell@clientco.com',
  'sarahkitay@mismo.com',
  'employee@mismo.com',
  'jordan.taylor@mismo.com',
  'casey.williams@mismo.com',
  'riley.johnson@mismo.com',
  'morgan.davis@mismo.com',
  'quinn.brown@mismo.com',
  'avery.wilson@mismo.com',
  'sam.garcia@mismo.com',
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

const apiEnv = loadEnvFile(resolve(__dirname, '../services/api/.env'));
const url = process.env.SUPABASE_URL || apiEnv.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || apiEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (services/api/.env).');
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
    console.log(`updated  ${email}`);
    return;
  }
  const { error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (createErr) throw createErr;
  console.log(`created  ${email}`);
}

async function main() {
  console.log(`Provisioning ${DEMO_EMAILS.length} demo auth users (password: ${DEMO_PASSWORD})…`);
  for (const email of DEMO_EMAILS) {
    await ensureAuthUser(email);
  }
  console.log('Done. Run 07_demo_logins.sql if public.users rows are missing.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
