import type {
  ActivityEvent,
  Announcement,
  AppNotification,
  AuditLogEntry,
  CompanyResource,
  Department,
  EmergencyHotline,
  Investigation,
  Nudge,
  Policy,
  PolicyAcknowledgement,
  Prompt,
  PromptDelivery,
  PromptResponse,
  Report,
  ReportStatusEvent,
  User,
} from '@/types';
import type { Organization } from '@/types';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { DEFAULT_ORG_SETTINGS } from '@/data/orgDefaults';

function d(v: string | null | undefined): Date {
  if (!v) return new Date();
  return new Date(v);
}

function optDate(v: string | null | undefined): Date | undefined {
  return v ? new Date(v) : undefined;
}

function mapUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    role: row.role as User['role'],
    jobTitle: row.job_title ? String(row.job_title) : undefined,
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    email: String(row.email),
    phone: row.phone ? String(row.phone) : undefined,
    employeeId: row.employee_id ? String(row.employee_id) : undefined,
    location: row.location ? String(row.location) : undefined,
    departmentId: row.department_id ? String(row.department_id) : undefined,
    managerId: row.manager_id ? String(row.manager_id) : undefined,
    hiredDate: optDate(row.hired_date as string | null),
    state: row.state ? String(row.state) : undefined,
    status: (row.status as User['status']) ?? 'active',
    authUserId: row.auth_user_id ? String(row.auth_user_id) : undefined,
    archiveStartDate: optDate(row.archive_start_date as string | null),
    archiveEndDate: optDate(row.archive_end_date as string | null),
    createdAt: d(row.created_at as string),
    updatedAt: d(row.updated_at as string),
  };
}

function mapDepartment(row: Record<string, unknown>): Department {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    name: String(row.name),
    createdAt: d(row.created_at as string),
    updatedAt: d(row.updated_at as string),
  };
}

function mapPrompt(row: Record<string, unknown>): Prompt {
  const createdAt = d(row.created_at as string);
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    title: String(row.title),
    description: String(row.description ?? ''),
    type: row.type as Prompt['type'],
    schedule: {
      cadence: row.cadence as Prompt['schedule']['cadence'],
      startAt: d(row.schedule_start_at as string),
      endAt: optDate(row.schedule_end_at as string | null),
    },
    targeting: {
      audience: row.audience as Prompt['targeting']['audience'],
    },
    status: row.status as Prompt['status'],
    severityOnHasIssue: row.severity_on_has_issue as Prompt['severityOnHasIssue'],
    allowAnonymousReports: Boolean(row.allow_anonymous_reports),
    createdBy: row.created_by ? String(row.created_by) : '',
    routeToPayroll: Boolean(row.route_to_payroll),
    includeFinancialQuestion: Boolean(row.include_financial_question),
    createdAt,
    updatedAt: d(row.updated_at as string),
  };
}

function mapDelivery(row: Record<string, unknown>): PromptDelivery {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    promptId: String(row.prompt_id),
    userId: String(row.user_id),
    status: row.status as PromptDelivery['status'],
    deliveredAt: d(row.delivered_at as string),
    dueAt: optDate(row.due_at as string | null),
    completedAt: optDate(row.completed_at as string | null),
    createdAt: d(row.created_at as string),
    updatedAt: d(row.updated_at as string),
  };
}

function mapResponse(row: Record<string, unknown>): PromptResponse {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    promptId: String(row.prompt_id),
    promptDeliveryId: String(row.prompt_delivery_id),
    userId: String(row.user_id),
    answer: row.answer as PromptResponse['answer'],
    submittedAt: d(row.submitted_at as string),
    finalizedAt: optDate(row.finalized_at as string | null) ?? d(row.submitted_at as string),
    notes: row.notes ? String(row.notes) : undefined,
    needsReview: row.needs_review !== false,
    reviewedAt: optDate(row.reviewed_at as string | null),
    createdAt: d(row.created_at as string),
    updatedAt: d(row.updated_at as string),
  };
}

