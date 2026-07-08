import { corsHeaders, jsonResponse, normalizePath } from '../_shared/cors.ts';
import { isSupabaseConfigured } from '../_shared/supabase.ts';
import { isOpenAiConfigured } from '../_shared/openai.ts';
import { computeHrNextTasks } from '../_shared/hr-next-tasks.ts';
import { listHrLawUpdates, listHrLawsForState, syncStateLawsPlaceholder } from '../_shared/hr-laws.ts';
import { runOutreachCoach } from '../_shared/outreach-coach.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = normalizePath(url.pathname);

  try {
    if (path === '/health' && req.method === 'GET') {
      return jsonResponse(200, {
        ok: true,
        service: 'mismo-api',
        runtime: 'supabase-edge',
        database: isSupabaseConfigured(),
        openai: isOpenAiConfigured(),
      });
    }

    if (path === '/ai/outreach/coach' && req.method === 'POST') {
      const body = (await req.json()) as Parameters<typeof runOutreachCoach>[0];
      const result = await runOutreachCoach(body);
      return jsonResponse(200, result);
    }

    if (path === '/hr-laws' && req.method === 'GET') {
      const state = url.searchParams.get('state') ?? 'CA';
      const topic = url.searchParams.get('topic') ?? undefined;
      const laws = await listHrLawsForState(state, topic);
      return jsonResponse(200, { laws });
    }

    if (path === '/hr-laws/updates' && req.method === 'GET') {
      const orgId = url.searchParams.get('orgId') ?? undefined;
      const updates = await listHrLawUpdates(orgId);
      return jsonResponse(200, { updates });
    }

    if (path === '/hr-laws/sync' && req.method === 'POST') {
      const body = (await req.json()) as { stateCode: string; stateName?: string; orgId?: string };
      const code = body.stateCode?.toUpperCase();
      if (!code) throw new Error('stateCode is required');
      const result = await syncStateLawsPlaceholder(code, body.stateName ?? code);
      return jsonResponse(200, result);
    }

    if (path === '/hr/next-tasks' && req.method === 'GET') {
      const orgId = url.searchParams.get('orgId') ?? 'org-mismo-1';
      const snapshot = {
        payrollExpedited: Number(url.searchParams.get('payrollExpedited') ?? 0) || undefined,
        needsInfo: Number(url.searchParams.get('needsInfo') ?? 0) || undefined,
        wageHour: Number(url.searchParams.get('wageHour') ?? 0) || undefined,
        yesReview: Number(url.searchParams.get('yesReview') ?? 0) || undefined,
        unassigned: Number(url.searchParams.get('unassigned') ?? 0) || undefined,
        lawUpdates: Number(url.searchParams.get('lawUpdates') ?? 0) || undefined,
        atRiskEmployees: Number(url.searchParams.get('atRiskEmployees') ?? 0) || undefined,
        unansweredPrompts: Number(url.searchParams.get('unansweredPrompts') ?? 0) || undefined,
        openInvestigations: Number(url.searchParams.get('openInvestigations') ?? 0) || undefined,
      };
      const hasSnapshot = Object.values(snapshot).some((v) => v !== undefined && v > 0);
      const result = await computeHrNextTasks(orgId, hasSnapshot ? snapshot : undefined);
      return jsonResponse(200, result);
    }

    return jsonResponse(404, { error: 'Not found' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error';
    const status = message.includes('OPENAI') || message.includes('quota') ? 503 : 400;
    return jsonResponse(status, { error: message });
  }
});
