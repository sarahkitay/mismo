import { corsHeaders, jsonResponse, normalizePath } from '../_shared/cors.ts';
import { isSupabaseConfigured } from '../_shared/supabase.ts';
import { isOpenAiConfigured } from '../_shared/openai.ts';
import { computeHrNextTasks } from '../_shared/hr-next-tasks.ts';
import { listHrLawUpdates, listHrLawsForState, syncStateLawsToDb } from '../_shared/hr-laws.ts';
import { runOutreachCoach } from '../_shared/outreach-coach.ts';
import { inviteEmployee } from '../_shared/employees.ts';
import {
  sendIncidentYesNotices,
  sendWageHourYesNotices,
  isResendConfigured,
} from '../_shared/resend.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';

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

    if (path === '/employees/invite' && req.method === 'POST') {
      const body = (await req.json()) as { email: string; redirectTo?: string };
      const result = await inviteEmployee({
        email: body.email,
        redirectTo: body.redirectTo,
        authHeader: req.headers.get('Authorization'),
      });
      return jsonResponse(200, result);
    }

    if (path === '/notifications/incident-yes' && req.method === 'POST') {
      const body = (await req.json()) as {
        employeeEmail: string;
        orgId: string;
        caseUrl?: string;
        dashboardUrl?: string;
      };
      if (!body.employeeEmail || !body.orgId) {
        return jsonResponse(400, { error: 'employeeEmail and orgId are required' });
      }
      const admin = getSupabaseAdmin();
      const { data: admins } = await admin
        .from('users')
        .select('email')
        .eq('org_id', body.orgId)
        .in('role', ['HR', 'ADMIN', 'SUPER_ADMIN', 'MANAGER'])
        .eq('status', 'active');
      const adminEmails = (admins ?? [])
        .map((u) => String(u.email))
        .filter((e) => e && e.toLowerCase() !== body.employeeEmail.toLowerCase());
      const result = await sendIncidentYesNotices({
        employeeEmail: body.employeeEmail,
        adminEmails,
        dashboardUrl: body.dashboardUrl ?? '',
        caseUrl: body.caseUrl ?? '',
      });
      return jsonResponse(200, { ok: true, resendConfigured: isResendConfigured(), ...result });
    }

    if (path === '/notifications/wage-hour-yes' && req.method === 'POST') {
      const body = (await req.json()) as {
        employeeEmail: string;
        orgId: string;
        caseUrl?: string;
        dashboardUrl?: string;
      };
      if (!body.employeeEmail || !body.orgId) {
        return jsonResponse(400, { error: 'employeeEmail and orgId are required' });
      }
      const admin = getSupabaseAdmin();
      const { data: payroll } = await admin
        .from('users')
        .select('email')
        .eq('org_id', body.orgId)
        .in('role', ['HR', 'ADMIN', 'SUPER_ADMIN'])
        .eq('status', 'active');
      const payrollEmails = (payroll ?? [])
        .map((u) => String(u.email))
        .filter((e) => e && e.toLowerCase() !== body.employeeEmail.toLowerCase());
      const result = await sendWageHourYesNotices({
        employeeEmail: body.employeeEmail,
        payrollEmails,
        dashboardUrl: body.dashboardUrl ?? '',
        caseUrl: body.caseUrl ?? '',
      });
      return jsonResponse(200, { ok: true, resendConfigured: isResendConfigured(), ...result });
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
      const name = body.stateName ?? code;
      const result = await syncStateLawsToDb(code, name, body.orgId);
      return jsonResponse(200, { ok: true, stateCode: code, ...result });
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
    const authCodes: Record<string, { status: number; error: string }> = {
      AUTH_REQUIRED: { status: 401, error: 'Sign in to perform this action.' },
      AUTH_INVALID: { status: 401, error: 'Your session has expired. Sign in again.' },
      AUTH_NO_PROFILE: { status: 403, error: 'No employee profile is linked to your account.' },
      FORBIDDEN: { status: 403, error: 'Only HR and administrators can invite employees.' },
    };
    if (authCodes[message]) {
      const mapped = authCodes[message];
      return jsonResponse(mapped.status, { error: mapped.error });
    }
    const status = message.includes('OPENAI') || message.includes('quota') ? 503 : 400;
    return jsonResponse(status, { error: message });
  }
});
