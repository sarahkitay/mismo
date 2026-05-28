import type {
  Investigation,
  InvestigationChecklistStage,
  InvestigationPerson,
  InvestigationPersonRole,
  InvestigationStage,
  InvestigationStageEvent,
  OutcomeClassification,
  Prompt,
  PromptResponse,
  Report,
  ReportSourceType,
  User,
} from '@/types';

export const INVESTIGATION_STAGES: InvestigationStage[] = [
  'INTAKE_RECEIVED',
  'PENDING_REVIEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'EMPLOYEE_FOLLOW_UP',
  'EVIDENCE_REVIEW',
  'FINDINGS_DRAFTED',
  'OUTCOME_PENDING',
  'CLOSED',
];

export const INVESTIGATION_STAGE_LABELS: Record<InvestigationStage, string> = {
  INTAKE_RECEIVED: 'Intake Received',
  PENDING_REVIEW: 'Pending Review',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  EMPLOYEE_FOLLOW_UP: 'Employee Follow-Up',
  EVIDENCE_REVIEW: 'Evidence Review',
  FINDINGS_DRAFTED: 'Findings Drafted',
  OUTCOME_PENDING: 'Outcome Pending',
  CLOSED: 'Closed',
};

export const PERSON_ROLE_LABELS: Record<InvestigationPersonRole, string> = {
  REPORTING_PARTY: 'Reporting party',
  REPORTED_AGAINST: 'Reported against',
  WITNESS: 'Witness',
  HR_REPRESENTATIVE: 'HR representative',
  INVESTIGATOR: 'Investigator',
  EXTERNAL_PARTY: 'External party',
};

export const REPORT_SOURCE_LABELS: Record<ReportSourceType, string> = {
  SELF_REPORTED: 'Self reported',
  EMPLOYEE_PROMPT_RESPONSE: 'Employee prompt response',
  OSHA_PROMPT: 'OSHA prompt',
  WAGE_HOUR_PROMPT: 'Wage & hour prompt',
  ANONYMOUS_HOTLINE: 'Anonymous hotline',
  HR_SUBMITTED: 'HR submitted',
  SUPERVISOR_SUBMITTED: 'Supervisor submitted',
  COMPLIANCE_AUDIT: 'Compliance audit',
  SYSTEM_TRIGGERED: 'System triggered',
};

export const OUTCOME_CLASSIFICATION_LABELS: Record<OutcomeClassification, string> = {
  SUBSTANTIATED: 'Substantiated',
  PARTIALLY_SUBSTANTIATED: 'Partially substantiated',
  UNSUBSTANTIATED: 'Unsubstantiated',
  INCONCLUSIVE: 'Inconclusive / insufficient evidence',
  POLICY_VIOLATION_CONFIRMED: 'Policy violation confirmed',
  CONDUCT_CONCERN: 'Conduct concern (no policy violation)',
  COACHING_ISSUED: 'Coaching issued',
  TERMINATION: 'Termination',
  WARNING_ISSUED: 'Warning issued',
  TRAINING_ASSIGNED: 'Training assigned',
  RESOLVED_INFORMALLY: 'Resolved informally',
};

export const CONTACT_METHOD_LABELS: Record<string, string> = {
  IN_APP_MESSAGE: 'Direct message',
  PHONE_CALL: 'Phone call',
  EMAIL: 'Email',
  IN_PERSON: 'In person',
};

/** Simplified 3-page investigation workflow */
export type InvestigationTab = 'page-1' | 'page-2' | 'page-3';

export const INVESTIGATION_PAGES: { id: InvestigationTab; label: string; step: number; description: string }[] = [
  {
    id: 'page-1',
    step: 1,
    label: 'Intake & assignment',
    description: 'Automatic report data, case ID, admin assignment, employee form status, and initial contact.',
  },
  {
    id: 'page-2',
    step: 2,
    label: 'Gather information',
    description: 'Persons involved, witnesses, interviews, evidence, policies, and legal involvement.',
  },
  {
    id: 'page-3',
    step: 3,
    label: 'Outcome & close',
    description: 'Final findings, resolution, employee outcome letter, and export.',
  },
];

