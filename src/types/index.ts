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
 | 'PENDING_WAGE_HOUR_REVIEW'
 | 'PAYROLL_EXPEDITED'
 | 'RESOLVED' 
 | 'CLOSED';

/** Structured case classification for filtering, analytics, and workflows */
export type CaseType =
 | 'WORKPLACE_INVESTIGATION'
 | 'WAGE_HOUR'
 | 'ETHICS_COMPLAINT'
 | 'SAFETY_CONCERN'
 | 'ACCOMMODATION_REQUEST';

export type WageHourIssueType =
 | 'INCORRECT_PAY'
 | 'MISSING_HOURS'
 | 'OVERTIME'
 | 'BREAK_MEAL'
 | 'CLASSIFICATION'
 | 'BONUS_COMMISSION'
 | 'BENEFIT_CALCULATION'
 | 'PAYROLL_DEDUCTION'
 | 'FINAL_PAY'
 | 'REIMBURSEMENT'
 | 'OTHER';

export type WageHourPreferredResolution =
 | 'CLARIFICATION'
 | 'PAYROLL_CORRECTION'
 | 'MEETING'
 | 'HR_REVIEW'
 | 'CONFIDENTIAL_REVIEW';

export interface WageHourAttachment {
 id: string;
 fileName: string;
 mimeType: string;
 dataUrl: string;
 uploadedAt: Date;
}

export interface WageHourIntakeData {
 issueTypes: WageHourIssueType[];
 concernDescription: string;
 payPeriods?: string;
 approximateDates?: string;
 managerInvolved?: string;
 departmentLocation?: string;
 amountDisputed?: string;
 preferredResolution?: WageHourPreferredResolution;
 attachments?: WageHourAttachment[];
 submittedAt?: Date;
}

/** Logged when employee selects "No" on wage/hour screening - no case created */
export interface WageHourScreeningAcknowledgement {
 id: string;
 orgId: string;
 userId: string;
 hasConcern: false;
 acknowledgedAt: Date;
}

// Investigation Status
export type InvestigationStatus = 'OPEN' | 'CLOSED';

/** Admin workflow after a case is linked to an investigation record */
export type InvestigationWorkflowPhase = 'QUEUED' | 'IN_PROGRESS' | 'AWAITING_OUTCOME_ACK';

/** How the employee asked HR to follow up once an investigator picks up the case */
export type InvestigationEmployeeContactPreference =
 | 'IN_APP_MESSAGE'
 | 'PHONE_CALL'
 | 'EMAIL'
 | 'IN_PERSON';

/** Enterprise investigation progress stages (guided workflow) */
export type InvestigationStage =
 | 'INTAKE_RECEIVED'
 | 'PENDING_REVIEW'
 | 'ASSIGNED'
 | 'IN_PROGRESS'
 | 'EMPLOYEE_FOLLOW_UP'
 | 'EVIDENCE_REVIEW'
 | 'FINDINGS_DRAFTED'
 | 'OUTCOME_PENDING'
 | 'CLOSED';

export type InvestigationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ReportSourceType =
 | 'SELF_REPORTED'
 | 'EMPLOYEE_PROMPT_RESPONSE'
 | 'OSHA_PROMPT'
 | 'WAGE_HOUR_PROMPT'
 | 'ANONYMOUS_HOTLINE'
 | 'HR_SUBMITTED'
 | 'SUPERVISOR_SUBMITTED'
 | 'COMPLIANCE_AUDIT'
 | 'SYSTEM_TRIGGERED';

export type InvestigationPersonRole =
 | 'REPORTING_PARTY'
 | 'REPORTED_AGAINST'
 | 'WITNESS'
 | 'HR_REPRESENTATIVE'
 | 'INVESTIGATOR'
 | 'EXTERNAL_PARTY';

export interface InvestigationPerson {
 id: string;
 role: InvestigationPersonRole;
 userId?: string;
 externalName?: string;
 addedAt: Date;
 addedByUserId?: string;
}

export interface InvestigationStageEvent {
 stage: InvestigationStage;
 enteredAt: Date;
 enteredByUserId: string;
 ownerId?: string;
 note?: string;
}

export type OutcomeClassification =
 | 'SUBSTANTIATED'
 | 'PARTIALLY_SUBSTANTIATED'
 | 'UNSUBSTANTIATED'
 | 'INCONCLUSIVE'
 | 'POLICY_VIOLATION_CONFIRMED'
 | 'CONDUCT_CONCERN'
 | 'COACHING_ISSUED'
 | 'TERMINATION'
 | 'WARNING_ISSUED'
 | 'TRAINING_ASSIGNED'
 | 'RESOLVED_INFORMALLY';