function mapReport(row: Record<string, unknown>): Report {
  const wageRaw = row.wage_hour_intake;
  let wageHourIntake: Report['wageHourIntake'];
  if (wageRaw && typeof wageRaw === 'object' && !Array.isArray(wageRaw)) {
    const w = wageRaw as Record<string, unknown>;
    wageHourIntake = {
      ...(w as unknown as NonNullable<Report['wageHourIntake']>),
      submittedAt: w.submittedAt || w.submitted_at ? new Date(String(w.submittedAt ?? w.submitted_at)) : undefined,
    };
  }
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    referenceNumber: row.reference_number ? String(row.reference_number) : undefined,
    createdByUserId: row.created_by_user_id ? String(row.created_by_user_id) : undefined,
    assignedTo: row.assigned_to ? String(row.assigned_to) : undefined,
    category: row.category as Report['category'],
    severity: row.severity as Report['severity'],
    status: row.status as Report['status'],
    caseType: row.case_type as Report['caseType'],
    reportSourceType: row.report_source_type as Report['reportSourceType'],
    summary: String(row.summary ?? ''),
    description: String(row.description ?? ''),
    peopleInvolved: row.people_involved ? String(row.people_involved) : undefined,
    location: row.location ? String(row.location) : undefined,
    incidentAt: optDate(row.incident_at as string | null),
    isAnonymous: Boolean(row.is_anonymous),
    investigationId: row.investigation_id ? String(row.investigation_id) : undefined,
    sourcePromptId: row.source_prompt_id ? String(row.source_prompt_id) : undefined,
    sourcePromptResponseId: row.source_prompt_response_id
      ? String(row.source_prompt_response_id)
      : undefined,
    preferredContactMethod: row.preferred_contact_method as Report['preferredContactMethod'],
    needsExtendedIncidentIntake: Boolean(row.needs_extended_incident_intake),
    incidentIntakeCompletedAt: optDate(row.incident_intake_completed_at as string | null),
    needsExtendedWageHourIntake: Boolean(row.needs_extended_wage_hour_intake),
    wageHourIntakeCompletedAt: optDate(row.wage_hour_intake_completed_at as string | null),
    wageHourIntake,
    expeditedPayroll: Boolean(row.expedited_payroll),
    payrollSlaDueAt: optDate(row.payroll_sla_due_at as string | null),
    messages: [],
    handlingLedger: [],
    responseChecklist: [],
    createdAt: d(row.created_at as string),
    updatedAt: d(row.updated_at as string),
  };
}

function mapInvestigation(
  row: Record<string, unknown>,
  linkedReportIds: string[]
): Investigation {
  const createdAt = d(row.created_at as string);
  const lastUpdateAt = d(row.last_update_at as string ?? row.updated_at as string);
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    referenceNumber: row.reference_number ? String(row.reference_number) : undefined,
    status: row.status as Investigation['status'],
    ownerId: String(row.owner_id),
    category: row.category as Investigation['category'],
    severity: row.severity as Investigation['severity'],
    workflowPhase: row.workflow_phase as Investigation['workflowPhase'],
    stage: row.stage as Investigation['stage'],
    priority: row.priority as Investigation['priority'],
    linkedReportIds,
    linkedPromptId: row.linked_prompt_id ? String(row.linked_prompt_id) : undefined,
    linkedPromptResponseId: row.linked_prompt_response_id
      ? String(row.linked_prompt_response_id)
      : undefined,
    outcomeSummary: row.outcome_summary ? String(row.outcome_summary) : undefined,
    openedAt: d(row.opened_at as string),
    closedAt: optDate(row.closed_at as string | null),
    lastUpdateAt,
    createdAt,
    updatedAt: d(row.updated_at as string),
    notes: [],
    checklistStages: (row.checklist_stages as Investigation['checklistStages']) ?? [],
    workflowPagesCompleted: (row.workflow_pages_completed as Record<string, boolean>) ?? {},
  };
}

function mapLawDigest(raw: unknown): Policy['lawDigest'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const entriesRaw = Array.isArray(obj.entries) ? obj.entries : [];
  const entries = entriesRaw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const e = entry as Record<string, unknown>;
      if (!e.lawRecordId && !e.law_record_id) return null;
      return {
        lawRecordId: String(e.lawRecordId ?? e.law_record_id),
        title: String(e.title ?? ''),
        summary: String(e.summary ?? ''),
        citation: String(e.citation ?? ''),
        topic: String(e.topic ?? 'OTHER'),
        sourceUrl: e.sourceUrl || e.source_url ? String(e.sourceUrl ?? e.source_url) : undefined,
        updatedAt: e.updatedAt || e.updated_at ? String(e.updatedAt ?? e.updated_at) : undefined,
      };
    })
    .filter(Boolean) as NonNullable<Policy['lawDigest']>['entries'];
  if (!obj.stateCode && !obj.state_code) return undefined;
  return {
    stateCode: String(obj.stateCode ?? obj.state_code).toUpperCase(),
    stateName: String(obj.stateName ?? obj.state_name ?? obj.stateCode ?? obj.state_code),
    syncedAt: String(obj.syncedAt ?? obj.synced_at ?? new Date().toISOString()),
    entries,
  };
}

