import type {
  Organization,
  User,
  Department,
  Prompt,
  PromptDelivery,
  PromptResponse,
  Report,
  Investigation,
  ReportStatusEvent,
  Nudge,
  ActivityEvent,
  MetricsSnapshot,
  DashboardCounts,
  EmployeeEngagement,
  Policy,
  PolicyAcknowledgement,
  Announcement,
} from '@/types';

// Current user org ID
const ORG_ID = 'org-1';

// Organization
export const mockOrg: Organization = {
  id: ORG_ID,
  name: 'Mismo',
  settings: {
    allowAnonymousReports: true,
    enableSMS: true,
    enableEmail: true,
    showRecentActivityOnDashboard: true,
    showReportsRequiringAttentionOnDashboard: true,
    thresholds: {
      atRiskNoResponseDays: 30,
      atRiskMinResponseRate: 0.2,
      criticalSLAHours: 24,
    },
  },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// Departments
export const mockDepartments: Department[] = [
  { id: 'dept-1', orgId: ORG_ID, name: 'Engineering', createdAt: new Date(), updatedAt: new Date() },
  { id: 'dept-2', orgId: ORG_ID, name: 'Sales', createdAt: new Date(), updatedAt: new Date() },
  { id: 'dept-3', orgId: ORG_ID, name: 'Marketing', createdAt: new Date(), updatedAt: new Date() },
  { id: 'dept-4', orgId: ORG_ID, name: 'HR', createdAt: new Date(), updatedAt: new Date() },
  { id: 'dept-5', orgId: ORG_ID, name: 'Operations', createdAt: new Date(), updatedAt: new Date() },
];

// Users
export const mockUsers: User[] = [
  // Admin users
  {
    id: 'user-admin-1',
    orgId: ORG_ID,
    role: 'ADMIN',
    firstName: 'Sarah',
    lastName: 'Kitay',
    email: 'sarah.chen@mismo.com',
    departmentId: 'dept-4',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user-admin-2',
    orgId: ORG_ID,
    role: 'ADMIN',
    firstName: 'Michael',
    lastName: 'Rodriguez',
    email: 'michael.rodriguez@mismo.com',
    departmentId: 'dept-4',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user-hr-sarah',
    orgId: ORG_ID,
    role: 'HR',
    firstName: 'Sarah',
    lastName: 'Kitay',
    email: 'sarah.kitay@mismo.com',
    phone: '+1-555-0120',
    departmentId: 'dept-4',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user-manager-1',
    orgId: ORG_ID,
    role: 'HR',
    firstName: 'Jordan',
    lastName: 'Lee',
    email: 'jordan.lee@mismo.com',
    phone: '+1-555-0120',
    departmentId: 'dept-1',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user-client-1',
    orgId: ORG_ID,
    role: 'CLIENT',
    firstName: 'Pat',
    lastName: 'Campbell',
    email: 'pat.campbell@clientco.com',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // Employee users
  {
    id: 'user-emp-sarah',
    orgId: ORG_ID,
    role: 'EMPLOYEE',
    firstName: 'Sarah',
    lastName: 'Kitay',
    email: 'sarahkitay@mismo.com',
    phone: '+1-555-0100',
    departmentId: 'dept-1',
    managerId: 'user-manager-1',
    hiredDate: new Date('2023-06-15'),
    state: 'CA',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user-emp-1',
    orgId: ORG_ID,
    role: 'EMPLOYEE',
    firstName: 'Alex',
    lastName: 'Morgan',
    email: 'alex.morgan@mismo.com',
    phone: '+1-555-0101',
    departmentId: 'dept-1',
    managerId: 'user-manager-1',
    hiredDate: new Date('2022-03-01'),
    state: 'NY',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user-emp-2',
    orgId: ORG_ID,
    role: 'EMPLOYEE',
    firstName: 'Jordan',
    lastName: 'Taylor',
    email: 'jordan.taylor@mismo.com',
    phone: '+1-555-0102',
    departmentId: 'dept-1',
    managerId: 'user-manager-1',
    hiredDate: new Date('2023-01-10'),
    state: 'TX',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user-emp-3',
    orgId: ORG_ID,
    role: 'EMPLOYEE',
    firstName: 'Casey',
    lastName: 'Williams',
    email: 'casey.williams@mismo.com',
    departmentId: 'dept-2',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user-emp-4',
    orgId: ORG_ID,
    role: 'EMPLOYEE',
    firstName: 'Riley',
    lastName: 'Johnson',
    email: 'riley.johnson@mismo.com',
    departmentId: 'dept-2',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user-emp-5',
    orgId: ORG_ID,
    role: 'EMPLOYEE',
    firstName: 'Morgan',
    lastName: 'Davis',
    email: 'morgan.davis@mismo.com',
    departmentId: 'dept-3',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user-emp-6',
    orgId: ORG_ID,
    role: 'EMPLOYEE',
    firstName: 'Quinn',
    lastName: 'Brown',
    email: 'quinn.brown@mismo.com',
    departmentId: 'dept-5',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user-emp-7',
    orgId: ORG_ID,
    role: 'EMPLOYEE',
    firstName: 'Avery',
    lastName: 'Wilson',
    email: 'avery.wilson@mismo.com',
    departmentId: 'dept-1',
    status: 'inactive',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'user-emp-8',
    orgId: ORG_ID,
    role: 'EMPLOYEE',
    firstName: 'Sam',
    lastName: 'Garcia',
    email: 'sam.garcia@mismo.com',
    departmentId: 'dept-2',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Prompts
export const mockPrompts: Prompt[] = [
  {
    id: 'prompt-1',
    orgId: ORG_ID,
    type: 'INCIDENT',
    title: 'Incident Prompt',
    description: 'Compliance Check-In Required. Confirm no issue is present or open a case file for procedural review.',
    schedule: {
      cadence: 'ONCE',
      startAt: new Date('2024-02-20'),
      endAt: new Date('2024-02-22T17:00:00'),
    },
    targeting: {
      audience: 'ALL',
    },
    severityOnHasIssue: 'HIGH',
    allowAnonymousReports: true,
    status: 'ACTIVE',
    createdBy: 'user-admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'prompt-2',
    orgId: ORG_ID,
    type: 'TEAM_DYNAMIC',
    title: 'Team Dynamic Check-In',
    description: 'How is your team collaboration going? Any feedback or concerns about team dynamics?',
    schedule: {
      cadence: 'WEEKLY',
      startAt: new Date('2024-02-19'),
      endAt: new Date('2024-02-26'),
    },
    targeting: {
      audience: 'DEPARTMENT',
      departmentIds: ['dept-1', 'dept-2'],
    },
    severityOnHasIssue: 'MEDIUM',
    allowAnonymousReports: true,
    status: 'ACTIVE',
    createdBy: 'user-admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'prompt-3',
    orgId: ORG_ID,
    type: 'MONTHLY_CHECKIN',
    title: 'Monthly Health Check',
    description: 'Monthly wellbeing check-in. How are you feeling about your work environment?',
    schedule: {
      cadence: 'MONTHLY',
      startAt: new Date('2024-02-01'),
      endAt: new Date('2024-02-28'),
    },
    targeting: {
      audience: 'ALL',
    },
    severityOnHasIssue: 'LOW',
    allowAnonymousReports: true,
    status: 'ACTIVE',
    createdBy: 'user-admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    routeToPayroll: true,
  },
  {
    id: 'prompt-4',
    orgId: ORG_ID,
    type: 'CUSTOM',
    title: 'Safety Compliance Review',
    description: 'Please confirm you have reviewed the latest safety protocols.',
    schedule: {
      cadence: 'ONCE',
      startAt: new Date('2024-02-15'),
      endAt: new Date('2024-02-25'),
    },
    targeting: {
      audience: 'DEPARTMENT',
      departmentIds: ['dept-5'],
    },
    severityOnHasIssue: 'CRITICAL',
    allowAnonymousReports: false,
    status: 'ACTIVE',
    createdBy: 'user-admin-2',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Prompt Deliveries
export const mockPromptDeliveries: PromptDelivery[] = [
  // For Alex (user-emp-1)
  {
    id: 'delivery-1',
    orgId: ORG_ID,
    promptId: 'prompt-1',
    userId: 'user-emp-1',
    status: 'PENDING',
    deliveredAt: new Date('2024-02-20'),
    dueAt: new Date('2024-02-22T17:00:00'),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'delivery-2',
    orgId: ORG_ID,
    promptId: 'prompt-2',
    userId: 'user-emp-1',
    status: 'COMPLETED',
    deliveredAt: new Date('2024-02-19'),
    dueAt: new Date('2024-02-26'),
    completedAt: new Date('2024-02-20'),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // For other employees
  {
    id: 'delivery-3',
    orgId: ORG_ID,
    promptId: 'prompt-1',
    userId: 'user-emp-2',
    status: 'COMPLETED',
    deliveredAt: new Date('2024-02-20'),
    dueAt: new Date('2024-02-22T17:00:00'),
    completedAt: new Date('2024-02-21'),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'delivery-4',
    orgId: ORG_ID,
    promptId: 'prompt-1',
    userId: 'user-emp-3',
    status: 'PENDING',
    deliveredAt: new Date('2024-02-20'),
    dueAt: new Date('2024-02-22T17:00:00'),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'delivery-5',
    orgId: ORG_ID,
    promptId: 'prompt-3',
    userId: 'user-emp-4',
    status: 'PENDING',
    deliveredAt: new Date('2024-02-01'),
    dueAt: new Date('2024-02-28'),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Prompt Responses
export const mockPromptResponses: PromptResponse[] = [
  {
    id: 'response-1',
    orgId: ORG_ID,
    promptId: 'prompt-2',
    promptDeliveryId: 'delivery-2',
    userId: 'user-emp-1',
    answer: 'NO_ISSUE',
    submittedAt: new Date('2024-02-20'),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'response-2',
    orgId: ORG_ID,
    promptId: 'prompt-1',
    promptDeliveryId: 'delivery-3',
    userId: 'user-emp-2',
    answer: 'HAS_ISSUE',
    submittedAt: new Date('2024-02-21'),
    notes: 'I have a concern about workplace safety',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Reports
export const mockReports: Report[] = [
  {
    id: 'report-1',
    orgId: ORG_ID,
    createdByUserId: 'user-emp-2',
    isAnonymous: false,
    sourcePromptId: 'prompt-1',
    sourcePromptResponseId: 'response-2',
    category: 'SAFETY',
    severity: 'HIGH',
    summary: 'Safety equipment not maintained properly',
    description: 'The safety harnesses in the warehouse have not been inspected in over 6 months. I am concerned about using them.',
    peopleInvolved: 'Warehouse team',
    location: 'Warehouse B',
    incidentAt: new Date('2024-02-15'),
    status: 'ASSIGNED',
    assignedTo: 'user-admin-2',
    investigationId: 'inv-1',
    preferredContactMethod: 'EMAIL',
    createdAt: new Date('2024-02-21'),
    updatedAt: new Date(),
  },
  {
    id: 'report-2',
    orgId: ORG_ID,
    createdByUserId: 'user-emp-3',
    isAnonymous: true,
    category: 'HARASSMENT',
    severity: 'CRITICAL',
    summary: 'Inappropriate behavior from manager',
    description: 'I have witnessed repeated inappropriate comments from a manager towards team members.',
    status: 'TRIAGED',
    preferredContactMethod: 'IN_APP',
    createdAt: new Date('2024-02-18'),
    updatedAt: new Date(),
  },
  {
    id: 'report-3',
    orgId: ORG_ID,
    createdByUserId: 'user-emp-1',
    isAnonymous: false,
    category: 'WAGE_HOURS',
    severity: 'MEDIUM',
    summary: 'Overtime not being calculated correctly',
    description: 'My last two paychecks have been missing overtime hours.',
    status: 'RESOLVED',
    assignedTo: 'user-admin-1',
    preferredContactMethod: 'EMAIL',
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date(),
  },
  {
    id: 'report-4',
    orgId: ORG_ID,
    createdByUserId: 'user-emp-5',
    isAnonymous: false,
    category: 'DISCRIMINATION',
    severity: 'HIGH',
    summary: 'Promotion process seems unfair',
    description: 'I have concerns about the transparency of the recent promotion decisions.',
    status: 'NEW',
    preferredContactMethod: 'PHONE',
    createdAt: new Date('2024-02-22'),
    updatedAt: new Date(),
  },
  {
    id: 'report-5',
    orgId: ORG_ID,
    createdByUserId: 'user-emp-3',
    isAnonymous: true,
    category: 'THEFT',
    severity: 'CRITICAL',
    summary: 'Missing inventory from storage',
    description: 'Significant inventory has gone missing from the main storage facility.',
    status: 'IN_REVIEW',
    assignedTo: 'user-admin-2',
    investigationId: 'inv-2',
    preferredContactMethod: 'IN_APP',
    createdAt: new Date('2024-02-19'),
    updatedAt: new Date(),
  },
  {
    id: 'report-6',
    orgId: ORG_ID,
    createdByUserId: 'user-emp-sarah',
    isAnonymous: false,
    category: 'WAGE_HOURS',
    severity: 'MEDIUM',
    summary: 'Pay stub discrepancy',
    description: 'My most recent pay stub does not match my hours worked.',
    status: 'ASSIGNED',
    assignedTo: 'user-admin-1',
    preferredContactMethod: 'EMAIL',
    createdAt: new Date('2024-02-18'),
    updatedAt: new Date(),
  },
  {
    id: 'report-7',
    orgId: ORG_ID,
    createdByUserId: 'user-emp-sarah',
    isAnonymous: false,
    category: 'SAFETY',
    severity: 'LOW',
    summary: 'Trip hazard in break room',
    description: 'Loose cable near the break room entrance could cause someone to trip.',
    status: 'NEW',
    preferredContactMethod: 'IN_APP',
    createdAt: new Date('2024-02-20'),
    updatedAt: new Date(),
  },
];

// Investigations
export const mockInvestigations: Investigation[] = [
  {
    id: 'inv-1',
    orgId: ORG_ID,
    status: 'OPEN',
    ownerId: 'user-admin-2',
    linkedReportIds: ['report-1'],
    openedAt: new Date('2024-02-21'),
    lastUpdateAt: new Date('2024-02-21'),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'inv-2',
    orgId: ORG_ID,
    status: 'OPEN',
    ownerId: 'user-admin-1',
    linkedReportIds: ['report-5'],
    openedAt: new Date('2024-02-19'),
    lastUpdateAt: new Date('2024-02-20'),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'inv-3',
    orgId: ORG_ID,
    status: 'CLOSED',
    ownerId: 'user-admin-1',
    linkedReportIds: ['report-3'],
    openedAt: new Date('2024-02-10'),
    closedAt: new Date('2024-02-15'),
    lastUpdateAt: new Date('2024-02-15'),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Report Status Events
export const mockReportStatusEvents: ReportStatusEvent[] = [
  {
    id: 'event-1',
    orgId: ORG_ID,
    reportId: 'report-1',
    fromStatus: 'NEW',
    toStatus: 'TRIAGED',
    changedBy: 'user-admin-1',
    note: 'Initial review completed',
    createdAt: new Date('2024-02-21'),
    updatedAt: new Date(),
  },
  {
    id: 'event-2',
    orgId: ORG_ID,
    reportId: 'report-1',
    fromStatus: 'TRIAGED',
    toStatus: 'ASSIGNED',
    changedBy: 'user-admin-1',
    note: 'Assigned to Michael for investigation',
    createdAt: new Date('2024-02-21'),
    updatedAt: new Date(),
  },
  {
    id: 'event-3',
    orgId: ORG_ID,
    reportId: 'report-6',
    fromStatus: 'NEW',
    toStatus: 'TRIAGED',
    changedBy: 'user-admin-1',
    note: 'Initial review',
    createdAt: new Date('2024-02-18'),
    updatedAt: new Date(),
  },
  {
    id: 'event-4',
    orgId: ORG_ID,
    reportId: 'report-6',
    fromStatus: 'TRIAGED',
    toStatus: 'ASSIGNED',
    changedBy: 'user-admin-1',
    note: 'Assigned for follow-up',
    createdAt: new Date('2024-02-19'),
    updatedAt: new Date(),
  },
];

// Nudges
export const mockNudges: Nudge[] = [
  {
    id: 'nudge-1',
    orgId: ORG_ID,
    targetUserId: 'user-emp-4',
    channel: 'EMAIL',
    message: 'Reminder: You have a pending prompt that is due soon.',
    context: {
      type: 'PROMPT_REMINDER',
      promptId: 'prompt-3',
    },
    sentByAdminId: 'user-admin-1',
    sentAt: new Date('2024-02-25'),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Activity Events
export const mockActivityEvents: ActivityEvent[] = [
  {
    id: 'activity-1',
    orgId: ORG_ID,
    type: 'REPORT_CREATED',
    actorUserId: 'user-emp-2',
    metadata: { reportId: 'report-1', category: 'SAFETY' },
    createdAt: new Date('2024-02-21T10:30:00'),
  },
  {
    id: 'activity-2',
    orgId: ORG_ID,
    type: 'INVESTIGATION_CREATED',
    actorUserId: 'user-admin-2',
    metadata: { investigationId: 'inv-1', reportId: 'report-1' },
    createdAt: new Date('2024-02-21T11:00:00'),
  },
  {
    id: 'activity-3',
    orgId: ORG_ID,
    type: 'REPORT_STATUS_CHANGED',
    actorUserId: 'user-admin-1',
    metadata: { reportId: 'report-2', from: 'NEW', to: 'TRIAGED' },
    createdAt: new Date('2024-02-22T09:15:00'),
  },
  {
    id: 'activity-4',
    orgId: ORG_ID,
    type: 'PROMPT_RESPONSE',
    actorUserId: 'user-emp-1',
    metadata: { promptId: 'prompt-2', answer: 'NO_ISSUE' },
    createdAt: new Date('2024-02-20T14:20:00'),
  },
  {
    id: 'activity-5',
    orgId: ORG_ID,
    type: 'REPORT_ASSIGNED',
    actorUserId: 'user-admin-1',
    metadata: { reportId: 'report-5', assignedTo: 'user-admin-2' },
    createdAt: new Date('2024-02-19T16:45:00'),
  },
  {
    id: 'activity-6',
    orgId: ORG_ID,
    type: 'NUDGE_SENT',
    actorUserId: 'user-admin-1',
    metadata: { nudgeId: 'nudge-1', targetUserId: 'user-emp-4' },
    createdAt: new Date('2024-02-25T08:00:00'),
  },
];

// Metrics Snapshot
export const mockMetricsSnapshot: MetricsSnapshot = {
  id: 'metrics-1',
  orgId: ORG_ID,
  window: '30d',
  responseRate: 0.87,
  trainingCompliance: 0.94,
  avgResolutionTimeHours: 100.8, // 4.2 days
  reportsThisMonth: 24,
  categoryBreakdown: {
    SAFETY: 8,
    HARASSMENT: 4,
    WAGE_HOURS: 5,
    DISCRIMINATION: 3,
    THEFT: 2,
    OTHER: 2,
  },
  departmentHealth: {
    'dept-1': { riskLevel: 'LOW', reportCount: 3 },
    'dept-2': { riskLevel: 'MEDIUM', reportCount: 7 },
    'dept-3': { riskLevel: 'LOW', reportCount: 2 },
    'dept-4': { riskLevel: 'LOW', reportCount: 1 },
    'dept-5': { riskLevel: 'HIGH', reportCount: 11 },
  },
  createdAt: new Date(),
};

export const mockPolicies: Policy[] = [
  {
    id: 'policy-1',
    orgId: ORG_ID,
    title: 'Workplace Conduct Policy',
    type: 'CONDUCT',
    content: 'All employees must maintain professional conduct and respect.',
    effectiveDate: new Date('2024-01-15'),
    publishedAt: new Date('2024-01-10'),
    acknowledgmentRequired: true,
    tags: ['conduct', 'behavior'],
    status: 'PUBLISHED',
    createdAt: new Date('2024-01-08'),
    updatedAt: new Date('2024-01-10'),
  },
  {
    id: 'policy-2',
    orgId: ORG_ID,
    title: 'Safety Incident Reporting Policy',
    type: 'SAFETY',
    content: 'Incidents must be reported within 24 hours.',
    effectiveDate: new Date('2024-02-01'),
    publishedAt: new Date('2024-01-25'),
    acknowledgmentRequired: true,
    tags: ['safety', 'reporting'],
    status: 'PUBLISHED',
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-25'),
  },
];

export const mockPolicyAcknowledgements: PolicyAcknowledgement[] = [
  { policyId: 'policy-1', userId: 'user-emp-1', acknowledgedAt: new Date('2024-01-16') },
  { policyId: 'policy-2', userId: 'user-emp-2', acknowledgedAt: new Date('2024-02-02') },
];

export const mockAnnouncements: Announcement[] = [
  {
    id: 'announcement-1',
    orgId: ORG_ID,
    title: 'Holiday Schedule Update',
    body: 'Updated holiday schedule is now available in HR portal.',
    audience: 'ALL',
    tags: ['holiday', 'schedule'],
    type: 'HOLIDAY',
    status: 'PUBLISHED',
    viewsCount: 156,
    sentAt: new Date('2024-12-15'),
    createdAt: new Date('2024-12-10'),
    updatedAt: new Date('2024-12-15'),
  },
  {
    id: 'announcement-2',
    orgId: ORG_ID,
    title: 'Urgent Safety Memo',
    body: 'Please review emergency assembly points for all offices.',
    audience: 'ALL',
    tags: ['urgent', 'safety'],
    type: 'URGENT',
    status: 'PUBLISHED',
    viewsCount: 243,
    sentAt: new Date('2025-01-12'),
    createdAt: new Date('2025-01-11'),
    updatedAt: new Date('2025-01-12'),
  },
  {
    id: 'announcement-3',
    orgId: ORG_ID,
    title: 'Quarterly Town Hall',
    body: 'Town hall is scheduled for next Monday at 10am PT.',
    audience: 'ALL',
    tags: ['townhall'],
    type: 'GENERAL',
    status: 'SCHEDULED',
    viewsCount: 0,
    publishAt: new Date('2026-03-01T10:00:00'),
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-01'),
  },
];

// Dashboard Counts
export function getDashboardCounts(): DashboardCounts {
  const criticalReports = mockReports.filter(
    r => (r.severity === 'HIGH' || r.severity === 'CRITICAL') && 
         !['RESOLVED', 'CLOSED'].includes(r.status)
  ).length;
  
  const activeInvestigations = mockInvestigations.filter(
    i => i.status === 'OPEN'
  ).length;
  
  const needsAssignment = mockReports.filter(
    r => !r.assignedTo && ['NEW', 'TRIAGED'].includes(r.status)
  ).length;
  
  const atRiskEmployees = getAtRiskEmployees().length;
  
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const scheduledMemos = mockPromptDeliveries.filter(
    d => d.status === 'PENDING' && 
         d.dueAt && 
         (d.dueAt <= nextWeek || d.dueAt < now)
  ).length;
  
  const activeCampaigns = mockPrompts.filter(
    p => p.status === 'ACTIVE'
  ).length;
  
  return {
    criticalReports,
    activeInvestigations,
    needsAssignment,
    atRiskEmployees,
    scheduledMemos,
    activeCampaigns,
  };
}

// Get at-risk employees
export function getAtRiskEmployees(): EmployeeEngagement[] {
  const employees = mockUsers.filter(u => u.role === 'EMPLOYEE' && u.status === 'active');
  const now = new Date();
  const thresholdDays = mockOrg.settings.thresholds.atRiskNoResponseDays;
  const thresholdRate = mockOrg.settings.thresholds.atRiskMinResponseRate;
  
  return employees.map(emp => {
    const responses = mockPromptResponses.filter(r => r.userId === emp.id);
    const lastResponseAt = responses.length > 0 
      ? new Date(Math.max(...responses.map(r => r.submittedAt.getTime())))
      : undefined;
    
    const daysSinceLastResponse = lastResponseAt 
      ? Math.floor((now.getTime() - lastResponseAt.getTime()) / (1000 * 60 * 60 * 24))
      : Infinity;
    
    const pendingPrompts = mockPromptDeliveries.filter(
      d => d.userId === emp.id && d.status === 'PENDING'
    ).length;
    
    // Calculate 30-day response rate
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const deliveries30d = mockPromptDeliveries.filter(
      d => d.userId === emp.id && d.deliveredAt >= thirtyDaysAgo
    );
    const responses30d = deliveries30d.filter(d => d.status === 'COMPLETED');
    const responseRate30d = deliveries30d.length > 0 
      ? responses30d.length / deliveries30d.length 
      : 0;
    
    const isAtRisk = 
      !lastResponseAt || 
      daysSinceLastResponse > thresholdDays || 
      responseRate30d < thresholdRate;
    
    return {
      userId: emp.id,
      lastResponseAt,
      responseRate30d,
      pendingPrompts,
      isAtRisk,
    };
  }).filter(e => e.isAtRisk);
}

// Get employee engagement
export function getEmployeeEngagement(userId: string): EmployeeEngagement | undefined {
  const emp = mockUsers.find(u => u.id === userId);
  if (!emp || emp.role !== 'EMPLOYEE') return undefined;
  
  const responses = mockPromptResponses.filter(r => r.userId === userId);
  const lastResponseAt = responses.length > 0 
    ? new Date(Math.max(...responses.map(r => r.submittedAt.getTime())))
    : undefined;
  
  const now = new Date();
  const daysSinceLastResponse = lastResponseAt 
    ? Math.floor((now.getTime() - lastResponseAt.getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;
  
  const pendingPrompts = mockPromptDeliveries.filter(
    d => d.userId === userId && d.status === 'PENDING'
  ).length;
  
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const deliveries30d = mockPromptDeliveries.filter(
    d => d.userId === userId && d.deliveredAt >= thirtyDaysAgo
  );
  const responses30d = deliveries30d.filter(d => d.status === 'COMPLETED');
  const responseRate30d = deliveries30d.length > 0 
    ? responses30d.length / deliveries30d.length 
    : 0;
  
  const thresholdDays = mockOrg.settings.thresholds.atRiskNoResponseDays;
  const thresholdRate = mockOrg.settings.thresholds.atRiskMinResponseRate;
  
  const isAtRisk = 
    !lastResponseAt || 
    daysSinceLastResponse > thresholdDays || 
    responseRate30d < thresholdRate;
  
  return {
    userId: emp.id,
    lastResponseAt,
    responseRate30d,
    pendingPrompts,
    isAtRisk,
  };
}

// Get pending prompts for employee
export function getPendingPrompts(userId: string): (PromptDelivery & { prompt: Prompt })[] {
  const deliveries = mockPromptDeliveries.filter(
    d => d.userId === userId && d.status === 'PENDING'
  );
  
  return deliveries.map(d => {
    const prompt = mockPrompts.find(p => p.id === d.promptId)!;
    return { ...d, prompt };
  });
}

// Get employee reports
export function getEmployeeReports(userId: string): Report[] {
  return mockReports.filter(r => r.createdByUserId === userId);
}

// Get category label
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    HARASSMENT: 'Harassment',
    THEFT: 'Theft',
    SAFETY: 'Safety',
    DISCRIMINATION: 'Discrimination',
    WAGE_HOURS: 'Wage/Hours',
    RETALIATION: 'Retaliation',
    OTHER: 'Other',
  };
  return labels[category] || category;
}

// Get status label
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    NEW: 'New',
    TRIAGED: 'Triaged',
    ASSIGNED: 'Assigned',
    IN_REVIEW: 'In Review',
    NEEDS_INFO: 'Needs Info',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
  };
  return labels[status] || status;
}

// Get severity label
export function getSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    CRITICAL: 'Critical',
  };
  return labels[severity] || severity;
}

// Get prompt type label
export function getPromptTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    INCIDENT: 'Incident Prompt',
    TEAM_DYNAMIC: 'Team Dynamic Check-In',
    MONTHLY_CHECKIN: 'Monthly Health Check',
    CUSTOM: 'Custom',
  };
  return labels[type] || type;
}
