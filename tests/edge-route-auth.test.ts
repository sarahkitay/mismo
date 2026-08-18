import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROUTE_POLICIES } from '@/lib/authz/routes';

const apiIndex = readFileSync(resolve('supabase/functions/mismo-api/index.ts'), 'utf8');
const cronIndex = readFileSync(resolve('supabase/functions/mismo-cron/index.ts'), 'utf8');
const config = readFileSync(resolve('supabase/config.toml'), 'utf8');
const auth = readFileSync(resolve('supabase/functions/_shared/auth.ts'), 'utf8');

function handlerFor(path: string, method: string, source: string): string {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`if \\(path === '${escaped}'[^\\n]*`);
  const match = re.exec(source);
  if (!match || !match[0].includes(method)) return '';
  const start = match.index;
  const next = source.indexOf("if (path === '", start + match[0].length);
  return source.slice(start, next < 0 ? undefined : next);
}

const AUTH_MARKERS = [
  'authorizeCaller(',
  'inviteEmployee(',
  'sendOrgMessage(',
  'sendPasswordResetForEmployee(',
  'sendSelfPasswordReset(',
];

describe('Edge Function JWT configuration', () => {
  it('enables gateway JWT on mismo-api', () => {
    expect(config).toMatch(/\[functions\.mismo-api\][\s\S]*?verify_jwt = true/);
  });

  it('documents why mismo-cron has gateway JWT off', () => {
    expect(config).toMatch(/\[functions\.mismo-cron\][\s\S]*?verify_jwt = false/);
    expect(config).toMatch(/CRON_SECRET/);
    expect(cronIndex).toContain('cronSecret');
    expect(cronIndex).toContain("authHeader: null");
  });

  it('does not register user-data routes on the cron function', () => {
    expect(cronIndex).not.toContain('inviteEmployee');
    expect(cronIndex).not.toContain('/employees/');
    expect(cronIndex).not.toContain('/notifications/');
    expect(cronIndex).not.toContain('/hr/next-tasks');
  });

  it('binds JWTs to public.users inside authorizeCaller', () => {
    expect(auth).toContain('admin.auth.getUser(token)');
    expect(auth).toContain("eq('auth_user_id', authUserId)");
    expect(auth).toContain('privilegedOnly');
  });
});

describe('mismo-api route catalog vs implementation', () => {
  const apiRoutes = ROUTE_POLICIES.filter((r) => r.functionName === 'mismo-api');

  it('lists every path handler in index.ts', () => {
    const declared = [...apiIndex.matchAll(/path === '([^']+)'/g)].map((m) => m[1]);
    const catalog = apiRoutes.map((r) => r.path);
    for (const path of declared) {
      expect(catalog, `unlisted handler ${path}`).toContain(path);
    }
    for (const path of catalog) {
      expect(declared, `missing handler ${path}`).toContain(path);
    }
  });

  it('calls in-function auth on every user or privileged route', () => {
    for (const route of apiRoutes) {
      if (route.inFunction === 'none') continue;
      const block = handlerFor(route.path, route.method, apiIndex);
      expect(block.length, `${route.method} ${route.path} not found`).toBeGreaterThan(0);
      const hit = AUTH_MARKERS.some((m) => block.includes(m));
      expect(hit, `${route.method} ${route.path} must authorize the caller`).toBe(true);
      if (route.inFunction === 'privileged') {
        const privileged =
          block.includes('privilegedOnly: true') ||
          block.includes('inviteEmployee(') ||
          block.includes('sendPasswordResetForEmployee(');
        expect(privileged, `${route.path} should be privileged`).toBe(true);
      }
    }
  });

  it('does not trust client-supplied orgId on org-scoped writes', () => {
    const incident = handlerFor('/notifications/incident-yes', 'POST', apiIndex);
    const wage = handlerFor('/notifications/wage-hour-yes', 'POST', apiIndex);
    const tasks = handlerFor('/hr/next-tasks', 'GET', apiIndex);
    expect(incident).toContain('caller.orgId');
    expect(wage).toContain('caller.orgId');
    expect(tasks).toContain('caller.orgId');
    expect(tasks).not.toContain("url.searchParams.get('orgId')");
  });
});