function mapPolicy(row: Record<string, unknown>): Policy {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    title: String(row.title),
    type: row.type as Policy['type'],
    content: String(row.content ?? ''),
    status: row.status as Policy['status'],
    acknowledgmentRequired: Boolean(row.acknowledgment_required),
    effectiveDate: d(row.effective_date as string),
    publishedAt: optDate(row.published_at as string | null),
    completionDueDate: optDate(row.completion_due_date as string | null),
    memoCategory: row.memo_category ? String(row.memo_category) : undefined,
    tags: (row.tags as string[]) ?? [],
    bodySource: row.body_source as Policy['bodySource'],
    bodyAttachmentFileName: row.body_attachment_file_name
      ? String(row.body_attachment_file_name)
      : undefined,
    bodySourceUrl: row.body_source_url ? String(row.body_source_url) : undefined,
    lawDigest: mapLawDigest(row.law_digest),
    createdAt: d(row.created_at as string),
    updatedAt: d(row.updated_at as string),
  };
}

function mapLawDigestEntries(raw: unknown): PolicyAcknowledgement['acknowledgedLawDigest'] {
  if (!Array.isArray(raw)) return undefined;
  const entries = raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const e = entry as Record<string, unknown>;
      if (!e.lawRecordId && !e.law_record_id) return null;
      return {
        lawRecordId: String(e.lawRecordId ?? e.law_record_id),
        title: String(e.title ?? ''),
        summary: String(e.summary ?? ''),
        citation: String(e.citation ?? ''),
        topic: String(e.topic ?? 'OTHER'),
        sourceUrl: e.sourceUrl || e.source_url ? String(e.sourceUrl ?? e.source_url) : undefined,
        updatedAt: e.updatedAt || e.updated_at ? String(e.updatedAt ?? e.updated_at) : undefined,
      };
    })
    .filter(Boolean) as NonNullable<PolicyAcknowledgement['acknowledgedLawDigest']>;
  return entries.length ? entries : undefined;
}

function mapPolicyAck(row: Record<string, unknown>): PolicyAcknowledgement {
  return {
    policyId: String(row.policy_id),
    userId: String(row.user_id),
    acknowledgedAt: d(row.acknowledged_at as string),
    outcome: row.outcome as PolicyAcknowledgement['outcome'],
    clarificationNote: row.clarification_note ? String(row.clarification_note) : undefined,
    acknowledgedLawDigest: mapLawDigestEntries(row.acknowledged_law_digest),
  };
}

function mapAnnouncement(row: Record<string, unknown>): Announcement {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    title: String(row.title),
    body: String(row.body ?? ''),
    audience: row.audience as Announcement['audience'],
    type: row.type as Announcement['type'],
    status: row.status as Announcement['status'],
    publishAt: optDate(row.publish_at as string | null),
    sentAt: optDate(row.sent_at as string | null),
    viewsCount: Number(row.views_count ?? 0),
    tags: (row.tags as string[]) ?? [],
    createdAt: d(row.created_at as string),
    updatedAt: d(row.updated_at as string),
  };
}

function mapNudge(row: Record<string, unknown>): Nudge {
  const context: Nudge['context'] = {
    type: row.context_type as Nudge['context']['type'],
  };
  if (row.context_prompt_id) context.promptId = String(row.context_prompt_id);
  if (row.context_policy_id) context.policyId = String(row.context_policy_id);
  if (row.context_report_id) context.reportId = String(row.context_report_id);
  if (row.context_related_label) context.relatedLabel = String(row.context_related_label);

  return {
    id: String(row.id),
    orgId: String(row.org_id),
    targetUserId: String(row.target_user_id),
    channel: row.channel as Nudge['channel'],
    message: String(row.message ?? ''),
    context,
    sentByAdminId: row.sent_by_admin_id ? String(row.sent_by_admin_id) : undefined,
    sentAt: d(row.sent_at as string),
    createdAt: d(row.created_at as string),
    updatedAt: d(row.updated_at as string),
  };
}

