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
  AuditLogEntry,
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
    role: 'HR',
    firstName: 'Sarah',
    lastName: 'Kitay',
    email: 'hr@mismo.com',
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
    employeeId: 'EMP-1001',
    location: 'San Francisco HQ',
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
    email: 'employee@mismo.com',
    phone: '+1-555-0101',
    employeeId: 'EMP-1002',
    location: 'New York, Floor 12',
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
    employeeId: 'EMP-4407',
    location: 'Remote, US',
    archiveStartDate: new Date('2024-11-01'),
    archiveEndDate: new Date('2027-11-01'),
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
    title: 'Incident Query',
    description:
      'Mandatory employment-rights incident screen at logon (EQC-style). Yes/No only; Yes uses a confirmation step before the response is stored.',
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
    onboardingKind: 'INCIDENT',
    includeFinancialQuestion: false,
  },
  {
    id: 'prompt-wage-hour',
    orgId: ORG_ID,
    type: 'CUSTOM',
    title: 'Wage & Hour Query',
    description: 'One-time wage and hour screening at employee logon.',
    schedule: {
      cadence: 'ONCE',
      startAt: new Date('2024-01-01'),
    },
    targeting: {
      audience: 'ALL',
    },
    severityOnHasIssue: 'MEDIUM',
    allowAnonymousReports: false,
    status: 'ACTIVE',
    createdBy: 'user-admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    onboardingKind: 'WAGE_HOUR',
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
    includeFinancialQuestion: true,
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
    deliveredAt: new Date('2026-05-20'),
    dueAt: new Date('2026-05-27T17:00:00'),
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
    needsReview: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Reports
export const mockReports: Report[] = [
  {
    id: 'report-1',
    orgId: ORG_ID,
    referenceNumber: 'CAS-2026-0001',
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
    reportSourceType: 'EMPLOYEE_PROMPT_RESPONSE',
    needsExtendedIncidentIntake: true,
    incidentIntakeCompletedAt: new Date('2024-02-22'),
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
    status: 'NEEDS_INFO',
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
  {
    id: 'report-intake-pending',
    orgId: ORG_ID,
    createdByUserId: 'user-emp-1',
    isAnonymous: false,
    category: 'OTHER',
    severity: 'MEDIUM',
    summary: 'Incident notice: full intake requested',
    description:
      'You indicated you have something to report. HR has logged this notice; complete the linked incident questionnaire so the case file can move forward.',
    status: 'NEW',
    preferredContactMethod: 'IN_APP',
    needsExtendedIncidentIntake: true,
    createdAt: new Date('2024-02-23'),
    updatedAt: new Date('2024-02-23'),
  },
  {
    id: 'report-outcome-test',
    orgId: ORG_ID,
    createdByUserId: 'user-emp-1',
    isAnonymous: false,
    category: 'OTHER',
    severity: 'LOW',
    summary: 'Demo: outcome letter awaiting your confirmation',
    description: 'Sample case for reviewing the investigation closure flow.',
    status: 'IN_REVIEW',
    assignedTo: 'user-admin-1',
    investigationId: 'inv-outcome-demo',
    incidentIntakeCompletedAt: new Date('2024-02-22'),
    preferredContactMethod: 'IN_APP',
    createdAt: new Date('2024-02-22'),
    updatedAt: new Date(),
  },
];

// Investigations
export const mockInvestigations: Investigation[] = [
  {
    id: 'inv-1',
    orgId: ORG_ID,
    referenceNumber: 'CAS-2026-0001',
    status: 'OPEN',
    ownerId: 'user-admin-2',
    linkedReportIds: ['report-1'],
    category: 'SAFETY',
    severity: 'HIGH',
    priority: 'HIGH',
    riskLevel: 'HIGH',
    investigationType: 'Safety Investigation',
    reportSourceType: 'EMPLOYEE_PROMPT_RESPONSE',
    linkedPromptId: 'prompt-1',
    linkedPromptResponseId: 'response-2',
    witnessUserIds: ['user-emp-3'],
    witnessExternal: ['Contractor on site (name on file)'],
    openedAt: new Date('2024-02-21'),
    lastUpdateAt: new Date('2024-02-21'),
    createdAt: new Date(),
    updatedAt: new Date(),
    workflowPhase: 'IN_PROGRESS',
    stage: 'EVIDENCE_REVIEW',
    stageHistory: [
      { stage: 'INTAKE_RECEIVED', enteredAt: new Date('2024-02-21'), enteredByUserId: 'user-admin-1', note: 'Auto-created from prompt response' },
      { stage: 'PENDING_REVIEW', enteredAt: new Date('2024-02-21'), enteredByUserId: 'user-admin-1' },
      { stage: 'ASSIGNED', enteredAt: new Date('2024-02-21'), enteredByUserId: 'user-admin-1', ownerId: 'user-admin-2' },
      { stage: 'IN_PROGRESS', enteredAt: new Date('2024-02-21'), enteredByUserId: 'user-admin-2', ownerId: 'user-admin-2' },
      { stage: 'EVIDENCE_REVIEW', enteredAt: new Date('2024-02-22'), enteredByUserId: 'user-admin-2', ownerId: 'user-admin-2' },
    ],
    pickedUpAt: new Date('2024-02-21'),
    employeePreferredContact: 'IN_APP_MESSAGE',
    subjectUserIds: ['user-emp-2'],
    persons: [
      { id: 'p-1', role: 'REPORTING_PARTY', userId: 'user-emp-2', addedAt: new Date('2024-02-21'), addedByUserId: 'user-admin-1' },
      { id: 'p-2', role: 'WITNESS', userId: 'user-emp-3', addedAt: new Date('2024-02-21'), addedByUserId: 'user-admin-2' },
      { id: 'p-3', role: 'INVESTIGATOR', userId: 'user-admin-2', addedAt: new Date('2024-02-21'), addedByUserId: 'user-admin-1' },
      { id: 'p-4', role: 'EXTERNAL_PARTY', externalName: 'Contractor on site (name on file)', addedAt: new Date('2024-02-21') },
    ],
    notes: [
      {
        id: 'inv-note-seed-1',
        visibility: 'INTERNAL',
        body: 'Initial intake call with reporting party — described slip hazard near loading dock. Interview auto-logged.',
        createdAt: new Date('2024-02-21'),
        createdByUserId: 'user-admin-2',
        noteType: 'INTERVIEW',
        pinned: true,
      },
    ],
    evidenceRecords: [
      {
        id: 'ev-seed-1',
        type: 'SCREENSHOT',
        fileName: 'loading-dock-photo.jpg',
        mimeType: 'image/jpeg',
        description: 'Photo of wet floor area submitted by reporting party',
        sourceType: 'UPLOAD',
        uploadedAt: new Date('2024-02-22'),
        uploadedByUserId: 'user-admin-2',
        preserved: true,
        promptLabel: 'Upload screenshots related to incident',
      },
    ],
    responseRequests: [
      {
        id: 'req-seed-1',
        partyUserId: 'user-emp-2',
        partyRole: 'REPORTING_PARTY',
        method: 'IN_APP',
        status: 'SUBMITTED',
        sentAt: new Date('2024-02-21'),
        viewedAt: new Date('2024-02-21'),
        submittedAt: new Date('2024-02-22'),
        message: 'Please confirm details of the incident and provide any additional context.',
        createdAt: new Date('2024-02-21'),
        createdByUserId: 'user-admin-2',
      },
    ],
    findingsRationale: 'Reporting party statement corroborated by witness account and photographic evidence of wet floor without signage.',
    policyAnalysisNotes: 'Incident may relate to Workplace Safety Policy Section 3.1 — hazard identification and signage requirements.',
    linkedPolicyIds: ['policy-1'],
  },
  {
    id: 'inv-2',
    orgId: ORG_ID,
    referenceNumber: 'INV-2024-0143',
    status: 'OPEN',
    ownerId: 'user-admin-1',
    linkedReportIds: ['report-5'],
    category: 'OTHER',
    severity: 'MEDIUM',
    openedAt: new Date('2024-02-19'),
    lastUpdateAt: new Date('2024-02-20'),
    createdAt: new Date(),
    updatedAt: new Date(),
    workflowPhase: 'QUEUED',
    subjectUserIds: [],
    notes: [],
  },
  {
    id: 'inv-3',
    orgId: ORG_ID,
    referenceNumber: 'INV-2024-0099',
    status: 'CLOSED',
    ownerId: 'user-admin-1',
    linkedReportIds: ['report-3'],
    category: 'WAGE_HOURS',
    severity: 'MEDIUM',
    openedAt: new Date('2024-02-10'),
    closedAt: new Date('2024-02-15'),
    lastUpdateAt: new Date('2024-02-15'),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'inv-outcome-demo',
    orgId: ORG_ID,
    referenceNumber: 'INV-2024-0201',
    status: 'OPEN',
    ownerId: 'user-admin-1',
    linkedReportIds: ['report-outcome-test'],
    category: 'HARASSMENT',
    severity: 'HIGH',
    openedAt: new Date('2024-02-22'),
    lastUpdateAt: new Date('2024-02-22'),
    createdAt: new Date(),
    updatedAt: new Date(),
    workflowPhase: 'AWAITING_OUTCOME_ACK',
    pickedUpAt: new Date('2024-02-22'),
    employeePreferredContact: 'IN_APP_MESSAGE',
    subjectUserIds: [],
    outcomeSummary:
      'Following review, we will schedule retraining for the team lead and document expectations in writing. If you have additional concerns, reply through this portal.',
    outcomeRequiresSignature: true,
    outcomeSentAt: new Date('2024-02-23'),
    outcomeEmployeeAgreed: null,
    responseRequests: [
      {
        id: 'req-outcome-pending',
        partyUserId: 'user-emp-1',
        partyRole: 'REPORTING_PARTY',
        method: 'IN_APP',
        status: 'SENT',
        sentAt: new Date('2024-02-23'),
        message:
          'Please confirm whether the retraining plan described in your outcome letter works for your schedule, or share any concerns.',
        createdAt: new Date('2024-02-23'),
        createdByUserId: 'user-admin-1',
      },
    ],
    notes: [
      {
        id: 'inv-note-shared-demo',
        visibility: 'EMPLOYEE',
        body: 'HR has sent your outcome letter. Please review and respond to any open requests below.',
        createdAt: new Date('2024-02-23'),
        createdByUserId: 'user-admin-1',
        noteType: 'SHARED',
        sentAt: new Date('2024-02-23'),
      },
    ],
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
    title: 'Workplace Conduct Memo, 2024',
    type: 'CONDUCT',
    content: 'All employees must maintain professional conduct and respect.',
    effectiveDate: new Date('2024-01-15'),
    publishedAt: new Date('2024-01-10'),
    acknowledgmentRequired: true,
    tags: ['conduct', 'behavior'],
    status: 'PUBLISHED',
    createdAt: new Date('2024-01-08'),
    updatedAt: new Date('2024-01-10'),
    memoCategory: 'Conduct & ethics',
    completionDueDate: new Date('2024-12-31'),
    bodySource: 'EDITOR',
  },
  {
    id: 'policy-2',
    orgId: ORG_ID,
    title: 'Safety incident reporting, warehouse',
    type: 'SAFETY',
    content: 'Incidents must be reported within 24 hours.',
    effectiveDate: new Date('2024-02-01'),
    publishedAt: new Date('2024-01-25'),
    acknowledgmentRequired: true,
    tags: ['safety', 'reporting'],
    status: 'PUBLISHED',
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-25'),
    memoCategory: 'Safety',
    completionDueDate: new Date('2024-06-30'),
    bodySource: 'EDITOR',
  },
];

/** Admin-managed company library items (HR portal → Resources / Company Library). */
export const mockCompanyResources: import('@/types').CompanyResource[] = [
  {
    id: 'resource-handbook-1',
    orgId: ORG_ID,
    title: 'Employee Handbook (2024)',
    description: 'Company standards, procedures, and expectations.',
    category: 'EMPLOYEE_HANDBOOK',
    url: 'https://example.com/handbook',
    status: 'PUBLISHED',
    sortOrder: 1,
    publishedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'resource-conduct-1',
    orgId: ORG_ID,
    title: 'Code of Conduct',
    description: 'Professional behavior and workplace respect.',
    category: 'POLICIES_PROCEDURES',
    url: 'https://www.shrm.org/',
    status: 'PUBLISHED',
    sortOrder: 2,
    publishedAt: new Date('2024-01-15'),
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: 'resource-eap-1',
    orgId: ORG_ID,
    title: 'Employee Assistance Program',
    description: 'Confidential counseling and support services.',
    category: 'WELLNESS',
    url: 'https://www.samhsa.gov/find-help/national-helpline',
    status: 'PUBLISHED',
    sortOrder: 3,
    publishedAt: new Date('2024-02-01'),
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
  {
    id: 'resource-safety-1',
    orgId: ORG_ID,
    title: 'Emergency Procedures',
    description: 'Workplace safety protocols and evacuation plans.',
    category: 'SAFETY_SECURITY',
    url: 'https://www.ready.gov/workplace-emergency-plans',
    status: 'PUBLISHED',
    sortOrder: 4,
    publishedAt: new Date('2024-02-01'),
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
  {
    id: 'resource-rights-1',
    orgId: ORG_ID,
    title: 'Know Your Rights',
    description: 'Overview of employee rights and legal protections.',
    category: 'LEGAL_COMPLIANCE',
    url: 'https://www.dol.gov/general/aboutdol/majorlaws',
    status: 'PUBLISHED',
    sortOrder: 5,
    publishedAt: new Date('2024-03-01'),
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01'),
  },
  {
    id: 'resource-hr-contact',
    orgId: ORG_ID,
    title: 'HR Contact Information',
    description: 'Reach HR for questions about policies or workplace concerns.',
    category: 'SUPPORT_CONTACTS',
    url: 'mailto:hr@mismo.com',
    status: 'PUBLISHED',
    sortOrder: 6,
    publishedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'resource-training-1',
    orgId: ORG_ID,
    title: 'Compliance Training Portal',
    description: 'Required and optional learning modules.',
    category: 'TRAINING_DEVELOPMENT',
    url: 'https://www.osha.gov/education-center',
    status: 'PUBLISHED',
    sortOrder: 7,
    publishedAt: new Date('2024-04-01'),
    createdAt: new Date('2024-04-01'),
    updatedAt: new Date('2024-04-01'),
  },
];

export const mockEmergencyHotlines: import('@/types').EmergencyHotline[] = [
  {
    id: 'hotline-eap',
    orgId: ORG_ID,
    name: 'Employee Assistance Program',
    phone: '1-800-555-HELP',
    description: 'Confidential counseling and support services',
    status: 'PUBLISHED',
    sortOrder: 1,
  },
  {
    id: 'hotline-ethics',
    orgId: ORG_ID,
    name: 'Ethics Hotline',
    phone: '1-800-555-ETHICS',
    description: 'Report ethical concerns anonymously',
    status: 'PUBLISHED',
    sortOrder: 2,
  },
  {
    id: 'hotline-crisis',
    orgId: ORG_ID,
    name: 'Crisis Support Line',
    phone: '988',
    description: 'National Suicide & Crisis Lifeline',
    status: 'PUBLISHED',
    sortOrder: 3,
  },
];

export const mockPolicyAcknowledgements: PolicyAcknowledgement[] = [
  { policyId: 'policy-1', userId: 'user-emp-1', acknowledgedAt: new Date('2024-01-16') },
  { policyId: 'policy-2', userId: 'user-emp-2', acknowledgedAt: new Date('2024-02-02') },
  {
    policyId: 'policy-1',
    userId: 'user-emp-3',
    acknowledgedAt: new Date('2024-01-18'),
    outcome: 'REQUEST_CLARIFICATION',
  },
];

export const mockAuditLogs: AuditLogEntry[] = [
  {
    id: 'audit-seed-1',
    orgId: ORG_ID,
    recordType: 'User',
    recordId: 'user-emp-1',
    field: 'location',
    oldValue: 'HQ',
    newValue: 'Warehouse B',
    actorUserId: 'user-admin-1',
    createdAt: new Date('2024-02-01'),
    reason: 'Org chart update',
  },
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

  const yesResponsesNeedingReview = mockPromptResponses.filter(
    (r) => r.answer === 'HAS_ISSUE' && !r.reviewedAt && r.needsReview !== false
  ).length;
  const unansweredPromptDeliveries = mockPromptDeliveries.filter((d) => d.status === 'PENDING').length;
  const reportsNeedingClarification = mockReports.filter((r) => r.status === 'NEEDS_INFO').length;
  const activeEmployees = mockUsers.filter((u) => u.role === 'EMPLOYEE' && u.status === 'active');
  const requiredPolicies = mockPolicies.filter((p) => p.status === 'PUBLISHED' && p.acknowledgmentRequired);
  const totalRequiredAcks = activeEmployees.length * requiredPolicies.length;
  const memoAcknowledgementsPending = Math.max(0, totalRequiredAcks - mockPolicyAcknowledgements.length);
  const memosNeedingClarification = mockPolicyAcknowledgements.filter((a) => a.outcome === 'REQUEST_CLARIFICATION').length;
  const actionRequiredTotal =
    yesResponsesNeedingReview +
    unansweredPromptDeliveries +
    activeInvestigations +
    reportsNeedingClarification +
    memoAcknowledgementsPending +
    memosNeedingClarification;

  const openCaseRegisterCount = mockReports.filter((r) => {
    if (['RESOLVED', 'CLOSED'].includes(r.status)) return false;
    if (!r.investigationId) return true;
    const inv = mockInvestigations.find((i) => i.id === r.investigationId);
    return inv?.status !== 'OPEN';
  }).length;

  return {
    criticalReports,
    activeInvestigations,
    needsAssignment,
    atRiskEmployees,
    scheduledMemos,
    activeCampaigns,
    yesResponsesNeedingReview,
    unansweredPromptDeliveries,
    reportsNeedingClarification,
    memoAcknowledgementsPending,
    memosNeedingClarification,
    actionRequiredTotal,
    openCaseRegisterCount,
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
    INCIDENT: 'Incident Query',
    TEAM_DYNAMIC: 'Team Dynamic Check-In',
    MONTHLY_CHECKIN: 'Monthly Health Check',
    CUSTOM: 'Company-made',
  };
  return labels[type] || type;
}