/** @deprecated Use INVESTIGATION_PAGES */
export const INVESTIGATION_TABS = INVESTIGATION_PAGES.map((p) => ({
  id: p.id,
  label: p.label,
  step: p.step,
}));

const LEGACY_TAB_MAP: Record<string, InvestigationTab> = {
  overview: 'page-1',
  intake: 'page-1',
  'intake-triage': 'page-1',
  'information-gathering': 'page-2',
  'interviews-notes': 'page-2',
  'evidence-analysis': 'page-2',
  persons: 'page-2',
  'linked-reports': 'page-1',
  'findings-outcome': 'page-3',
  'resolution-actions': 'page-3',
  'follow-up-monitoring': 'page-3',
  'closure-audit': 'page-3',
  communications: 'page-2',
  evidence: 'page-2',
  notes: 'page-2',
  findings: 'page-3',
  resolution: 'page-3',
  audit: 'page-3',
};

export function parseInvestigationTab(raw?: string): InvestigationTab {
  if (!raw) return 'page-1';
  if (LEGACY_TAB_MAP[raw]) return LEGACY_TAB_MAP[raw];
  if (raw === 'page-1' || raw === 'page-2' || raw === 'page-3') return raw;
  return 'page-1';
}

export const EVIDENCE_GATHERING_PROMPTS = [
  { id: 'screenshots', label: 'Upload screenshots related to the incident', type: 'SCREENSHOT' as const },
  { id: 'communications', label: 'Upload relevant communications (email, chat, messages)', type: 'EMAIL' as const },
  { id: 'disciplinary', label: 'Upload disciplinary or performance history', type: 'DOCUMENT' as const },
  { id: 'policy-ack', label: 'Upload policy acknowledgements', type: 'PDF' as const },
  { id: 'statements', label: 'Upload written statements', type: 'WRITTEN_STATEMENT' as const },
  { id: 'logs', label: 'Upload system logs or access records', type: 'DOCUMENT' as const },
];

export interface CompletenessCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export function formatReportReference(reportOrId: string | Pick<Report, 'id' | 'referenceNumber' | 'caseType'>): string {
  if (typeof reportOrId === 'string') {
    const num = reportOrId.replace(/^report-/, '').toUpperCase();
    return num.startsWith('CAS-') || num.startsWith('WH-') || num.startsWith('IR-')
      ? num.replace(/^IR-/, 'CAS-')
      : `CAS-${num}`;
  }
  if (reportOrId.referenceNumber) return reportOrId.referenceNumber;
  const num = reportOrId.id.replace(/^report-/, '').toUpperCase();
  const prefix = reportOrId.caseType === 'WAGE_HOUR' ? 'WH' : 'CAS';
  return `${prefix}-${num}`;
}

export function getInvestigationDisplayId(inv: Investigation, primaryReport?: Report): string {
  return inv.referenceNumber ?? primaryReport?.referenceNumber ?? inv.id.toUpperCase();
}

export function getInvestigationTypeLabel(inv: Investigation): string {
  if (inv.investigationType) return inv.investigationType;
  const cat = inv.category ?? 'OTHER';
  const map: Partial<Record<Report['category'], string>> = {
    HARASSMENT: 'Harassment Investigation',
    SAFETY: 'Safety Investigation',
    WAGE_HOURS: 'Wage & Hour Investigation',
    DISCRIMINATION: 'Discrimination Investigation',
    THEFT: 'Theft Investigation',
    OTHER: 'Workplace Investigation',
  };
  return map[cat] ?? 'Workplace Investigation';
}

