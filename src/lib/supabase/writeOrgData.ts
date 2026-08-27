import type {
  Department,
  Investigation,
  Policy,
  PolicyAcknowledgement,
  Prompt,
  PromptDelivery,
  PromptResponse,
  Report,
  ReportStatusEvent,
  User,
} from '@/types';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { isSupabaseAppConfigured } from '@/data/orgDefaults';
import { sanitizeInfraError } from '@/lib/infraMessaging';
import { toast } from 'sonner';

/** P0 write path: persist core mutations to the cloud database via the
 *  authenticated client (governed by RLS). Optimistic UI updates stay in
 *  useDataStore; these calls make the change durable across refreshes. */

function iso(value: Date | undefined | null): string | null {
  if (!value) return null;
  const dt = value instanceof Date ? value : new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

/** DATE columns want YYYY-MM-DD, not a full timestamp. */
function dateOnly(value: Date | undefined | null): string | null {
  const s = iso(value);
  return s ? s.slice(0, 10) : null;
}

function reportPersistEnabled(): boolean {
  return isSupabaseAppConfigured();
}

function notify(entity: string, error: { message: string }): void {
  toast.error(`Could not save ${entity}. ${sanitizeInfraError(error.message)}`);
}

type SupabaseLike = ReturnType<typeof getSupabaseClient>;

/** Return id if the row exists; otherwise null (avoids FK violations on orphan client ids). */
async function existingRowId(
  supabase: SupabaseLike,
  table: 'prompts' | 'prompt_responses' | 'reports' | 'users',
  id: string | null | undefined
): Promise<string | null> {
  if (!id) return null;
  const { data } = await supabase.from(table).select('id').eq('id', id).maybeSingle();
  return data?.id ? String(data.id) : null;
}

/**
 * Resolve a prompt_responses id that may only exist locally.
 * Tries exact id, then `response-{deliveryId}` → lookup by prompt_delivery_id.
 */
async function resolvePromptResponseFk(
  supabase: SupabaseLike,
  responseId: string | null | undefined
): Promise<string | null> {
  if (!responseId) return null;
  const byId = await existingRowId(supabase, 'prompt_responses', responseId);
  if (byId) return byId;
  if (responseId.startsWith('response-')) {
    const deliveryId = responseId.slice('response-'.length);
    if (deliveryId) {
      const { data } = await supabase
        .from('prompt_responses')
        .select('id')
        .eq('prompt_delivery_id', deliveryId)
        .maybeSingle();
      if (data?.id) return String(data.id);
    }
  }
  return null;
}

async function reportRowForPersist(
  supabase: SupabaseLike,
  report: Report
): Promise<Record<string, unknown>> {
  const row = reportRow(report);
  row.source_prompt_id = await existingRowId(supabase, 'prompts', report.sourcePromptId);
  row.source_prompt_response_id = await resolvePromptResponseFk(supabase, report.sourcePromptResponseId);
  return row;
}

async function investigationRowForPersist(
  supabase: SupabaseLike,
  inv: Investigation
): Promise<Record<string, unknown>> {
  const row = investigationRow(inv);
  row.linked_prompt_id = await existingRowId(supabase, 'prompts', inv.linkedPromptId);
  row.linked_prompt_response_id = await resolvePromptResponseFk(supabase, inv.linkedPromptResponseId);
  return row;
}

function userRow(user: User): Record<string, unknown> {
  return {
    id: user.id,
    org_id: user.orgId,
    role: user.role,
    job_title: user.jobTitle ?? null,
    first_name: user.firstName,
    last_name: user.lastName,
    email: user.email,
    phone: user.phone ?? null,
    employee_id: user.employeeId ?? null,
    location: user.location ?? null,
    archive_start_date: dateOnly(user.archiveStartDate),
    archive_end_date: dateOnly(user.archiveEndDate),
    department_id: user.departmentId ?? null,
    manager_id: user.managerId ?? null,
    hired_date: dateOnly(user.hiredDate),
    state: user.state ?? null,
    status: user.status,
    updated_at: iso(user.updatedAt) ?? new Date().toISOString(),
  };
}

function promptRow(prompt: Prompt): Record<string, unknown> {
  return {
    id: prompt.id,
    org_id: prompt.orgId,
    type: prompt.type,
    title: prompt.title,
    description: prompt.description ?? '',
    cadence: prompt.schedule.cadence,
    schedule_start_at: iso(prompt.schedule.startAt) ?? new Date().toISOString(),
    schedule_end_at: iso(prompt.schedule.endAt),
    audience: prompt.targeting.audience,
    severity_on_has_issue: prompt.severityOnHasIssue,
    allow_anonymous_reports: Boolean(prompt.allowAnonymousReports),
    status: prompt.status,
    route_to_payroll: Boolean(prompt.routeToPayroll),
    include_financial_question: Boolean(prompt.includeFinancialQuestion),
    created_by:
      prompt.createdBy && prompt.createdBy !== 'system' ? prompt.createdBy : null,
    updated_at: iso(prompt.updatedAt) ?? new Date().toISOString(),
  };
}

function deliveryRow(delivery: PromptDelivery): Record<string, unknown> {
  return {
    id: delivery.id,
    org_id: delivery.orgId,
    prompt_id: delivery.promptId,
    user_id: delivery.userId,
    status: delivery.status,
    delivered_at: iso(delivery.deliveredAt) ?? new Date().toISOString(),
    due_at: iso(delivery.dueAt),
    completed_at: iso(delivery.completedAt),
    updated_at: iso(delivery.updatedAt) ?? new Date().toISOString(),
  };
}

function reportRow(report: Report): Record<string, unknown> {
  return {
    id: report.id,
    org_id: report.orgId,
    created_by_user_id: report.createdByUserId ?? null,
    is_anonymous: Boolean(report.isAnonymous),
    source_prompt_id: report.sourcePromptId ?? null,
    source_prompt_response_id: report.sourcePromptResponseId ?? null,
    report_source_type: report.reportSourceType ?? null,
    case_type: report.caseType ?? null,
    reference_number: report.referenceNumber ?? null,
    category: report.category,
    severity: report.severity,
    summary: report.summary ?? '',
    description: report.description ?? '',
    people_involved: report.peopleInvolved ?? null,
    location: report.location ?? null,
    incident_at: iso(report.incidentAt),
    status: report.status,
    assigned_to: report.assignedTo ?? null,
    investigation_id: report.investigationId ?? null,
    preferred_contact_method: report.preferredContactMethod ?? null,
    needs_extended_incident_intake: Boolean(report.needsExtendedIncidentIntake),
    incident_intake_completed_at: iso(report.incidentIntakeCompletedAt),
    needs_extended_wage_hour_intake: Boolean(report.needsExtendedWageHourIntake),
    wage_hour_intake_completed_at: iso(report.wageHourIntakeCompletedAt),
    wage_hour_intake: report.wageHourIntake
      ? {
          ...report.wageHourIntake,
          submittedAt: report.wageHourIntake.submittedAt
            ? iso(report.wageHourIntake.submittedAt)
            : null,
        }
      : null,
    expedited_payroll: Boolean(report.expeditedPayroll),
    payroll_sla_due_at: iso(report.payrollSlaDueAt),
    created_at: iso(report.createdAt) ?? new Date().toISOString(),
    updated_at: iso(report.updatedAt) ?? new Date().toISOString(),
  };
}

export type PersistResult = { ok: true } | { ok: false; message: string };

/** Insert or update users (bulk add + single add). */
export async function persistUsers(users: User[]): Promise<void> {
  if (!reportPersistEnabled() || users.length === 0) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('users').upsert(users.map(userRow), { onConflict: 'id' });
    if (error) notify(users.length > 1 ? 'employees' : 'employee', error);
  } catch (err) {
    notify('employee', { message: err instanceof Error ? err.message : String(err) });
  }
}

