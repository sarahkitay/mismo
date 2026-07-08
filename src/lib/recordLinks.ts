import type { DataStore } from '@/hooks/useDataStore';
import type { Investigation, PromptDelivery, PromptResponse, Report, User } from '@/types';
import { formatCaseReference } from '@/lib/caseTypes';
import { getInvestigationDisplayId } from '@/lib/investigationWorkflow';

export type RecordNavTarget = {
  page: string;
  params?: Record<string, string>;
  label: string;
  sublabel?: string;
  kind: 'employee' | 'case' | 'investigation' | 'query' | 'prompt' | 'register';
};

export function answerLabel(answer: string): string {
  if (answer === 'HAS_ISSUE') return 'Yes';
  if (answer === 'NO_ISSUE') return 'No';
  return 'Unanswered';
}

export function linkedReportForPromptRow(
  row: { id: string; answer: string; userId?: string },
  reports: Report[]
): Report | undefined {
  if (row.answer === 'UNANSWERED') return undefined;
  return (
    reports.find((r) => r.sourcePromptResponseId === row.id) ??
    reports.find((r) => r.createdByUserId === row.userId && r.reportSourceType === 'EMPLOYEE_PROMPT_RESPONSE')
  );
}

export function promptResponseForReport(report: Report, responses: PromptResponse[]): PromptResponse | undefined {
  if (!report.sourcePromptResponseId) return undefined;
  return responses.find((r) => r.id === report.sourcePromptResponseId);
}

export function findReportForPromptResponse(responseId: string, reports: Report[]): Report | undefined {
  return reports.find((r) => r.sourcePromptResponseId === responseId);
}

export function findReportForDelivery(
  delivery: PromptDelivery,
  reports: Report[],
  responses: PromptResponse[]
): Report | undefined {
  const response = responses.find((r) => r.promptDeliveryId === delivery.id);
  if (response) return findReportForPromptResponse(response.id, reports);
  return reports.find(
    (r) =>
      r.createdByUserId === delivery.userId &&
      r.reportSourceType === 'EMPLOYEE_PROMPT_RESPONSE' &&
      r.sourcePromptId === delivery.promptId
  );
}

export function findInvestigationForReport(
  report: Report,
  investigations: Investigation[]
): Investigation | undefined {
  if (report.investigationId) {
    return investigations.find((i) => i.id === report.investigationId);
  }
  return investigations.find((i) => i.linkedReportIds.includes(report.id));
}

export function findInvestigationForPromptResponse(
  responseId: string,
  reports: Report[],
  investigations: Investigation[]
): Investigation | undefined {
  const report = findReportForPromptResponse(responseId, reports);
  if (report) return findInvestigationForReport(report, investigations);
  return investigations.find((i) => i.linkedPromptResponseId === responseId);
}

export function findInvestigationForDelivery(
  delivery: PromptDelivery,
  reports: Report[],
  responses: PromptResponse[],
  investigations: Investigation[]
): Investigation | undefined {
  const report = findReportForDelivery(delivery, reports, responses);
  if (report) return findInvestigationForReport(report, investigations);
  return undefined;
}

export function userDisplayName(user: User | undefined): string {
  if (!user) return 'Unknown';
  return `${user.firstName} ${user.lastName}`;
}

export function buildEmployeeNav(user: User | undefined, userId?: string): RecordNavTarget | undefined {
  const id = user?.id ?? userId;
  if (!id) return undefined;
  return {
    kind: 'employee',
    page: 'employee-detail',
    params: { id },
    label: user ? userDisplayName(user) : 'Employee profile',
    sublabel: 'View full employee record',
  };
}

export function buildCaseNav(report: Report | undefined): RecordNavTarget | undefined {
  if (!report) return undefined;
  return {
    kind: 'case',
    page: 'report-detail',
    params: { id: report.id },
    label: formatCaseReference(report),
    sublabel: report.summary.slice(0, 72),
  };
}

export function buildInvestigationNav(inv: Investigation | undefined): RecordNavTarget | undefined {
  if (!inv) return undefined;
  return {
    kind: 'investigation',
    page: 'investigation-detail',
    params: { id: inv.id, tab: 'page-1' },
    label: getInvestigationDisplayId(inv),
    sublabel: inv.status === 'OPEN' ? 'Open investigation' : 'Closed investigation',
  };
}

