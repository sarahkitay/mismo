// User Role
export type UserRole = 'EMPLOYEE' | 'HR' | 'MANAGER' | 'ADMIN' | 'SUPER_ADMIN' | 'CLIENT';

// User Status
export type UserStatus = 'active' | 'inactive';

// Prompt Types
export type PromptType = 'INCIDENT' | 'TEAM_DYNAMIC' | 'MONTHLY_CHECKIN' | 'CUSTOM';

// Prompt Cadence
export type PromptCadence = 'ONCE' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';

// Prompt Audience
export type PromptAudience = 'ALL' | 'DEPARTMENT' | 'USER_LIST';

// Prompt Status
export type PromptStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'ARCHIVED';

// Delivery Status
export type DeliveryStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED';

// Prompt Answer
export type PromptAnswer = 'NO_ISSUE' | 'HAS_ISSUE';

// Report Category
export type ReportCategory = 
  | 'HARASSMENT' 
  | 'THEFT' 
  | 'SAFETY' 
  | 'DISCRIMINATION' 
  | 'WAGE_HOURS' 
  | 'RETALIATION' 
  | 'OTHER';

// Report Severity
export type ReportSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// Report Status
export type ReportStatus = 
  | 'NEW' 
  | 'TRIAGED' 
  | 'ASSIGNED' 
  | 'IN_REVIEW' 
  | 'NEEDS_INFO' 
  | 'RESOLVED' 
  | 'CLOSED';

// Investigation Status
export type InvestigationStatus = 'OPEN' | 'CLOSED';

/** Admin workflow after a case is linked to an investigation record */
export type InvestigationWorkflowPhase = 'QUEUED' | 'IN_PROGRESS' | 'AWAITING_OUTCOME_ACK';

/** How the employee asked HR to follow up once an investigator picks up the case */
export type InvestigationEmployeeContactPreference = 'IN_APP_MESSAGE' | 'PHONE_CALL';

export interface InvestigationAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  /** Demo/local persistence only */
  dataUrl: string;
}

/** Internal vs employee-visible journal entries on an investigation */
export interface InvestigationNote {
  id: string;
  visibility: 'INTERNAL' | 'EMPLOYEE';
  body: string;
  createdAt: Date;
  createdByUserId: string;
  attachments?: InvestigationAttachment[];
  /** When visibility is EMPLOYEE: optional e-sign style confirmation */
  requiresEmployeeSignature?: boolean;
  employeeSignedAt?: Date;
  /** true = agrees information is correct / resolution; false = does not agree */
  employeeAgreed?: boolean;
}

// Nudge Channel
export type NudgeChannel = 'EMAIL' | 'SMS' | 'MANUAL';

// Nudge Context Type
export type NudgeContextType = 'PROMPT_REMINDER' | 'AT_RISK_OUTREACH';

// Activity Event Type
export type ActivityEventType = 
  | 'PROMPT_CREATED'
  | 'PROMPT_SENT'
  | 'PROMPT_RESPONSE'
  | 'REPORT_CREATED'
  | 'REPORT_ASSIGNED'
  | 'REPORT_STATUS_CHANGED'
  | 'INVESTIGATION_CREATED'
  | 'INVESTIGATION_UPDATED'
  | 'NUDGE_SENT'
  | 'EXPORT_PDF'
  | 'EXPORT_CSV';

// Contact Method
export type ContactMethod = 'EMAIL' | 'PHONE' | 'IN_APP';

// Metric Window
export type MetricWindow = '7d' | '30d' | '90d';

// Organization Settings
export interface OrgSettings {
  allowAnonymousReports: boolean;
  enableSMS: boolean;
  enableEmail: boolean;
  showRecentActivityOnDashboard: boolean;
  showReportsRequiringAttentionOnDashboard: boolean;
  thresholds: {
    atRiskNoResponseDays: number;
    atRiskMinResponseRate: number;
    criticalSLAHours: number;
  };
}

// Organization
export interface Organization {
  id: string;
  name: string;
  settings: OrgSettings;
  createdAt: Date;
  updatedAt: Date;
}