function mapActivity(row: Record<string, unknown>): ActivityEvent {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    type: row.event_type as ActivityEvent['type'],
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: d(row.created_at as string),
  };
}

function mapReportStatusEvent(row: Record<string, unknown>): ReportStatusEvent {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    reportId: String(row.report_id),
    fromStatus: row.from_status as ReportStatusEvent['fromStatus'],
    toStatus: row.to_status as ReportStatusEvent['toStatus'],
    changedBy: row.changed_by ? String(row.changed_by) : undefined,
    note: row.note ? String(row.note) : undefined,
    createdAt: d(row.created_at as string),
    updatedAt: d(row.updated_at as string),
  };
}

function mapAuditLog(row: Record<string, unknown>): AuditLogEntry {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    recordType: row.record_type as AuditLogEntry['recordType'],
    recordId: String(row.record_id),
    field: row.field ? String(row.field) : undefined,
    oldValue: row.old_value ? String(row.old_value) : undefined,
    newValue: row.new_value ? String(row.new_value) : undefined,
    actorUserId: String(row.actor_user_id),
    createdAt: d(row.created_at as string),
    reason: row.reason ? String(row.reason) : undefined,
  };
}

function mapCompanyResource(row: Record<string, unknown>): CompanyResource {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    title: String(row.title),
    description: row.description ? String(row.description) : undefined,
    category: row.category as CompanyResource['category'],
    url: row.url ? String(row.url) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    status: row.status as CompanyResource['status'],
    sortOrder: row.sort_order != null ? Number(row.sort_order) : undefined,
    publishedAt: optDate(row.published_at as string | null),
    createdAt: d(row.created_at as string),
    updatedAt: d(row.updated_at as string),
  };
}

function mapHotline(row: Record<string, unknown>): EmergencyHotline {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    name: String(row.name),
    phone: String(row.phone),
    description: row.description ? String(row.description) : undefined,
    status: row.status as EmergencyHotline['status'],
    sortOrder: row.sort_order != null ? Number(row.sort_order) : undefined,
  };
}

function mapAppNotification(row: Record<string, unknown>): AppNotification {
  const params = row.action_params;
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    userId: String(row.user_id),
    kind: row.kind as AppNotification['kind'],
    title: String(row.title ?? ''),
    body: String(row.body ?? ''),
    actionPage: row.action_page ? String(row.action_page) : undefined,
    actionParams:
      params && typeof params === 'object' && !Array.isArray(params)
        ? Object.fromEntries(
            Object.entries(params as Record<string, unknown>).map(([k, v]) => [k, String(v)])
          )
        : undefined,
    relatedEmail: row.related_email ? String(row.related_email) : undefined,
    emailStatus: row.email_status ? String(row.email_status) : undefined,
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : undefined,
    readAt: optDate(row.read_at as string | null),
    createdAt: d(row.created_at as string),
  };
}

export type OrgDataSnapshot = {
  organizationName: string;
  orgSettings: Organization['settings'];
  departments: Department[];
  users: User[];
  reports: Report[];
  prompts: Prompt[];
  deliveries: PromptDelivery[];
  responses: PromptResponse[];
  investigations: Investigation[];
  policies: Policy[];
  policyAcknowledgements: PolicyAcknowledgement[];
  announcements: Announcement[];
  nudges: Nudge[];
  activities: ActivityEvent[];
  reportStatusEvents: ReportStatusEvent[];
  auditLogs: AuditLogEntry[];
  companyResources: CompanyResource[];
  emergencyHotlines: EmergencyHotline[];
  appNotifications: AppNotification[];
};