export type InvestigationNoteType =
 | 'PRIVATE_HR'
 | 'SHARED'
 | 'INTERVIEW'
 | 'LEGAL'
 | 'AI_SUMMARY'
 | 'OUTCOME_RATIONALE'
 | 'FOLLOW_UP';

export type InvestigationEvidenceType =
 | 'DOCUMENT'
 | 'EMAIL'
 | 'SLACK'
 | 'SCREENSHOT'
 | 'PDF'
 | 'AUDIO'
 | 'VIDEO'
 | 'WRITTEN_STATEMENT'
 | 'OTHER';

export interface InvestigationEvidenceRecord {
 id: string;
 type: InvestigationEvidenceType;
 fileName: string;
 mimeType: string;
 dataUrl?: string;
 description?: string;
 sourceType: 'UPLOAD' | 'EMAIL_IMPORT' | 'SYSTEM';
 uploadedAt: Date;
 uploadedByUserId: string;
 preserved: boolean;
 /** AI-guided collection prompt label, if applicable */
 promptLabel?: string;
}

export type ResponseRequestMethod =
 | 'IN_APP'
 | 'WRITTEN_STATEMENT'
 | 'ATTORNEY_STATEMENT'
 | 'EMAIL'
 | 'MEETING';

export type ResponseRequestStatus =
 | 'DRAFT'
 | 'SENT'
 | 'VIEWED'
 | 'SUBMITTED'
 | 'OVERDUE'
 | 'DECLINED';

export interface InvestigationResponseRequest {
 id: string;
 partyUserId: string;
 partyRole: InvestigationPersonRole;
 method: ResponseRequestMethod;
 status: ResponseRequestStatus;
 deadline?: Date;
 sentAt?: Date;
 viewedAt?: Date;
 submittedAt?: Date;
 message?: string;
 /** Employee's written response when submitted in-app */
 responseText?: string;
 createdAt: Date;
 createdByUserId: string;
}

export type CorrectiveActionType =
 | 'COACHING'
 | 'WARNING'
 | 'SUSPENSION'
 | 'TERMINATION'
 | 'TRAINING'
 | 'MEDIATION'
 | 'REASSIGNMENT'
 | 'MONITORING'
 | 'POLICY_UPDATE'
 | 'NO_ACTION';

export type CorrectiveActionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'CANCELLED';

export interface InvestigationCorrectiveAction {
 id: string;
 type: CorrectiveActionType;
 status: CorrectiveActionStatus;
 assigneeUserId: string;
 subjectUserId?: string;
 description: string;
 deadline?: Date;
 completedAt?: Date;
 createdAt: Date;
 createdByUserId: string;
}

export type FollowUpType =
 | 'RETALIATION_CHECK'
 | 'WELLNESS'
 | 'MANAGER_REVIEW'
 | 'CORRECTIVE_VERIFY'
 | 'GENERAL';

export type FollowUpStatus = 'SCHEDULED' | 'COMPLETE' | 'OVERDUE' | 'CANCELLED';

export interface InvestigationFollowUp {
 id: string;
 type: FollowUpType;
 scheduledFor: Date;
 status: FollowUpStatus;
 assigneeUserId: string;
 notes?: string;
 completedAt?: Date;
 concernLogged?: boolean;
 createdAt: Date;
}

export type InvestigationChecklistItemStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'NA';

export interface InvestigationChecklistItem {
 id: string;
 label: string;
 status: InvestigationChecklistItemStatus;
 required: boolean;
 notes?: string;
 assignedToUserId?: string;
 completedAt?: Date;
 completedByUserId?: string;
 autoActionHint?: string;
}

export interface InvestigationChecklistStage {
 id: string;
 label: string;
 items: InvestigationChecklistItem[];
}

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
 sentAt?: Date;
 viewedAt?: Date;
 pinned?: boolean;
 /** true = agrees information is correct / resolution; false = does not agree */
 employeeAgreed?: boolean;
 noteType?: InvestigationNoteType;
 taggedUserIds?: string[];
 linkedEvidenceIds?: string[];
}

// Nudge Channel
export type NudgeChannel = 'EMAIL' | 'SMS' | 'MANUAL';