export function buildPromptResponseNav(
  response: PromptResponse | undefined,
  promptTitle?: string
): RecordNavTarget | undefined {
  if (!response) return undefined;
  return {
    kind: 'query',
    page: 'prompt-response-detail',
    params: { id: response.id, type: response.answer },
    label: promptTitle ?? 'Check-in response',
    sublabel: response.answer === 'HAS_ISSUE' ? 'Yes' : 'No',
  };
}

export function buildDeliveryNav(delivery: PromptDelivery, promptTitle?: string): RecordNavTarget | undefined {
  return {
    kind: 'query',
    page: 'prompt-response-detail',
    params: { id: delivery.id },
    label: promptTitle ?? 'Pending check-in',
    sublabel: 'Unanswered',
  };
}

/** All related records for a prompt response (check-in query). */
export function relatedNavForPromptResponse(
  dataStore: DataStore,
  response: PromptResponse
): RecordNavTarget[] {
  const { users, reports, investigations, prompts } = dataStore;
  const prompt = prompts.find((p) => p.id === response.promptId);
  const employee = users.find((u) => u.id === response.userId);
  const linkedCase = findReportForPromptResponse(response.id, reports);
  const linkedInv = findInvestigationForPromptResponse(response.id, reports, investigations);
  const delivery = dataStore.deliveries.find((d) => d.id === response.promptDeliveryId);

  const links: RecordNavTarget[] = [];
  const emp = buildEmployeeNav(employee, response.userId);
  if (emp) links.push(emp);
  const query = buildPromptResponseNav(response, prompt?.title);
  if (query) links.push(query);
  if (delivery) {
    links.push({
      kind: 'query',
      page: 'prompt-responses',
      params: { view: 'prompts', channel: 'incident' },
      label: 'Check-in register',
      sublabel: 'All prompt responses',
    });
  }
  const caseLink = buildCaseNav(linkedCase);
  if (caseLink) links.push(caseLink);
  const invLink = buildInvestigationNav(linkedInv);
  if (invLink) links.push(invLink);
  return links;
}

/** All related records for an unanswered delivery. */
export function relatedNavForDelivery(dataStore: DataStore, delivery: PromptDelivery): RecordNavTarget[] {
  const { users, prompts, reports, responses, investigations } = dataStore;
  const prompt = prompts.find((p) => p.id === delivery.promptId);
  const employee = users.find((u) => u.id === delivery.userId);
  const linkedCase = findReportForDelivery(delivery, reports, responses);
  const linkedInv = findInvestigationForDelivery(delivery, reports, responses, investigations);

  const links: RecordNavTarget[] = [];
  const emp = buildEmployeeNav(employee, delivery.userId);
  if (emp) links.push(emp);
  links.push(buildDeliveryNav(delivery, prompt?.title)!);
  const caseLink = buildCaseNav(linkedCase);
  if (caseLink) links.push(caseLink);
  const invLink = buildInvestigationNav(linkedInv);
  if (invLink) links.push(invLink);
  return links;
}

