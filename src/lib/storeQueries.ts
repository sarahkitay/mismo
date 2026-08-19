import type {
  Investigation,
  PromptDelivery,
  PromptResponse,
  Report,
  ReportStatus,
  User,
} from '@/types';

export type ReportFilters = {
  status?: ReportStatus[];
  severity?: string[];
  category?: string[];
  assignedTo?: string | null;
  search?: string;
};

export type InvestigationFilters = {
  status?: Investigation['status'];
  ownerId?: string;
};

export type EmployeeFilters = {
  atRiskOnly?: boolean;
  neverResponded?: boolean;
  lowEngagement?: boolean;
  departmentId?: string;
};

export type AtRiskThresholds = {
  atRiskNoResponseDays: number;
  atRiskMinResponseRate: number;
};

export type EngagementSnapshot = {
  userId: string;
  lastResponseAt: Date | undefined;
  responseRate30d: number;
  pendingPrompts: number;
  isAtRisk: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function filterReports(reports: Report[], filters: ReportFilters): Report[] {
  let filtered = [...reports];
  if (filters.status) filtered = filtered.filter((r) => filters.status!.includes(r.status));
  if (filters.severity) filtered = filtered.filter((r) => filters.severity!.includes(r.severity));
  if (filters.category) filtered = filtered.filter((r) => filters.category!.includes(r.category));
  if (filters.assignedTo !== undefined) {
    filtered =
      filters.assignedTo === null
        ? filtered.filter((r) => !r.assignedTo)
        : filtered.filter((r) => r.assignedTo === filters.assignedTo);
  }
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.summary.toLowerCase().includes(searchLower) ||
        r.description.toLowerCase().includes(searchLower)
    );
  }
  return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function filterInvestigations(
  investigations: Investigation[],
  filters: InvestigationFilters
): Investigation[] {
  let filtered = [...investigations];
  if (filters.status) filtered = filtered.filter((i) => i.status === filters.status);
  if (filters.ownerId) filtered = filtered.filter((i) => i.ownerId === filters.ownerId);
  return filtered.sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime());
}

export function computeEmployeeEngagement(
  userId: string,
  opts: {
    responses: PromptResponse[];
    deliveries: PromptDelivery[];
    thresholds: AtRiskThresholds;
    now?: Date;
  }
): EngagementSnapshot {
  const now = opts.now ?? new Date();
  const employeeResponses = opts.responses.filter((r) => r.userId === userId);
  const lastResponseAt = employeeResponses.length
    ? new Date(Math.max(...employeeResponses.map((r) => r.submittedAt.getTime())))
    : undefined;
  const deliveries30d = opts.deliveries.filter(
    (d) => d.userId === userId && now.getTime() - d.deliveredAt.getTime() <= 30 * DAY_MS
  );
  const completed30d = deliveries30d.filter((d) => d.status === 'COMPLETED').length;
  const responseRate30d = deliveries30d.length ? completed30d / deliveries30d.length : 0;
  const daysSinceLastResponse = lastResponseAt
    ? Math.floor((now.getTime() - lastResponseAt.getTime()) / 1000 / 60 / 60 / 24)
    : Infinity;
  return {
    userId,
    lastResponseAt,
    responseRate30d,
    pendingPrompts: opts.deliveries.filter((d) => d.userId === userId && d.status === 'PENDING').length,
    isAtRisk:
      !lastResponseAt ||
      daysSinceLastResponse > opts.thresholds.atRiskNoResponseDays ||
      responseRate30d < opts.thresholds.atRiskMinResponseRate,
  };
}

export function computeAtRiskEmployees(
  users: User[],
  opts: {
    responses: PromptResponse[];
    deliveries: PromptDelivery[];
    thresholds: AtRiskThresholds;
    now?: Date;
  }
): EngagementSnapshot[] {
  return users
    .filter((u) => u.role === 'EMPLOYEE' && u.status === 'active')
    .map((emp) => computeEmployeeEngagement(emp.id, opts))
    .filter((e) => e.isAtRisk);
}

export function filterEmployees(
  users: User[],
  filters: EmployeeFilters,
  opts: {
    responses: PromptResponse[];
    deliveries: PromptDelivery[];
    thresholds: AtRiskThresholds;
  }
): User[] {
  let filtered = users.filter((u) => u.role === 'EMPLOYEE');
  if (filters.departmentId) filtered = filtered.filter((u) => u.departmentId === filters.departmentId);
  if (filters.atRiskOnly) {
    const atRiskIds = new Set(computeAtRiskEmployees(users, opts).map((e) => e.userId));
    filtered = filtered.filter((u) => atRiskIds.has(u.id));
  }
  return filtered;
}
