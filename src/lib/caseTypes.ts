import type { CaseType, WageHourIssueType, WageHourPreferredResolution } from '@/types';

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  WORKPLACE_INVESTIGATION: 'Workplace investigation',
  WAGE_HOUR: 'Wage & hour concern',
  ETHICS_COMPLAINT: 'Ethics complaint',
  SAFETY_CONCERN: 'Safety concern',
  ACCOMMODATION_REQUEST: 'Accommodation request',
};

export const WAGE_HOUR_ISSUE_LABELS: Record<WageHourIssueType, string> = {
  INCORRECT_PAY: 'Incorrect pay',
  MISSING_HOURS: 'Missing hours',
  OVERTIME: 'Overtime concern',
  BREAK_MEAL: 'Break / meal period concern',
  CLASSIFICATION: 'Classification concern',
  BONUS_COMMISSION: 'Bonus / commission concern',
  BENEFIT_CALCULATION: 'Benefit calculation concern',
  PAYROLL_DEDUCTION: 'Payroll deduction concern',
  FINAL_PAY: 'Final pay concern',
  REIMBURSEMENT: 'Reimbursement concern',
  OTHER: 'Other',
};

export const WAGE_HOUR_RESOLUTION_LABELS: Record<WageHourPreferredResolution, string> = {
  CLARIFICATION: 'Clarification',
  PAYROLL_CORRECTION: 'Payroll correction',
  MEETING: 'Meeting request',
  HR_REVIEW: 'HR review',
  CONFIDENTIAL_REVIEW: 'Confidential review',
};

export const WAGE_HOUR_SCREENING_QUESTION =
  'After reviewing your most recent paycheck, do you have an issue, question, and/or dispute regarding the amount of your pay, your deductions, your hours, your overtime, your classification, and/or how your benefits are calculated?';

export const WAGE_HOUR_RETALIATION_NOTE =
  'Note: You will not be retaliated against for reporting an actual or potential violation of your employment rights. Retaliation is against the law and will not be tolerated by this company.';

export const WAGE_HOUR_YES_CONFIRMATION_BODY =
  'We are prepared to fully investigate any and all acts and circumstances surrounding your response. However, if you selected "YES" by mistake, please go back to the prior screen and submit your intended response. If your intended response is "YES" please submit now.';

export const PAYROLL_EXPEDITED_SLA_HOURS = 24;

export const PAYROLL_EXPEDITED_QUICK_LABEL = "There's an issue with payroll";

export const PAYROLL_EXPEDITED_EMPLOYEE_MESSAGE =
  'Your payroll issue has been flagged for administrator review. No additional details are required. An administrator will address this within 24 hours. Retaliation for reporting pay concerns is prohibited.';

export const PAYROLL_MEMO_CHOICE_HEADING = 'How would you like to report this payroll concern?';

export const PAYROLL_MEMO_QUICK_DESCRIPTION =
  'Flag a payroll issue for administrator review without providing additional details. An administrator will address this within 24 hours.';

export const PAYROLL_MEMO_FULL_DESCRIPTION =
  'Complete the wage & hour report sheet with details about your pay, hours, deductions, or other compensation concerns.';

export function getPayrollExpeditedSlaLabel(report: {
  payrollSlaDueAt?: Date;
  status: string;
  createdAt: Date;
}): { label: string; overdue: boolean; urgent: boolean } {
  if (!['PAYROLL_EXPEDITED'].includes(report.status)) {
    return { label: '', overdue: false, urgent: false };
  }
  const due =
    report.payrollSlaDueAt instanceof Date
      ? report.payrollSlaDueAt
      : report.payrollSlaDueAt
        ? new Date(report.payrollSlaDueAt)
        : new Date(new Date(report.createdAt).getTime() + PAYROLL_EXPEDITED_SLA_HOURS * 60 * 60 * 1000);
  const now = new Date();
  if (now.getTime() > due.getTime()) {
    const hours = Math.max(1, Math.ceil((now.getTime() - due.getTime()) / (60 * 60 * 1000)));
    return { label: `Payroll SLA overdue by ${hours}h`, overdue: true, urgent: true };
  }
  const hoursLeft = Math.max(1, Math.ceil((due.getTime() - now.getTime()) / (60 * 60 * 1000)));
  return {
    label: `Administrator action due within ${hoursLeft}h`,
    overdue: false,
    urgent: hoursLeft <= 8,
  };
}

export const WAGE_HOUR_CONFIRMATION_MESSAGE =
  'Your concern has been securely submitted and routed for review. Retaliation for reporting wage or compensation concerns is prohibited.';

export function formatCaseReference(report: { id: string; referenceNumber?: string; caseType?: CaseType }): string {
  if (report.referenceNumber) return report.referenceNumber;
  const num = report.id.replace(/^report-/, '').toUpperCase();
  const prefix = report.caseType === 'WAGE_HOUR' ? 'WH' : 'CAS';
  return num.startsWith(`${prefix}-`) || num.startsWith('IR-') ? num.replace(/^IR-/, 'CAS-') : `${prefix}-${num}`;
}

export function getReportStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    NEW: 'New — not yet reviewed',
    TRIAGED: 'Initial review complete',
    ASSIGNED: 'Assigned',
    IN_REVIEW: 'In review',
    NEEDS_INFO: 'Needs info from employee',
    PENDING_WAGE_HOUR_REVIEW: 'Pending wage & hour review',
    PAYROLL_EXPEDITED: 'Payroll expedited — admin action due',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
  };
  return labels[status] ?? status.replace(/_/g, ' ');
}

/** Admin action: HR has read the report and decided what happens next (not the same as closing it). */
export const MARK_INITIAL_REVIEW_ACTION = 'Mark initial review complete';

export const MARK_INITIAL_REVIEW_TOAST = 'Initial review recorded. Case stays open until resolved or assigned.';

export const ASSIGN_CASE_TO_ME_ACTION = 'Take ownership';

export function inferCaseType(category: string, caseType?: CaseType): CaseType {
  if (caseType) return caseType;
  if (category === 'WAGE_HOURS') return 'WAGE_HOUR';
  if (category === 'SAFETY') return 'SAFETY_CONCERN';
  return 'WORKPLACE_INVESTIGATION';
}