// Nudge Context Type
export type NudgeContextType =
 | 'PROMPT_REMINDER'
 | 'AT_RISK_OUTREACH'
 | 'MEMO_REMINDER'
 | 'CASE_REPORT_REMINDER'
 | 'MANUAL_OUTREACH';

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
 | 'WAGE_HOUR_SCREENING'
 | 'WAGE_HOUR_SUBMITTED'
 | 'PAYROLL_EXPEDITED'
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
 /** Org-defined role / job titles shown in employee Role dropdowns (in addition to system roles). */
 customRoles?: string[];
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
 /** Optional org-defined job title / custom role label (shown when set). */
 jobTitle?: string;
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
 /** When true, employees see a pay/compensation screening question after the main check-in answer, before the response is saved */
 includeFinancialQuestion?: boolean;
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
 /** When true (default for HAS_ISSUE), item appears in HR review queue until reviewed */
 needsReview?: boolean;
 reviewedByUserId?: string;
 reviewedAt?: Date;
 /** Set when the employee completes the final submit step; response is treated as locked for editing */
 finalizedAt?: Date;
}

// Report
export interface Report {
 id: string;
 orgId: string;
 createdByUserId?: string;
 isAnonymous: boolean;
 sourcePromptId?: string;
 sourcePromptResponseId?: string;
 /** How the report entered the system */
 reportSourceType?: ReportSourceType;
 /** Structured case type for admin filtering and workflows */
 caseType?: CaseType;
 /** Human-readable case reference (e.g. IR-8821, WH-2026-0012) */
 referenceNumber?: string;
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
 /** Wage & hour structured intake (employee portal) */
 wageHourIntake?: WageHourIntakeData;
 needsExtendedWageHourIntake?: boolean;
 wageHourIntakeCompletedAt?: Date;
 /** Payroll memo quick-report: no employee details; admin must resolve within SLA */
 expeditedPayroll?: boolean;
 payrollSlaDueAt?: Date;
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
 /** Human-readable investigation reference (e.g. INV-2024-001) */
 referenceNumber?: string;
 status: InvestigationStatus;
 ownerId: string;
 linkedReportIds: string[];
 /** Primary category derived from linked reports (admin may override later) */
 category?: ReportCategory;
 severity?: ReportSeverity;
 witnessUserIds?: string[];
 /** Free-text external witnesses (names / orgs) */
 witnessExternal?: string[];
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
 /** Guided workflow stage */
 stage?: InvestigationStage;
 stageHistory?: InvestigationStageEvent[];
 priority?: InvestigationPriority;
 investigationType?: string;
 reportSourceType?: ReportSourceType;
 linkedPromptId?: string;
 linkedPromptResponseId?: string;
 /** Categorized persons involved (preferred over legacy subject/witness arrays) */
 persons?: InvestigationPerson[];
 /** @deprecated Legacy checklist - use workflow modules instead */
 checklistStages?: InvestigationChecklistStage[];
 outcomeClassification?: OutcomeClassification;
 outcomeViewedAt?: Date;
 riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
 departmentId?: string;
 /** Structured evidence with chain-of-custody metadata */
 evidenceRecords?: InvestigationEvidenceRecord[];
 /** Party response requests (not checklist items) */
 responseRequests?: InvestigationResponseRequest[];
 findingsRationale?: string;
 policyAnalysisNotes?: string;
 linkedPolicyIds?: string[];
 /** Page 2 - counsel or legal team involvement */
 legalInvolved?: boolean;
 legalInvolvementNotes?: string;
 correctiveActions?: InvestigationCorrectiveAction[];
 followUps?: InvestigationFollowUp[];
 finalFindingsReport?: string;
 nonRetaliationSentAt?: Date;
 /** Simplified 3-page workflow progress */
 workflowPagesCompleted?: {
 intake?: boolean;
 gathering?: boolean;
 outcome?: boolean;
 };
 /** Page 1 - initial contact / triage notes */
 initialContactNotes?: string;
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
 policyId?: string;
 reportId?: string;
 /** Short reason label shown in admin history (e.g. memo title, case id) */
 relatedLabel?: string;
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
 /** Employee note when requesting clarification on a memo */
 clarificationNote?: string;
}

/** Admin-managed library item surfaced in the employee Resources portal */
export type CompanyResourceCategory =
 | 'REQUIRED_MEMO'
 | 'EMPLOYEE_HANDBOOK'
 | 'POLICIES_PROCEDURES'
 | 'SAFETY_SECURITY'
 | 'WELLNESS'
 | 'LEGAL_COMPLIANCE'
 | 'SUPPORT_CONTACTS'
 | 'TRAINING_DEVELOPMENT'
 | 'EMERGENCY_HOTLINE';

