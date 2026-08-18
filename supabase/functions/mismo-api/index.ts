import { corsHeaders, jsonResponse, normalizePath } from '../_shared/cors.ts';
import { isSupabaseConfigured } from '../_shared/supabase.ts';
import { isOpenAiConfigured } from '../_shared/openai.ts';
import { computeHrNextTasks } from '../_shared/hr-next-tasks.ts';
import { listHrLawUpdates, listHrLawsForState, syncStateLawsToDb } from '../_shared/hr-laws.ts';
import { runOutreachCoach } from '../_shared/outreach-coach.ts';
import { runHelpAssistant } from '../_shared/help-assistant.ts';
import { inviteEmployee } from '../_shared/employees.ts';
import {
  sendIncidentYesNotices,
  sendWageHourYesNotices,
  isResendConfigured,
} from '../_shared/resend.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { createAppNotification } from '../_shared/app-notifications.ts';
import {
  sendOrgMessage,
  sendPasswordResetForEmployee,
  sendSelfPasswordReset,
} from '../_shared/product-mail.ts';
import { runPromptReminders } from '../_shared/prompt-reminders.ts';
import { authorizeCaller } from '../_shared/auth.ts';

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
        resend: isResendConfigured(),
      });
    }

    if (path === '/employees/invite' && req.method === 'POST') {
      const body = (await req.json()) as {
        email: string;
        redirectTo?: string;
        sendEmail?: boolean;
      };
      const result = await inviteEmployee({
        email: body.email,
        redirectTo: body.redirectTo,
        sendEmail: body.sendEmail,
        authHeader: req.headers.get('Authorization'),
      });
      return jsonResponse(200, result);
    }

    if (path === '/employees/password-reset' && req.method === 'POST') {
      const body = (await req.json()) as {
        targetUserId?: string;
        email?: string;
        redirectTo?: string;
        self?: boolean;
      };
      const result = body.self
        ? await sendSelfPasswordReset({
            authHeader: req.headers.get('Authorization'),
            redirectTo: body.redirectTo,
          })
        : await sendPasswordResetForEmployee({
            authHeader: req.headers.get('Authorization'),
            targetUserId: body.targetUserId,
            email: body.email,
            redirectTo: body.redirectTo,
          });
      return jsonResponse(200, result);
    }

    if (path === '/notifications/send' && req.method === 'POST') {
      const body = (await req.json()) as {
        recipientUserId: string;
        subject: string;
        body: string;
        kind?: 'MESSAGE' | 'MEMO' | 'PROMPT' | 'CASE_UPDATE' | 'SYSTEM';
        actionPage?: string;
        actionParams?: Record<string, string>;
        redirectTo?: string;
        templateId?: 'new_message' | 'new_memo' | 'prompt_notice';
      };
      if (!body.recipientUserId || !body.body?.trim()) {
        return jsonResponse(400, { error: 'recipientUserId and body are required' });
      }
      const result = await sendOrgMessage({
        authHeader: req.headers.get('Authorization'),
        recipientUserId: body.recipientUserId,
        subject: body.subject ?? 'New message on Mismo',
        body: body.body,
        kind: body.kind,
        actionPage: body.actionPage,
        actionParams: body.actionParams,
        redirectTo: body.redirectTo,
        templateId: body.templateId,
      });
      return jsonResponse(200, result);
    }

    if (path === '/notifications/incident-yes' && req.method === 'POST') {
      const caller = await authorizeCaller(req.headers.get('Authorization'));
      const body = (await req.json()) as {
        employeeEmail: string;
        orgId: string;
        caseUrl?: string;
        dashboardUrl?: string;
        intakeUrl?: string;
        employeeUserId?: string;
        caseId?: string;
      };
      if (!body.employeeEmail) {
        return jsonResponse(400, { error: 'employeeEmail is required' });
      }
      const orgId = caller.orgId;
      const admin = getSupabaseAdmin();
      const { data: admins } = await admin
        .from('users')
        .select('id, email')
        .eq('org_id', orgId)
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
        intakeUrl: body.intakeUrl,
      });

      let employeeUserId = body.employeeUserId;
      if (!employeeUserId) {
        const { data: emp } = await admin
          .from('users')
          .select('id')
          .eq('org_id', orgId)
          .ilike('email', body.employeeEmail)
          .maybeSingle();
        employeeUserId = emp?.id ? String(emp.id) : undefined;
      }
      if (employeeUserId) {
        await createAppNotification({
          orgId,
          userId: employeeUserId,
          kind: 'CASE_UPDATE',
          title: 'Incident report received — complete your form',
          body: 'Your incident response was relayed. Please complete the intake form.',
          actionPage: body.caseId ? 'incident-intake' : 'reports',
          actionParams: body.caseId ? { id: body.caseId } : undefined,
          relatedEmail: body.employeeEmail,
          emailStatus:
            result.employee.ok && result.employee.status === 'sent'
              ? 'sent'
              : String(result.employee.status ?? 'unknown'),
        });
      }
      for (const a of admins ?? []) {
        if (!a.id || !a.email) continue;
        if (String(a.email).toLowerCase() === body.employeeEmail.toLowerCase()) continue;
        await createAppNotification({
          orgId,
          userId: String(a.id),
          kind: 'CASE_UPDATE',
          title: 'Action required: Incident Report response',
          body: 'An employee Yes response needs your attention on the dashboard.',
          actionPage: body.caseId ? 'report-detail' : 'dashboard',
          actionParams: body.caseId ? { id: body.caseId } : undefined,
          relatedEmail: String(a.email),
          emailStatus:
            result.admins.ok && result.admins.status === 'sent'
              ? 'sent'
              : String(result.admins.status ?? 'unknown'),
        });
      }

      return jsonResponse(200, { ok: true, resendConfigured: isResendConfigured(), ...result });
    }

    if (path === '/notifications/wage-hour-yes' && req.method === 'POST') {
      const caller = await authorizeCaller(req.headers.get('Authorization'));
      const body = (await req.json()) as {
        employeeEmail: string;
        orgId: string;
        caseUrl?: string;
        dashboardUrl?: string;
        intakeUrl?: string;
        employeeUserId?: string;
        caseId?: string;
        referenceNumber?: string;
      };
      if (!body.employeeEmail) {
        return jsonResponse(400, { error: 'employeeEmail is required' });
      }
      const orgId = caller.orgId;
      const admin = getSupabaseAdmin();
      const { data: payroll } = await admin
        .from('users')
        .select('id, email')
        .eq('org_id', orgId)
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
        intakeUrl: body.intakeUrl,
      });

      let employeeUserId = body.employeeUserId;
      if (!employeeUserId) {
        const { data: emp } = await admin
          .from('users')
          .select('id')
          .eq('org_id', orgId)
          .ilike('email', body.employeeEmail)
          .maybeSingle();
        employeeUserId = emp?.id ? String(emp.id) : undefined;
      }
      const caseLabel = body.referenceNumber || body.caseId || 'wage case';
      const hrActionPage = body.caseId ? 'report-detail' : 'prompt-responses';
      const hrActionParams = body.caseId
        ? { id: body.caseId }
        : {
            view: 'register',
            register: '1',
            channel: 'wage_hour',
            caseType: 'WAGE_HOUR',
            status: 'PENDING_WAGE_HOUR_REVIEW',
          };
      if (employeeUserId) {
        await createAppNotification({
          orgId,
          userId: employeeUserId,
          kind: 'CASE_UPDATE',
          title: 'Wage & hour — complete your form',
          body: `Your wage & hour response (${caseLabel}) was relayed. Please complete the intake form.`,
          actionPage: body.caseId ? 'wage-hour-intake' : 'reports',
          actionParams: body.caseId ? { id: body.caseId } : undefined,
          relatedEmail: body.employeeEmail,
          emailStatus:
            result.employee.ok && result.employee.status === 'sent'
              ? 'sent'
              : String(result.employee.status ?? 'unknown'),
        });
      }
      for (const a of payroll ?? []) {
        if (!a.id || !a.email) continue;
        if (String(a.email).toLowerCase() === body.employeeEmail.toLowerCase()) continue;
        await createAppNotification({
          orgId,
          userId: String(a.id),
          kind: 'CASE_UPDATE',
          title: 'Action required: Wage and Hour response',
          body: `Employee wage & hour Yes response (${caseLabel}) needs your attention.`,
          actionPage: hrActionPage,
          actionParams: hrActionParams,
          relatedEmail: String(a.email),
          emailStatus:
            result.payroll.ok && result.payroll.status === 'sent'
              ? 'sent'
              : String(result.payroll.status ?? 'unknown'),
        });
      }

      return jsonResponse(200, { ok: true, resendConfigured: isResendConfigured(), ...result });
    }

    if (path === '/cron/prompt-reminders' && (req.method === 'POST' || req.method === 'GET')) {
      const caller = await authorizeCaller(req.headers.get('Authorization'), { privilegedOnly: true });
      const body =
        req.method === 'POST'
          ? ((await req.json().catch(() => ({}))) as {
              force?: boolean;
              orgId?: string;
              redirectTo?: string;
            })
          : {};
      const result = await runPromptReminders({
        authHeader: req.headers.get('Authorization'),
        force: body.force === true || url.searchParams.get('force') === '1',
        orgId: caller.orgId,
        redirectTo: body.redirectTo ?? undefined,
      });
      return jsonResponse(200, result);
    }

    if (path === '/ai/outreach/coach' && req.method === 'POST') {
      const caller = await authorizeCaller(req.headers.get('Authorization'), { privilegedOnly: true });
      const body = (await req.json()) as Parameters<typeof runOutreachCoach>[0];
      const result = await runOutreachCoach({ ...body, orgId: caller.orgId, createdBy: caller.appUserId });
      return jsonResponse(200, result);
    }

    if (path === '/ai/help/ask' && req.method === 'POST') {
      const caller = await authorizeCaller(req.headers.get('Authorization'));
      const body = (await req.json()) as Parameters<typeof runHelpAssistant>[0];
      const result = await runHelpAssistant({ ...body, orgId: caller.orgId, role: caller.role });
      return jsonResponse(200, result);
    }

    if (path === '/hr-laws' && req.method === 'GET') {
      const state = url.searchParams.get('state') ?? 'CA';
      const topic = url.searchParams.get('topic') ?? undefined;
      const laws = await listHrLawsForState(state, topic);
      return jsonResponse(200, { laws });
    }

    if (path === '/hr-laws/updates' && req.method === 'GET') {
      const caller = await authorizeCaller(req.headers.get('Authorization'), { privilegedOnly: true });
      const updates = await listHrLawUpdates(caller.orgId);
      return jsonResponse(200, { updates });
    }

    if (path === '/hr-laws/sync' && req.method === 'POST') {
      const caller = await authorizeCaller(req.headers.get('Authorization'), { privilegedOnly: true });
      const body = (await req.json()) as { stateCode: string; stateName?: string; orgId?: string };
      const code = body.stateCode?.toUpperCase();
      if (!code) throw new Error('stateCode is required');
      const name = body.stateName ?? code;
      const result = await syncStateLawsToDb(code, name, caller.orgId);
      return jsonResponse(200, { ok: true, stateCode: code, ...result });
    }

    if (path === '/hr/next-tasks' && req.method === 'GET') {
      const caller = await authorizeCaller(req.headers.get('Authorization'), { privilegedOnly: true });
      const orgId = caller.orgId;
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
      FORBIDDEN: { status: 403, error: 'Only HR and administrators can perform this action.' },
    };
    if (authCodes[message]) {
      const mapped = authCodes[message];
      return jsonResponse(mapped.status, { error: mapped.error });
    }
    const status = message.includes('OPENAI') || message.includes('quota') ? 503 : 400;
    return jsonResponse(status, { error: message });
  }
});
