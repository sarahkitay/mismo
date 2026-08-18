/**
 * Scheduler-only function. Gateway JWT is intentionally off so pg_net /
 * EventBridge can invoke it. CRON_SECRET is required on every request.
 * User-facing APIs live on mismo-api with verify_jwt = true.
 */
import { corsHeaders, jsonResponse, normalizePath } from '../_shared/cors.ts';
import { runPromptReminders } from '../_shared/prompt-reminders.ts';

function normalizeCronPath(pathname: string): string {
  const prefixes = ['/functions/v1/mismo-cron', '/mismo-cron'];
  let path = pathname;
  for (const prefix of prefixes) {
    if (path.startsWith(prefix)) {
      path = path.slice(prefix.length) || '/';
      break;
    }
  }
  return path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = normalizeCronPath(url.pathname) || normalizePath(url.pathname);

  try {
    if ((path === '/cron/prompt-reminders' || path === '/' || path === '/prompt-reminders') &&
      (req.method === 'POST' || req.method === 'GET')) {
      const body =
        req.method === 'POST'
          ? ((await req.json().catch(() => ({}))) as {
              force?: boolean;
              orgId?: string;
              redirectTo?: string;
            })
          : {};
      const result = await runPromptReminders({
        authHeader: null,
        cronSecret: req.headers.get('x-cron-secret') ?? url.searchParams.get('secret'),
        force: body.force === true || url.searchParams.get('force') === '1',
        orgId: body.orgId ?? url.searchParams.get('orgId') ?? undefined,
        redirectTo: body.redirectTo ?? undefined,
      });
      return jsonResponse(200, result);
    }

    return jsonResponse(404, { error: 'Not found' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error';
    const status = message === 'AUTH_REQUIRED' || message === 'FORBIDDEN' ? 401 : 400;
    return jsonResponse(status, { error: message });
  }
});