export interface CompanyResource {
 id: string;
 orgId: string;
 title: string;
 description?: string;
 category: CompanyResourceCategory;
 url?: string;
 phone?: string;
 status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
 sortOrder?: number;
 publishedAt?: Date;
 createdAt: Date;
 updatedAt: Date;
}

export interface EmergencyHotline {
 id: string;
 orgId: string;
 name: string;
 phone: string;
 description?: string;
 status: 'PUBLISHED' | 'ARCHIVED';
 sortOrder?: number;
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

/** Append-only audit trail for admin-visible configuration and HR record edits */
export interface AuditLogEntry {
 id: string;
 orgId: string;
 recordType: string;
 recordId: string;
 field?: string;
 oldValue?: string;
 newValue?: string;
 actorUserId: string;
 createdAt: Date;
 reason?: string;
}

// Dashboard Counts
export interface DashboardCounts {
 criticalReports: number;
 activeInvestigations: number;
 needsAssignment: number;
 atRiskEmployees: number;
 scheduledMemos: number;
 activeCampaigns: number;
 /** HAS_ISSUE responses not yet marked reviewed */
 yesResponsesNeedingReview: number;
 /** Deliveries still pending (unanswered prompts) */
 unansweredPromptDeliveries: number;
 /** Case register items in NEEDS_INFO (clarification / follow-up) */
 reportsNeedingClarification: number;
 /** Required memo acknowledgements not yet recorded */
 memoAcknowledgementsPending: number;
 /** Memo acknowledgements where employee requested clarification */
 memosNeedingClarification: number;
 /** Distinct actionable queue items for command center (deduped sum) */
 actionRequiredTotal: number;
 /** Formal open investigations plus Yes check-ins under HR review (deduped) */
 openInvestigationWorkload: number;
 /** Open case register rows (excl. cases under open investigation) */
 openCaseRegisterCount: number;
}

// Employee Engagement
export interface EmployeeEngagement {
 userId: string;
 lastResponseAt?: Date;
 responseRate30d: number;
 pendingPrompts: number;
 isAtRisk: boolean;
}

/** Billing cadence for client companies */
export type ClientBillingIncrement = 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | '';

export type ClientPaymentMode = 'INVOICE' | 'ACH' | 'CARD' | 'CHECK' | 'OTHER' | '';

/** Platform client company profile (JeStar / Mismo back-office). */
export interface ClientCompany {
  id: string;
  /** Owning ops org that manages this client record */
  managedByOrgId: string;
  /** Linked tenant org when provisioned (optional) */
  linkedOrgId?: string;
  companyName: string;
  address1: string;
  address2: string;
  city: string;
  /** Two-letter state abbreviation (e.g. CA) */
  state: string;
  zip: string;
  /** Defaults to USA */
  country: string;
  telephone: string;
  fax: string;
  tollFree: string;
  website: string;
  employeeCount?: number;
  officeCount?: number;
  jestarAccountRep: string;
  signupDate?: Date;
  activeDate?: Date;
  initialSetupAmount?: number;
  initialSetupPaidDate?: Date;
  monthlySupportFee?: number;
  monthlyEmployeeRate?: number;
  billingIncrement: ClientBillingIncrement;
  paymentMode: ClientPaymentMode;
  /** Optional client portal login (no password rules enforced here) */
  clientLoginEmail?: string;
  clientLoginPassword?: string;
  inactiveDate?: Date;
  inactiveReason: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientContact {
  id: string;
  clientId: string;
  name: string;
  title: string;
  department: string;
  email: string;
  /** Main / office phone */
  phone: string;
  officePhone: string;
  directPhone: string;
  extension: string;
  cellPhone: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientDocument {
  id: string;
  clientId: string;
  title: string;
  fileName: string;
  notes: string;
  uploadedByUserId?: string;
  uploadedAt: Date;
}

export interface ClientNote {
  id: string;
  clientId: string;
  body: string;
  createdByUserId: string;
  createdByName: string;
  createdAt: Date;
}

export interface ClientPayment {
  id: string;
  clientId: string;
  amount: number;
  paidAt: Date;
  method: string;
  reference: string;
  notes: string;
  createdAt: Date;
}

/** Customer support history line items on the client summary. */
export interface ClientSupportEntry {
  id: string;
  clientId: string;
  body: string;
  createdByUserId: string;
  createdByName: string;
  createdAt: Date;
}