export function inferReportSourceType(report: Report, prompt?: Prompt): ReportSourceType {
  if (report.reportSourceType) return report.reportSourceType;
  if (report.isAnonymous) return 'ANONYMOUS_HOTLINE';
  if (report.sourcePromptId && prompt?.type === 'INCIDENT') return 'EMPLOYEE_PROMPT_RESPONSE';
  if (report.sourcePromptId && prompt?.includeFinancialQuestion) return 'WAGE_HOUR_PROMPT';
  if (report.sourcePromptId) return 'EMPLOYEE_PROMPT_RESPONSE';
  if (report.createdByUserId) return 'SELF_REPORTED';
  return 'HR_SUBMITTED';
}

export function getEffectiveStage(inv: Investigation): InvestigationStage {
  if (inv.status === 'CLOSED') return 'CLOSED';
  if (inv.stage) return inv.stage;
  if (inv.workflowPhase === 'AWAITING_OUTCOME_ACK') return 'OUTCOME_PENDING';
  if (inv.workflowPhase === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (inv.ownerId) return 'ASSIGNED';
  return 'PENDING_REVIEW';
}

export function getStageIndex(stage: InvestigationStage): number {
  return INVESTIGATION_STAGES.indexOf(stage);
}

export function getStageProgressPercent(inv: Investigation): number {
  const idx = getStageIndex(getEffectiveStage(inv));
  if (idx <= 0) return 0;
  return Math.round((idx / (INVESTIGATION_STAGES.length - 1)) * 100);
}

/** @deprecated Use workflow modules instead */
export function buildDefaultChecklistStages(): InvestigationChecklistStage[] {
  return [];
}

export function getChecklistStages(inv: Investigation): InvestigationChecklistStage[] {
  return inv.checklistStages?.length ? inv.checklistStages : [];
}

export function getChecklistCompletionPercent(stages: InvestigationChecklistStage[]): number {
  const items = stages.flatMap((s) => s.items);
  if (!items.length) return 0;
  const done = items.filter((i) => i.status === 'COMPLETE' || i.status === 'NA').length;
  return Math.round((done / items.length) * 100);
}

export function getInvestigationPersons(inv: Investigation, owner?: User): InvestigationPerson[] {
  if (inv.persons?.length) return inv.persons;
  const persons: InvestigationPerson[] = [];
  const now = inv.openedAt;
  inv.subjectUserIds?.forEach((userId) => {
    persons.push({ id: `legacy-subject-${userId}`, role: 'REPORTED_AGAINST', userId, addedAt: now });
  });
  inv.witnessUserIds?.forEach((userId) => {
    persons.push({ id: `legacy-witness-${userId}`, role: 'WITNESS', userId, addedAt: now });
  });
  inv.witnessExternal?.forEach((name) => {
    persons.push({ id: `legacy-ext-${name.slice(0, 12)}`, role: 'EXTERNAL_PARTY', externalName: name, addedAt: now });
  });
  if (owner) {
    persons.push({ id: `legacy-investigator-${owner.id}`, role: 'INVESTIGATOR', userId: owner.id, addedAt: inv.pickedUpAt ?? now });
  }
  return persons;
}

export function buildStageHistoryEntry(
  stage: InvestigationStage,
  actorUserId: string,
  ownerId?: string,
  note?: string
): InvestigationStageEvent {
  return { stage, enteredAt: new Date(), enteredByUserId: actorUserId, ownerId, note };
}

export function getNextStageAction(stage: InvestigationStage): string {
  const actions: Partial<Record<InvestigationStage, string>> = {
    INTAKE_RECEIVED: 'Review intake, classify allegation, and assign lead investigator.',
    PENDING_REVIEW: 'Complete triage and assign case owner.',
    ASSIGNED: 'Open case and begin information gathering.',
    IN_PROGRESS: 'Collect evidence, conduct interviews, and document findings.',
    EMPLOYEE_FOLLOW_UP: 'Track party responses and follow-up communications.',
    EVIDENCE_REVIEW: 'Complete policy analysis and pre-submission review.',
    FINDINGS_DRAFTED: 'Determine outcome and corrective actions.',
    OUTCOME_PENDING: 'Await acknowledgment and schedule follow-up monitoring.',
    CLOSED: 'Case closed. Export audit packet and retain records.',
  };
  return actions[stage] ?? 'Continue investigation workflow.';
}

export function getLinkedPromptContext(
  inv: Investigation,
  report: Report | undefined,
  prompts: Prompt[],
  responses: PromptResponse[]
): { prompt?: Prompt; response?: PromptResponse } {
  const promptId = inv.linkedPromptId ?? report?.sourcePromptId;
  const responseId = inv.linkedPromptResponseId ?? report?.sourcePromptResponseId;
  const prompt = promptId ? prompts.find((p) => p.id === promptId) : undefined;
  const response = responseId ? responses.find((r) => r.id === responseId) : undefined;
  return { prompt, response };
}

export function getInvestigationAgeDays(openedAt: Date): number {
  return Math.max(0, Math.floor((Date.now() - openedAt.getTime()) / (1000 * 60 * 60 * 24)));
}

export function getSlaStatus(ageDays: number, priority?: string): { label: string; tone: 'ok' | 'warn' | 'over' } {
  const limit = priority === 'CRITICAL' ? 7 : priority === 'HIGH' ? 14 : 30;
  if (ageDays > limit) return { label: 'Over SLA', tone: 'over' };
  if (ageDays > limit * 0.75) return { label: 'Approaching SLA', tone: 'warn' };
  return { label: 'Within SLA', tone: 'ok' };
}

export function getAllInvestigationEvidence(inv: Investigation) {
  const fromRecords = inv.evidenceRecords ?? [];
  const fromNotes = (inv.notes ?? []).flatMap((n) =>
    (n.attachments ?? []).map((a) => ({
      id: a.id,
      type: 'DOCUMENT' as const,
      fileName: a.fileName,
      mimeType: a.mimeType,
      dataUrl: a.dataUrl,
      sourceType: 'SYSTEM' as const,
      uploadedAt: n.createdAt,
      uploadedByUserId: n.createdByUserId,
      preserved: true,
      promptLabel: 'From investigation note',
    }))
  );
  return [...fromRecords, ...fromNotes];
}

export function getCompletenessReview(inv: Investigation): { checks: CompletenessCheck[]; ready: boolean } {
  const persons = getInvestigationPersons(inv);
  const evidence = getAllInvestigationEvidence(inv);
  const requests = inv.responseRequests ?? [];
  const pendingRequests = requests.filter((r) => !['SUBMITTED', 'DECLINED'].includes(r.status));
  const interviewNotes = (inv.notes ?? []).filter((n) => n.noteType === 'INTERVIEW' || n.visibility === 'INTERNAL');
  const hasReportingParty = persons.some((p) => p.role === 'REPORTING_PARTY');
  const preservedCount = evidence.filter((e) => e.preserved).length;

  const checks: CompletenessCheck[] = [
    {
      id: 'intake',
      label: 'Intake reviewed & investigator assigned',
      pass: Boolean(inv.ownerId && inv.pickedUpAt),
      detail: inv.ownerId ? 'Case owner assigned' : 'Assign lead investigator',
    },
    {
      id: 'persons',
      label: 'Key parties identified',
      pass: hasReportingParty && persons.length >= 2,
      detail: `${persons.length} persons on file`,
    },
    {
      id: 'evidence',
      label: 'Evidence collected & preserved',
      pass: evidence.length >= 1 && preservedCount >= 1,
      detail: `${evidence.length} file(s), ${preservedCount} preserved`,
    },
    {
      id: 'interviews',
      label: 'Interviews / statements documented',
      pass: interviewNotes.length >= 1 || requests.some((r) => r.status === 'SUBMITTED'),
      detail: `${interviewNotes.length} interview notes, ${requests.filter((r) => r.status === 'SUBMITTED').length} responses received`,
    },
    {
      id: 'requests',
      label: 'No pending response requests',
      pass: pendingRequests.length === 0,
      detail: pendingRequests.length ? `${pendingRequests.length} request(s) outstanding` : 'All requests resolved',
    },
    {
      id: 'findings',
      label: 'Findings rationale documented',
      pass: Boolean(inv.findingsRationale?.trim()),
      detail: inv.findingsRationale?.trim() ? 'Rationale on file' : 'Document findings rationale before submission',
    },
    {
      id: 'outcome',
      label: 'Outcome determination selected',
      pass: Boolean(inv.outcomeClassification),
      detail: inv.outcomeClassification ? OUTCOME_CLASSIFICATION_LABELS[inv.outcomeClassification] : 'Select outcome classification',
    },
  ];

  return { checks, ready: checks.every((c) => c.pass) };
}

export function getModuleProgress(inv: Investigation): Record<string, { percent: number; status: 'not_started' | 'in_progress' | 'complete' }> {
  const evidence = getAllInvestigationEvidence(inv);
  const requests = inv.responseRequests ?? [];
  const notes = inv.notes ?? [];
  const actions = inv.correctiveActions ?? [];
  const followUps = inv.followUps ?? [];

  return {
    'intake-triage': {
      percent: inv.ownerId && inv.pickedUpAt ? 100 : inv.ownerId ? 50 : 0,
      status: inv.pickedUpAt ? 'complete' : inv.ownerId ? 'in_progress' : 'not_started',
    },
    'information-gathering': {
      percent: Math.min(100, evidence.length * 25),
      status: evidence.length >= 2 ? 'complete' : evidence.length ? 'in_progress' : 'not_started',
    },
    'interviews-notes': {
      percent: Math.min(100, (notes.filter((n) => n.noteType === 'INTERVIEW').length + requests.filter((r) => r.status === 'SUBMITTED').length) * 33),
      status: notes.length || requests.length ? 'in_progress' : 'not_started',
    },
    'evidence-analysis': {
      percent: inv.findingsRationale?.trim() && inv.policyAnalysisNotes?.trim() ? 100 : inv.findingsRationale?.trim() ? 50 : 0,
      status: inv.findingsRationale?.trim() ? 'in_progress' : 'not_started',
    },
    'findings-outcome': {
      percent: inv.outcomeClassification ? (inv.finalFindingsReport?.trim() ? 100 : 50) : 0,
      status: inv.outcomeClassification ? 'in_progress' : 'not_started',
    },
    'resolution-actions': {
      percent: actions.length ? (actions.every((a) => a.status === 'COMPLETE') ? 100 : 50) : 0,
      status: actions.length ? 'in_progress' : 'not_started',
    },
    'follow-up-monitoring': {
      percent: followUps.length ? (followUps.every((f) => f.status === 'COMPLETE') ? 100 : 50) : 0,
      status: followUps.length ? 'in_progress' : 'not_started',
    },
    'closure-audit': {
      percent: inv.status === 'CLOSED' ? 100 : inv.outcomeSentAt ? 50 : 0,
      status: inv.status === 'CLOSED' ? 'complete' : 'not_started',
    },
    'page-1': {
      percent: inv.workflowPagesCompleted?.intake ? 100 : inv.ownerId && inv.pickedUpAt ? 75 : inv.ownerId ? 40 : 10,
      status: inv.workflowPagesCompleted?.intake ? 'complete' : inv.ownerId ? 'in_progress' : 'not_started',
    },
    'page-2': {
      percent: inv.workflowPagesCompleted?.gathering
        ? 100
        : Math.min(90, evidence.length * 20 + (inv.persons?.length ?? 0) * 15),
      status: inv.workflowPagesCompleted?.gathering ? 'complete' : evidence.length ? 'in_progress' : 'not_started',
    },
    'page-3': {
      percent: inv.workflowPagesCompleted?.outcome ? 100 : inv.outcomeSentAt ? 75 : inv.outcomeClassification ? 40 : 0,
      status: inv.workflowPagesCompleted?.outcome ? 'complete' : inv.outcomeSentAt ? 'in_progress' : 'not_started',
    },
  };
}