// User
export interface User {
  id: string;
  orgId: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  /** Company-visible employee / badge number (distinct from system `id`) */
  employeeId?: string;
  /** Primary work location label (site, office, region) */
  location?: string;
  /** Archive / retention window start (e.g. when moved off active roster) */
  archiveStartDate?: Date;
  /** Archive / retention window end */
  archiveEndDate?: Date;
  departmentId?: string;
  managerId?: string;
  hiredDate?: Date;
  state?: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Department
export interface Department {
  id: string;
  orgId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// Prompt Schedule
export interface PromptSchedule {
  cadence: PromptCadence;
  startAt: Date;
  endAt?: Date;
}

// Prompt Targeting
export interface PromptTargeting {
  audience: PromptAudience;
  departmentIds?: string[];
  userIds?: string[];
}

// Prompt
export interface Prompt {
  id: string;
  orgId: string;
  type: PromptType;
  title: string;
  description: string;
  schedule: PromptSchedule;
  targeting: PromptTargeting;
  severityOnHasIssue: ReportSeverity;
  allowAnonymousReports: boolean;
  status: PromptStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  /** When true, HR can send responses to payroll team */
  routeToPayroll?: boolean;
}

// Prompt Delivery
export interface PromptDelivery {
  id: string;
  orgId: string;
  promptId: string;
  userId: string;
  status: DeliveryStatus;
  deliveredAt: Date;
  dueAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Prompt Response
export interface PromptResponse {
  id: string;
  orgId: string;
  promptId: string;
  promptDeliveryId: string;
  userId: string;
  answer: PromptAnswer;
  submittedAt: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Report
export interface Report {
  id: string;
  orgId: string;
  createdByUserId?: string;
  isAnonymous: boolean;
  sourcePromptId?: string;
  sourcePromptResponseId?: string;
  category: ReportCategory;
  severity: ReportSeverity;
  summary: string;
  description: string;
  peopleInvolved?: string;
  location?: string;
  incidentAt?: Date;
  attachments?: string[];
  status: ReportStatus;
  assignedTo?: string;
  investigationId?: string;
  preferredContactMethod?: ContactMethod;
  responsePlan?: string;
  responseActionTaken?: string;
  employeeResponseOutcome?: string;
  /** When true, employee must finish the portal intake before the case is treated as fully documented */
  needsExtendedIncidentIntake?: boolean;
  /** Set when extended intake (or full initial portal form) is complete */
  incidentIntakeCompletedAt?: Date;
  handlingLedger?: ReportHandlingEntry[];
  responseChecklist?: ReportChecklistItem[];
  ginaBuildNotes?: string;
  evidenceMetadata?: {
    lastExportedAt?: Date;
    lastExportedBy?: string;
  };
  messages?: Array<{
    id: string;
    authorUserId?: string;
    body: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export type ReportHandlingEntryType = 'PLAN' | 'ACTION_TAKEN' | 'EMPLOYEE_RESPONSE' | 'NOTE' | 'FILE';

export interface ReportHandlingEntry {
  id: string;
  type: ReportHandlingEntryType;
  text: string;
  createdAt: Date;
  createdBy?: string;
  /** For type FILE: attachment metadata */
  fileFileName?: string;
  fileSize?: number;
  /** Data URL for in-app preview/download (persisted in localStorage for demo) */
  fileDataUrl?: string;
}

export interface ReportChecklistItem {
  id: string;
  sectionId?: string;
  sectionLabel?: string;
  label: string;
  order?: number;
  completed: boolean;
  completedAt?: Date;
  completedBy?: string;
  evidenceNote?: string;
  evidenceFileFileName?: string;
  evidenceFileDataUrl?: string;
}

// Investigation
export interface Investigation {
  id: string;
  orgId: string;
  status: InvestigationStatus;
  ownerId: string;
  linkedReportIds: string[];
  openedAt: Date;
  closedAt?: Date;
  lastUpdateAt: Date;
  createdAt: Date;
  updatedAt: Date;
  workflowPhase?: InvestigationWorkflowPhase;
  pickedUpAt?: Date;
  employeePreferredContact?: InvestigationEmployeeContactPreference;
  /** Named individuals for this case; each should link to an employee profile in admin UI */
  subjectUserIds?: string[];
  notes?: InvestigationNote[];
  /** Final outcome text shared with the employee (plain text; line breaks preserved in UI) */
  outcomeSummary?: string;
  outcomeAttachment?: InvestigationAttachment;
  outcomeRequiresSignature?: boolean;
  outcomeSentAt?: Date;
  outcomeEmployeeSignedAt?: Date;
  /** Employee agrees with resolution, or does not */
  outcomeEmployeeAgreed?: boolean | null;
}

// Report Status Event
export interface ReportStatusEvent {
  id: string;
  orgId: string;
  reportId: string;
  fromStatus: ReportStatus;
  toStatus: ReportStatus;
  changedBy?: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Nudge Context
export interface NudgeContext {
  type: NudgeContextType;
  promptId?: string;
}

// Nudge
export interface Nudge {
  id: string;
  orgId: string;
  targetUserId: string;
  channel: NudgeChannel;
  message: string;
  context: NudgeContext;
  sentByAdminId?: string;
  sentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Activity Event
export interface ActivityEvent {
  id: string;
  orgId: string;
  type: ActivityEventType;
  actorUserId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// Category Breakdown
export interface CategoryBreakdown {
  [category: string]: number;
}

// Department Health Entry
export interface DepartmentHealthEntry {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reportCount: number;
}

// Department Health
export interface DepartmentHealth {
  [departmentId: string]: DepartmentHealthEntry;
}

// Metrics Snapshot
export interface MetricsSnapshot {
  id: string;
  orgId: string;
  window: MetricWindow;
  responseRate: number;
  trainingCompliance: number;
  avgResolutionTimeHours: number;
  reportsThisMonth: number;
  categoryBreakdown: CategoryBreakdown;
  departmentHealth: DepartmentHealth;
  createdAt: Date;
}

export type PolicyBodySource = 'EDITOR' | 'UPLOAD' | 'LINK';

export interface Policy {
  id: string;
  orgId: string;
  title: string;
  /** Legacy classification; new memos may set GENERAL and rely on memoCategory */
  type: 'GENERAL' | 'SAFETY' | 'CONDUCT' | 'LEGAL';
  content: string;
  /** Publish / go-live date for the memo */
  effectiveDate: Date;
  publishedAt?: Date;
  acknowledgmentRequired: boolean;
  supersededBy?: string;
  tags: string[];
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
  /** Primary memo category for search and grouping (e.g. Safety, HR, Operations) */
  memoCategory?: string;
  /** When employees must complete acknowledgement or action by */
  completionDueDate?: Date;
  bodySource?: PolicyBodySource;
  bodyAttachmentFileName?: string;
  bodyAttachmentDataUrl?: string;
  /** Reference URL when body was sourced from a link */
  bodySourceUrl?: string;
}

export type PolicyAcknowledgementOutcome = 'READ_UNDERSTOOD' | 'REQUEST_CLARIFICATION';

export interface PolicyAcknowledgement {
  policyId: string;
  userId: string;
  acknowledgedAt: Date;
  outcome?: PolicyAcknowledgementOutcome;
  /** PNG data URL captured when the employee signs in the portal */
  signatureDataUrl?: string;
}

export interface Announcement {
  id: string;
  orgId: string;
  title: string;
  body: string;
  audience: 'ALL' | 'DEPARTMENT';
  audienceDepartmentIds?: string[];
  tags: string[];
  type: 'HOLIDAY' | 'GENERAL' | 'URGENT';
  status: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED';
  publishAt?: Date;
  sentAt?: Date;
  viewsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Dashboard Counts
export interface DashboardCounts {
  criticalReports: number;
  activeInvestigations: number;
  needsAssignment: number;
  atRiskEmployees: number;
  scheduledMemos: number;
  activeCampaigns: number;
}

// Employee Engagement
export interface EmployeeEngagement {
  userId: string;
  lastResponseAt?: Date;
  responseRate30d: number;
  pendingPrompts: number;
  isAtRisk: boolean;
}