/** Update a single user record (edit form). */
export async function persistUserUpdate(user: User): Promise<void> {
  await persistUsers([user]);
}

/** Persist a newly created report. Throws-free: returns result so callers can block success UI. */
export async function persistReport(report: Report): Promise<PersistResult> {
  if (!reportPersistEnabled()) return { ok: true };
  try {
    const supabase = getSupabaseClient();
    const row = await reportRowForPersist(supabase, report);
    // Prefer INSERT for new cases so employee RLS UPDATE is not required on first write.
    const { error: insertErr } = await supabase.from('reports').insert(row);
    if (!insertErr) return { ok: true };
    if (insertErr.code === '23505') {
      const { id: _id, org_id: _org, created_at: _ca, ...patch } = row;
      const { error: updErr } = await supabase
        .from('reports')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', report.id)
        .eq('org_id', report.orgId);
      if (updErr) {
        notify('report', updErr);
        return { ok: false, message: updErr.message };
      }
      return { ok: true };
    }
    notify('report', insertErr);
    return { ok: false, message: insertErr.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    notify('report', { message });
    return { ok: false, message };
  }
}

/** Persist a single prompt delivery (e.g. daily check-in).
 * Pass `prompt` when the delivery may reference a core prompt that is not yet in the DB. */
export async function persistPromptDelivery(
  delivery: PromptDelivery,
  prompt?: Prompt
): Promise<void> {
  if (!reportPersistEnabled()) return;
  try {
    const supabase = getSupabaseClient();
    if (prompt) {
      // Seed only via INSERT. Upsert/ON CONFLICT DO UPDATE hits UPDATE RLS
      // (USING requires HR), which blocks employees seeding the daily check-in.
      const { error: promptErr } = await supabase.from('prompts').insert(promptRow(prompt));
      if (promptErr && promptErr.code !== '23505') {
        notify('prompt', promptErr);
        return;
      }
    }
    // Avoid upsert: ON CONFLICT DO UPDATE fails RLS USING when org context is
    // missing or the row already exists from a prior seed.
    const row = deliveryRow(delivery);
    const { error: insertErr } = await supabase.from('prompt_deliveries').insert(row);
    if (!insertErr) return;
    if (insertErr.code === '23505') {
      const { id: _id, org_id: _org, ...patch } = row;
      const { error: updErr } = await supabase
        .from('prompt_deliveries')
        .update(patch)
        .eq('id', delivery.id)
        .eq('org_id', delivery.orgId);
      // Duplicate PENDING seed: ignore update failures (row already present).
      if (updErr && delivery.status !== 'PENDING') {
        notify('prompt delivery', updErr);
      }
      return;
    }
    notify('prompt delivery', insertErr);
  } catch (err) {
    notify('prompt delivery', { message: err instanceof Error ? err.message : String(err) });
  }
}

/** Persist a newly created prompt plus its generated deliveries. */
export async function persistPrompt(prompt: Prompt, deliveries: PromptDelivery[] = []): Promise<void> {
  if (!reportPersistEnabled()) return;
  try {
    const supabase = getSupabaseClient();
    const row = promptRow(prompt);
    const { error } = await supabase.from('prompts').insert(row);
    if (error) {
      // Idempotent retry / remount: fall back to same-org update only.
      if (error.code === '23505') {
        const { error: updErr } = await supabase
          .from('prompts')
          .update(row)
          .eq('id', prompt.id)
          .eq('org_id', prompt.orgId);
        if (updErr) {
          notify('prompt', updErr);
          return;
        }
      } else {
        notify('prompt', error);
        return;
      }
    }
    if (deliveries.length > 0) {
      const { error: delErr } = await supabase
        .from('prompt_deliveries')
        .upsert(deliveries.map(deliveryRow), { onConflict: 'id' });
      if (delErr) notify('prompt deliveries', delErr);
    }
  } catch (err) {
    notify('prompt', { message: err instanceof Error ? err.message : String(err) });
  }
}

/** Persist prompt field updates (activate/deactivate, edits). */
export async function persistPromptUpdate(prompt: Prompt): Promise<void> {
  if (!reportPersistEnabled()) return;
  try {
    const supabase = getSupabaseClient();
    const { id: _id, org_id: _org, created_by: _cb, ...patch } = promptRow(prompt);
    const { error } = await supabase
      .from('prompts')
      .update({ ...patch, updated_at: iso(prompt.updatedAt) ?? new Date().toISOString() })
      .eq('id', prompt.id)
      .eq('org_id', prompt.orgId);
    if (error) notify('prompt', error);
  } catch (err) {
    notify('prompt', { message: err instanceof Error ? err.message : String(err) });
  }
}

function responseRow(response: PromptResponse): Record<string, unknown> {
  return {
    id: response.id,
    org_id: response.orgId,
    prompt_id: response.promptId,
    prompt_delivery_id: response.promptDeliveryId,
    user_id: response.userId,
    answer: response.answer,
    notes: response.notes ?? null,
    needs_review: Boolean(response.needsReview),
    reviewed_at: iso(response.reviewedAt),
    finalized_at: iso(response.finalizedAt),
    submitted_at: iso(response.submittedAt) ?? new Date().toISOString(),
    updated_at: iso(response.updatedAt) ?? new Date().toISOString(),
  };
}

function statusEventRow(event: ReportStatusEvent): Record<string, unknown> {
  return {
    id: event.id,
    org_id: event.orgId,
    report_id: event.reportId,
    from_status: event.fromStatus,
    to_status: event.toStatus,
    changed_by: event.changedBy ?? null,
    note: event.note ?? null,
    updated_at: iso(event.updatedAt) ?? new Date().toISOString(),
  };
}

function investigationRow(inv: Investigation): Record<string, unknown> {
  return {
    id: inv.id,
    org_id: inv.orgId,
    reference_number: inv.referenceNumber ?? null,
    status: inv.status,
    owner_id: inv.ownerId,
    category: inv.category ?? null,
    severity: inv.severity ?? null,
    workflow_phase: inv.workflowPhase ?? null,
    stage: inv.stage ?? null,
    priority: inv.priority ?? null,
    investigation_type: inv.investigationType ?? null,
    report_source_type: inv.reportSourceType ?? null,
    linked_prompt_id: inv.linkedPromptId ?? null,
    linked_prompt_response_id: inv.linkedPromptResponseId ?? null,
    employee_preferred_contact: inv.employeePreferredContact ?? null,
    outcome_summary: inv.outcomeSummary ?? null,
    outcome_requires_signature: inv.outcomeRequiresSignature ?? false,
    outcome_sent_at: iso(inv.outcomeSentAt),
    outcome_employee_signed_at: iso(inv.outcomeEmployeeSignedAt),
    outcome_employee_agreed: inv.outcomeEmployeeAgreed ?? null,
    outcome_classification: inv.outcomeClassification ?? null,
    outcome_viewed_at: iso(inv.outcomeViewedAt),
    findings_rationale: inv.findingsRationale ?? null,
    policy_analysis_notes: inv.policyAnalysisNotes ?? null,
    final_findings_report: inv.finalFindingsReport ?? null,
    legal_involved: Boolean(inv.legalInvolved),
    legal_involvement_notes: inv.legalInvolvementNotes ?? null,
    risk_level: inv.riskLevel ?? null,
    initial_contact_notes: inv.initialContactNotes ?? null,
    non_retaliation_sent_at: iso(inv.nonRetaliationSentAt),
    picked_up_at: iso(inv.pickedUpAt),
    opened_at: iso(inv.openedAt) ?? new Date().toISOString(),
    closed_at: iso(inv.closedAt),
    last_update_at: iso(inv.lastUpdateAt) ?? new Date().toISOString(),
    checklist_stages: inv.checklistStages ?? [],
    workflow_pages_completed: inv.workflowPagesCompleted ?? {},
    updated_at: iso(inv.updatedAt) ?? new Date().toISOString(),
  };
}

function policyRow(policy: Policy): Record<string, unknown> {
  return {
    id: policy.id,
    org_id: policy.orgId,
    title: policy.title,
    type: policy.type,
    content: policy.content ?? '',
    status: policy.status,
    acknowledgment_required: Boolean(policy.acknowledgmentRequired),
    effective_date: iso(policy.effectiveDate) ?? new Date().toISOString(),
    published_at: iso(policy.publishedAt),
    completion_due_date: iso(policy.completionDueDate),
    memo_category: policy.memoCategory ?? null,
    tags: policy.tags ?? [],
    body_source: policy.bodySource ?? null,
    body_attachment_file_name: policy.bodyAttachmentFileName ?? null,
    body_source_url: policy.bodySourceUrl ?? null,
    law_digest: policy.lawDigest ?? null,
    updated_at: iso(policy.updatedAt) ?? new Date().toISOString(),
  };
}

function policyAckRow(ack: PolicyAcknowledgement): Record<string, unknown> {
  return {
    policy_id: ack.policyId,
    user_id: ack.userId,
    acknowledged_at: iso(ack.acknowledgedAt) ?? new Date().toISOString(),
    outcome: ack.outcome ?? null,
    clarification_note: ack.clarificationNote ?? null,
    acknowledged_law_digest: ack.acknowledgedLawDigest ?? null,
  };
}

/** Ensure a delivery row exists and is marked complete when possible.
 * Does not fail the response save if only the status update is blocked. */
async function ensurePromptDeliveryForResponse(
  supabase: SupabaseLike,
  delivery: PromptDelivery
): Promise<{ ok: boolean; error?: { message: string } }> {
  const row = deliveryRow(delivery);
  const { error: insertErr } = await supabase.from('prompt_deliveries').insert(row);
  if (!insertErr) return { ok: true };

  if (insertErr.code !== '23505') {
    return { ok: false, error: insertErr };
  }

  // Row exists — only patch completion fields (avoids rewriting identity cols).
  const completionPatch = {
    status: row.status,
    completed_at: row.completed_at,
    updated_at: row.updated_at,
  };
  const { error: updErr } = await supabase
    .from('prompt_deliveries')
    .update(completionPatch)
    .eq('id', delivery.id);

  if (!updErr) return { ok: true };

  // Delivery already present is enough for the response FK; log softly.
  const { data: existing } = await supabase
    .from('prompt_deliveries')
    .select('id')
    .eq('id', delivery.id)
    .maybeSingle();
  if (existing?.id) return { ok: true };

  return { ok: false, error: updErr };
}

/** Persist a submitted check-in response and mark its delivery complete.
 * Returns the response id that exists in the DB (may differ if a row already
 * existed for this delivery). Delivery is written first — responses FK to it. */
export async function persistPromptResponse(
  response: PromptResponse,
  delivery?: PromptDelivery
): Promise<{ ok: boolean; responseId: string }> {
  if (!reportPersistEnabled()) return { ok: true, responseId: response.id };
  try {
    const supabase = getSupabaseClient();

    if (delivery) {
      const ensured = await ensurePromptDeliveryForResponse(supabase, delivery);
      if (!ensured.ok) {
        notify('response', ensured.error ?? { message: 'Could not save prompt delivery.' });
        return { ok: false, responseId: response.id };
      }
    }

    const row = responseRow(response);
    const { error: insertErr } = await supabase.from('prompt_responses').insert(row);
    if (!insertErr) return { ok: true, responseId: response.id };

    // Unique on prompt_delivery_id: another id already answered this delivery.
    if (insertErr.code === '23505') {
      const { data: existing, error: selErr } = await supabase
        .from('prompt_responses')
        .select('id')
        .eq('prompt_delivery_id', response.promptDeliveryId)
        .maybeSingle();
      if (selErr) {
        notify('response', selErr);
        return { ok: false, responseId: response.id };
      }
      const existingId = existing?.id ? String(existing.id) : response.id;
      const { id: _id, prompt_delivery_id: _pd, org_id: _org, ...patch } = row;
      const { error: updErr } = await supabase
        .from('prompt_responses')
        .update(patch)
        .eq('prompt_delivery_id', response.promptDeliveryId);
      if (updErr) {
        notify('response', updErr);
        return { ok: false, responseId: existingId };
      }
      return { ok: true, responseId: existingId };
    }

    notify('response', insertErr);
    return { ok: false, responseId: response.id };
  } catch (err) {
    notify('response', { message: err instanceof Error ? err.message : String(err) });
    return { ok: false, responseId: response.id };
  }
}

/** Persist check-in response first, then the linked report (FK requires response row). */
export async function persistResponseThenReport(
  response: PromptResponse,
  delivery: PromptDelivery | undefined,
  report: Report
): Promise<PersistResult> {
  if (!reportPersistEnabled()) return { ok: true };
  const result = await persistPromptResponse(response, delivery);
  if (!result.ok) {
    return { ok: false, message: 'Could not save prompt response before report.' };
  }
  const reportToSave =
    result.responseId === report.sourcePromptResponseId
      ? report
      : { ...report, sourcePromptResponseId: result.responseId };
  return persistReport(reportToSave);
}

/** Persist a report status/assignment change plus its status-event trail. */
export async function persistReportChange(
  report: Report,
  statusEvent?: ReportStatusEvent
): Promise<PersistResult> {
  if (!reportPersistEnabled()) return { ok: true };
  try {
    const supabase = getSupabaseClient();
    const row = await reportRowForPersist(supabase, report);
    const { id: _id, org_id: _org, ...patch } = row;
    const { error } = await supabase
      .from('reports')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', report.id)
      .eq('org_id', report.orgId);
    if (error) {
      // Row may not exist yet (failed create) — try insert.
      const inserted = await persistReport(report);
      if (!inserted.ok) return inserted;
    }
    if (statusEvent) {
      const { error: evtErr } = await supabase
        .from('report_status_events')
        .upsert(statusEventRow(statusEvent), { onConflict: 'id' });
      if (evtErr) notify('report history', evtErr);
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    notify('report', { message });
    return { ok: false, message };
  }
}

/** Persist an investigation record plus its linked-report joins. */
export async function persistInvestigation(inv: Investigation): Promise<void> {
  if (!reportPersistEnabled()) return;
  try {
    const supabase = getSupabaseClient();
    const row = await investigationRowForPersist(supabase, inv);
    const { error } = await supabase.from('investigations').upsert(row, { onConflict: 'id' });
    if (error) {
      notify('investigation', error);
      return;
    }
    if (inv.linkedReportIds.length > 0) {
      // Only link reports that already exist remotely (avoids join FK failures).
      const existingReportIds: string[] = [];
      for (const reportId of inv.linkedReportIds) {
        const id = await existingRowId(supabase, 'reports', reportId);
        if (id) existingReportIds.push(id);
      }
      if (existingReportIds.length > 0) {
        const links = existingReportIds.map((reportId) => ({
          investigation_id: inv.id,
          report_id: reportId,
        }));
        const { error: linkErr } = await supabase
          .from('investigation_linked_reports')
          .upsert(links, { onConflict: 'investigation_id,report_id' });
        if (linkErr) notify('investigation links', linkErr);
      }
    }
  } catch (err) {
    notify('investigation', { message: err instanceof Error ? err.message : String(err) });
  }
}

/** Persist a policy record (create + update). */
export async function persistPolicy(policy: Policy): Promise<void> {
  if (!reportPersistEnabled()) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('policies').upsert(policyRow(policy), { onConflict: 'id' });
    if (error) notify('policy', error);
  } catch (err) {
    notify('policy', { message: err instanceof Error ? err.message : String(err) });
  }
}

/** Persist a policy acknowledgement. */
export async function persistPolicyAck(ack: PolicyAcknowledgement): Promise<void> {
  if (!reportPersistEnabled()) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('policy_acknowledgements')
      .upsert(policyAckRow(ack), { onConflict: 'policy_id,user_id' });
    if (error) notify('acknowledgement', error);
  } catch (err) {
    notify('acknowledgement', { message: err instanceof Error ? err.message : String(err) });
  }
}