export async function loadOrgDataFromSupabase(orgId: string): Promise<OrgDataSnapshot> {
  const supabase = getSupabaseClient();

  const { data: orgRow, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name, settings')
    .eq('id', orgId)
    .maybeSingle();

  if (orgErr) throw new Error(orgErr.message);

  const rawSettings = orgRow?.settings as Organization['settings'] | null;
  const orgSettings = rawSettings
    ? {
        ...DEFAULT_ORG_SETTINGS,
        ...rawSettings,
        thresholds: { ...DEFAULT_ORG_SETTINGS.thresholds, ...rawSettings.thresholds },
        customRoles: rawSettings.customRoles ?? [],
      }
    : DEFAULT_ORG_SETTINGS;
  const organizationName = orgRow?.name ?? 'Organization';

  const q = (table: string) => supabase.from(table).select('*').eq('org_id', orgId);

  const [
    deptRes,
    usersRes,
    reportsRes,
    promptsRes,
    deliveriesRes,
    responsesRes,
    invRes,
    invLinksRes,
    policiesRes,
    acksRes,
    announcementsRes,
    nudgesRes,
    activitiesRes,
    statusEventsRes,
    auditRes,
    resourcesRes,
    hotlinesRes,
    notificationsRes,
  ] = await Promise.all([
    q('departments'),
    q('users'),
    q('reports'),
    q('prompts'),
    q('prompt_deliveries'),
    q('prompt_responses'),
    q('investigations'),
    supabase.from('investigation_linked_reports').select('investigation_id, report_id'),
    q('policies'),
    supabase.from('policy_acknowledgements').select('*'),
    q('announcements'),
    q('nudges'),
    q('activity_events'),
    q('report_status_events'),
    q('audit_logs'),
    q('company_resources'),
    q('emergency_hotlines'),
    q('app_notifications'),
  ]);

  const errors = [
    deptRes.error,
    usersRes.error,
    reportsRes.error,
    promptsRes.error,
    deliveriesRes.error,
    responsesRes.error,
    invRes.error,
    invLinksRes.error,
    policiesRes.error,
    acksRes.error,
    announcementsRes.error,
    nudgesRes.error,
    activitiesRes.error,
    statusEventsRes.error,
    auditRes.error,
    resourcesRes.error,
    hotlinesRes.error,
  ].filter(Boolean);

  if (errors.length) {
    throw new Error(errors[0]!.message);
  }

  // Notifications table may not exist until migration 21 is applied — don't fail hydrate.
  const appNotifications = notificationsRes.error
    ? []
    : (notificationsRes.data ?? []).map((r) => mapAppNotification(r as Record<string, unknown>));

  const policyIds = new Set((policiesRes.data ?? []).map((p) => p.id));
  const linkedByInv = new Map<string, string[]>();
  for (const link of invLinksRes.data ?? []) {
    const invId = String(link.investigation_id);
    const list = linkedByInv.get(invId) ?? [];
    list.push(String(link.report_id));
    linkedByInv.set(invId, list);
  }

  return {
    organizationName,
    orgSettings,
    departments: (deptRes.data ?? []).map((r) => mapDepartment(r as Record<string, unknown>)),
    users: (usersRes.data ?? []).map((r) => mapUser(r as Record<string, unknown>)),
    reports: (reportsRes.data ?? []).map((r) => mapReport(r as Record<string, unknown>)),
    prompts: (promptsRes.data ?? []).map((r) => mapPrompt(r as Record<string, unknown>)),
    deliveries: (deliveriesRes.data ?? []).map((r) => mapDelivery(r as Record<string, unknown>)),
    responses: (responsesRes.data ?? []).map((r) => mapResponse(r as Record<string, unknown>)),
    investigations: (invRes.data ?? []).map((r) =>
      mapInvestigation(r as Record<string, unknown>, linkedByInv.get(String(r.id)) ?? [])
    ),
    policies: (policiesRes.data ?? []).map((r) => mapPolicy(r as Record<string, unknown>)),
    policyAcknowledgements: (acksRes.data ?? [])
      .filter((a) => policyIds.has(a.policy_id))
      .map((r) => mapPolicyAck(r as Record<string, unknown>)),
    announcements: (announcementsRes.data ?? []).map((r) => mapAnnouncement(r as Record<string, unknown>)),
    nudges: (nudgesRes.data ?? []).map((r) => mapNudge(r as Record<string, unknown>)),
    activities: (activitiesRes.data ?? []).map((r) => mapActivity(r as Record<string, unknown>)),
    reportStatusEvents: (statusEventsRes.data ?? []).map((r) =>
      mapReportStatusEvent(r as Record<string, unknown>)
    ),
    auditLogs: (auditRes.data ?? []).map((r) => mapAuditLog(r as Record<string, unknown>)),
    companyResources: (resourcesRes.data ?? []).map((r) => mapCompanyResource(r as Record<string, unknown>)),
    emergencyHotlines: (hotlinesRes.data ?? []).map((r) => mapHotline(r as Record<string, unknown>)),
    appNotifications,
  };
}

export async function findAppUserByEmail(email: string): Promise<User | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  if (error || !data) return null;
  return mapUser(data as Record<string, unknown>);
}
