/**
 * Edge Function route catalog.
 * Tests assert every path in supabase/functions/mismo-api/index.ts is listed here,
 * and that mutating user routes call authorizeCaller in-process.
 *
 * Gateway JWT (verify_jwt = true on mismo-api) is the first gate.
 * In-function checks bind the JWT to an org-scoped public.users row and RBAC.
 */

export type InFunctionAuth = 'none' | 'user' | 'privileged' | 'cron-secret';

export type RoutePolicy = {
  method: 'GET' | 'POST';
  path: string;
  functionName: 'mismo-api' | 'mismo-cron';
  /** Supabase gateway JWT verification for this function. */
  gatewayJwt: boolean;
  inFunction: InFunctionAuth;
  notes: string;
};

export const ROUTE_POLICIES: RoutePolicy[] = [
  {
    method: 'GET',
    path: '/health',
    functionName: 'mismo-api',
    gatewayJwt: true,
    inFunction: 'none',
    notes: 'Liveness only. Anon JWT is enough at the gateway; no org data is returned.',
  },
  {
    method: 'POST',
    path: '/employees/invite',
    functionName: 'mismo-api',
    gatewayJwt: true,
    inFunction: 'privileged',
    notes: 'HR/Admin invite. Org is taken from the caller profile, not the request body.',
  },
  {
    method: 'POST',
    path: '/employees/password-reset',
    functionName: 'mismo-api',
    gatewayJwt: true,
    inFunction: 'user',
    notes: 'Self-reset for any signed-in user; HR reset for another employee is privileged inside the handler.',
  },
  {
    method: 'POST',
    path: '/notifications/send',
    functionName: 'mismo-api',
    gatewayJwt: true,
    inFunction: 'user',
    notes: 'Recipient must belong to the caller org.',
  },
  {
    method: 'POST',
    path: '/notifications/incident-yes',
    functionName: 'mismo-api',
    gatewayJwt: true,
    inFunction: 'user',
    notes: 'Caller org replaces any client-supplied orgId.',
  },
  {
    method: 'POST',
    path: '/notifications/wage-hour-yes',
    functionName: 'mismo-api',
    gatewayJwt: true,
    inFunction: 'user',
    notes: 'Caller org replaces any client-supplied orgId.',
  },
  {
    method: 'POST',
    path: '/cron/prompt-reminders',
    functionName: 'mismo-api',
    gatewayJwt: true,
    inFunction: 'privileged',
    notes: 'HR-triggered reminder from a signed-in session.',
  },
  {
    method: 'POST',
    path: '/cron/prompt-reminders',
    functionName: 'mismo-cron',
    gatewayJwt: false,
    inFunction: 'cron-secret',
    notes: 'Scheduler entry. Gateway JWT is off so pg_net/EventBridge can call it; CRON_SECRET is required.',
  },
  {
    method: 'POST',
    path: '/ai/outreach/coach',
    functionName: 'mismo-api',
    gatewayJwt: true,
    inFunction: 'privileged',
    notes: 'HR drafting aid. orgId comes from the caller.',
  },
  {
    method: 'POST',
    path: '/ai/help/ask',
    functionName: 'mismo-api',
    gatewayJwt: true,
    inFunction: 'user',
    notes: 'In-app help. Role is taken from the caller profile.',
  },
  {
    method: 'GET',
    path: '/hr-laws',
    functionName: 'mismo-api',
    gatewayJwt: true,
    inFunction: 'none',
    notes: 'Platform-wide published law corpus (RLS allows authenticated SELECT).',
  },
  {
    method: 'GET',
    path: '/hr-laws/updates',
    functionName: 'mismo-api',
    gatewayJwt: true,
    inFunction: 'privileged',
    notes: 'Org watchlist; orgId from caller.',
  },
  {
    method: 'POST',
    path: '/hr-laws/sync',
    functionName: 'mismo-api',
    gatewayJwt: true,
    inFunction: 'privileged',
    notes: 'Writes the shared corpus; HR/Admin only.',
  },
  {
    method: 'GET',
    path: '/hr/next-tasks',
    functionName: 'mismo-api',
    gatewayJwt: true,
    inFunction: 'privileged',
    notes: 'Queue for the caller org only — query orgId is ignored.',
  },
];