/** All related records for a case / report. */
export function relatedNavForReport(
  dataStore: DataStore,
  report: Report,
  fromInvestigationId?: string
): RecordNavTarget[] {
  const { users, investigations, prompts, responses } = dataStore;
  const reporter = report.createdByUserId ? users.find((u) => u.id === report.createdByUserId) : undefined;
  const assignee = report.assignedTo ? users.find((u) => u.id === report.assignedTo) : undefined;
  const linkedInv =
    (fromInvestigationId ? investigations.find((i) => i.id === fromInvestigationId) : undefined) ??
    findInvestigationForReport(report, investigations);
  const sourceResponse = report.sourcePromptResponseId
    ? responses.find((r) => r.id === report.sourcePromptResponseId)
    : undefined;
  const sourcePrompt = report.sourcePromptId ? prompts.find((p) => p.id === report.sourcePromptId) : undefined;

  const links: RecordNavTarget[] = [];
  links.push({
    kind: 'register',
    page: 'prompt-responses',
    params: { view: 'register', register: '1', channel: 'register' },
    label: 'Case register',
    sublabel: 'All open cases',
  });
  const caseLink = buildCaseNav(report);
  if (caseLink) links.push(caseLink);
  if (!report.isAnonymous && reporter) {
    const emp = buildEmployeeNav(reporter);
    if (emp) links.push({ ...emp, sublabel: 'Reporting employee' });
  }
  if (assignee && assignee.id !== reporter?.id) {
    links.push({ ...buildEmployeeNav(assignee)!, sublabel: 'Assigned owner' });
  }
  if (sourceResponse) {
    links.push(buildPromptResponseNav(sourceResponse, sourcePrompt?.title)!);
  } else if (sourcePrompt) {
    links.push({
      kind: 'prompt',
      page: 'prompts',
      params: {},
      label: sourcePrompt.title,
      sublabel: 'Prompt definition',
    });
  }
  const invLink = buildInvestigationNav(linkedInv);
  if (invLink) links.push(invLink);
  return links;
}

/** Related records for an investigation. */
export function relatedNavForInvestigation(dataStore: DataStore, inv: Investigation): RecordNavTarget[] {
  const { reports, users, prompts, responses } = dataStore;
  const primaryReport = inv.linkedReportIds[0]
    ? reports.find((r) => r.id === inv.linkedReportIds[0])
    : undefined;
  const promptId = inv.linkedPromptId ?? primaryReport?.sourcePromptId;
  const responseId = inv.linkedPromptResponseId ?? primaryReport?.sourcePromptResponseId;
  const prompt = promptId ? prompts.find((p) => p.id === promptId) : undefined;
  const response = responseId ? responses.find((r) => r.id === responseId) : undefined;
  const reporter = primaryReport?.createdByUserId
    ? users.find((u) => u.id === primaryReport.createdByUserId)
    : undefined;

  const links: RecordNavTarget[] = [];
  links.push(buildInvestigationNav(inv)!);
  inv.linkedReportIds.forEach((rid) => {
    const r = reports.find((x) => x.id === rid);
    const nav = buildCaseNav(r);
    if (nav) links.push(nav);
  });
  if (response) links.push(buildPromptResponseNav(response, prompt?.title)!);
  if (reporter && !primaryReport?.isAnonymous) {
    links.push({ ...buildEmployeeNav(reporter)!, sublabel: 'Reporting employee' });
  }
  inv.subjectUserIds?.forEach((uid) => {
    const u = users.find((x) => x.id === uid);
    if (u && u.id !== reporter?.id) {
      links.push({ ...buildEmployeeNav(u)!, sublabel: 'Subject' });
    }
  });
  links.push({
    kind: 'register',
    page: 'prompt-responses',
    params: { view: 'prompts', channel: 'incident' },
    label: 'Check-in queries',
    sublabel: 'Prompt response register',
  });
  return links;
}

/** Parse activity metadata for deep links. */
export function activityNavTarget(
  metadata: Record<string, unknown>,
  dataStore: DataStore
): RecordNavTarget | undefined {
  const reportId = metadata.reportId as string | undefined;
  const responseId = metadata.responseId as string | undefined;
  const investigationId = metadata.investigationId as string | undefined;
  const deliveryId = metadata.deliveryId as string | undefined;

  if (investigationId) {
    const inv = dataStore.investigations.find((i) => i.id === investigationId);
    return buildInvestigationNav(inv);
  }
  if (reportId) {
    const report = dataStore.reports.find((r) => r.id === reportId);
    return buildCaseNav(report);
  }
  if (responseId) {
    const response = dataStore.responses.find((r) => r.id === responseId);
    const prompt = response ? dataStore.prompts.find((p) => p.id === response.promptId) : undefined;
    return buildPromptResponseNav(response, prompt?.title);
  }
  if (deliveryId) {
    const delivery = dataStore.deliveries.find((d) => d.id === deliveryId);
    const prompt = delivery ? dataStore.prompts.find((p) => p.id === delivery.promptId) : undefined;
    return delivery ? buildDeliveryNav(delivery, prompt?.title) : undefined;
  }
  return undefined;
}
