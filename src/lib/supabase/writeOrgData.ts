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
    case_type: report.caseType ?? null,
    reference_number: report.referenceNumber ?? null,
    category: report.category,
    severity: report.severity,
    summary: report.summary ?? '',
    description: report.description ?? '',
    status: report.status,
    assigned_to: report.assignedTo ?? null,
    investigation_id: report.investigationId ?? null,
    needs_extended_incident_intake: Boolean(report.needsExtendedIncidentIntake),
    incident_intake_completed_at: iso(report.incidentIntakeCompletedAt),
    updated_at: iso(report.updatedAt) ?? new Date().toISOString(),
  };
}

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

/** Persist a newly created report. */
export async function persistReport(report: Report): Promise<void> {
  if (!reportPersistEnabled()) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('reports').upsert(reportRow(report), { onConflict: 'id' });
    if (error) notify('report', error);
  } catch (err) {
    notify('report', { message: err instanceof Error ? err.message : String(err) });
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
      const { error: promptErr } = await supabase
        .from('prompts')
        .upsert(promptRow(prompt), { onConflict: 'id' });
      if (promptErr) {
        notify('prompt', promptErr);
        return;
      }
    }
    const { error } = await supabase
      .from('prompt_deliveries')
      .upsert(deliveryRow(delivery), { onConflict: 'id' });
    if (error) notify('prompt delivery', error);
  } catch (err) {
    notify('prompt delivery', { message: err instanceof Error ? err.message : String(err) });
  }
}

/** Persist a prompt plus its generated deliveries. */
export async function persistPrompt(prompt: Prompt, deliveries: PromptDelivery[] = []): Promise<void> {
  if (!reportPersistEnabled()) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('prompts').upsert(promptRow(prompt), { onConflict: 'id' });
    if (error) {
      notify('prompt', error);
      return;
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
  await persistPrompt(prompt);
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
    linked_prompt_id: inv.linkedPromptId ?? null,
    linked_prompt_response_id: inv.linkedPromptResponseId ?? null,
    outcome_summary: inv.outcomeSummary ?? null,
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
  };
}

/** Persist a submitted check-in response and mark its delivery complete. */
export async function persistPromptResponse(
  response: PromptResponse,
  delivery?: PromptDelivery
): Promise<void> {
  if (!reportPersistEnabled()) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('prompt_responses')
      .upsert(responseRow(response), { onConflict: 'id' });
    if (error) {
      notify('response', error);
      return;
    }
    if (delivery) {
      const { error: delErr } = await supabase
        .from('prompt_deliveries')
        .upsert(deliveryRow(delivery), { onConflict: 'id' });
      if (delErr) notify('response', delErr);
    }
  } catch (err) {
    notify('response', { message: err instanceof Error ? err.message : String(err) });
  }
}

/** Persist a report status/assignment change plus its status-event trail. */
export async function persistReportChange(
  report: Report,
  statusEvent?: ReportStatusEvent
): Promise<void> {
  if (!reportPersistEnabled()) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('reports').upsert(reportRow(report), { onConflict: 'id' });
    if (error) {
      notify('report', error);
      return;
    }
    if (statusEvent) {
      const { error: evtErr } = await supabase
        .from('report_status_events')
        .upsert(statusEventRow(statusEvent), { onConflict: 'id' });
      if (evtErr) notify('report history', evtErr);
    }
  } catch (err) {
    notify('report', { message: err instanceof Error ? err.message : String(err) });
  }
}

/** Persist an investigation record plus its linked-report joins. */
export async function persistInvestigation(inv: Investigation): Promise<void> {
  if (!reportPersistEnabled()) return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('investigations')
      .upsert(investigationRow(inv), { onConflict: 'id' });
    if (error) {
      notify('investigation', error);
      return;
    }
    if (inv.linkedReportIds.length > 0) {
      const links = inv.linkedReportIds.map((reportId) => ({
        investigation_id: inv.id,
        report_id: reportId,
      }));
      const { error: linkErr } = await supabase
        .from('investigation_linked_reports')
        .upsert(links, { onConflict: 'investigation_id,report_id' });
      if (linkErr) notify('investigation links', linkErr);
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
