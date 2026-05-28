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

export const WAGE_HOUR_CONFIRMATION_MESSAGE =
  'Your concern has been securely submitted and routed for review. Retaliation for reporting wage or compensation concerns is prohibited.';

export function formatCaseReference(report: { id: string; referenceNumber?: string; caseType?: CaseType }): string {
  if (report.referenceNumber) return report.referenceNumber;
  const num = report.id.replace(/^report-/, '').toUpperCase();
  const prefix = report.caseType === 'WAGE_HOUR' ? 'WH' : 'CAS';
  return num.startsWith(`${prefix}-`) || num.startsWith('IR-') ? num.replace(/^IR-/, 'CAS-') : `${prefix}-${num}`;
}

export function getReportStatusLabel(status: string): string {
  if (status === 'PENDING_WAGE_HOUR_REVIEW') return 'Pending wage & hour review';
  return status.replace(/_/g, ' ');
}

export function inferCaseType(category: string, caseType?: CaseType): CaseType {
  if (caseType) return caseType;
  if (category === 'WAGE_HOURS') return 'WAGE_HOUR';
  if (category === 'SAFETY') return 'SAFETY_CONCERN';
  return 'WORKPLACE_INVESTIGATION';
}