function departmentRow(dept: Department): Record<string, unknown> {
  return {
    id: dept.id,
    org_id: dept.orgId,
    name: dept.name,
    updated_at: iso(dept.updatedAt) ?? new Date().toISOString(),
  };
}

/** Persist a department (create or rename). */
export async function persistDepartment(dept: Department): Promise<void> {
  if (!reportPersistEnabled()) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('departments').upsert(departmentRow(dept), { onConflict: 'id' });
    if (error) notify('department', error);
  } catch (err) {
    notify('department', { message: err instanceof Error ? err.message : String(err) });
  }
}

/** Persist organization settings (including custom roles). */
export async function persistOrgSettings(
  orgId: string,
  settings: import('@/types').Organization['settings']
): Promise<void> {
  if (!reportPersistEnabled()) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('organizations')
      .update({ settings, updated_at: new Date().toISOString() })
      .eq('id', orgId);
    if (error) notify('organization settings', error);
  } catch (err) {
    notify('organization settings', { message: err instanceof Error ? err.message : String(err) });
  }
}

/** Delete a department. Employees assigned to it become unassigned. */
export async function deleteDepartmentRecord(departmentId: string): Promise<void> {
  if (!reportPersistEnabled()) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('departments').delete().eq('id', departmentId);
    if (error) notify('department', error);
  } catch (err) {
    notify('department', { message: err instanceof Error ? err.message : String(err) });
  }
}
