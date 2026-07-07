import type { Report } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { formatCaseReference } from '@/lib/caseTypes';
import { formatDate, employeeIncidentReportHeadline } from '@/lib/utils';
import type { WageHourIntakeData } from '@/types';

interface EmployeeIntakeReadOnlyProps {
 report: Report;
 organizationName?: string;
}

function WageHourIntakeFields({ intake }: { intake: WageHourIntakeData }) {
 const rows: { label: string; value?: string }[] = [
 { label: 'Issue types', value: intake.issueTypes?.join(', ') },
 { label: 'Concern description', value: intake.concernDescription },
 { label: 'Pay periods', value: intake.payPeriods },
 { label: 'Approximate dates', value: intake.approximateDates },
 { label: 'Manager involved', value: intake.managerInvolved },
 { label: 'Department / location', value: intake.departmentLocation },
 { label: 'Amount disputed', value: intake.amountDisputed },
 { label: 'Preferred resolution', value: intake.preferredResolution },
 ];
 return (
 <dl className="space-y-3 text-sm">
 {rows.map((row) =>
 row.value?.trim() ? (
 <div key={row.label}>
 <dt className="text-xs uppercase text-[var(--color-text-muted)]">{row.label}</dt>
 <dd className="mt-0.5 whitespace-pre-wrap">{row.value}</dd>
 </div>
 ) : null
 )}
 </dl>
 );
}

/** Admin read-only view of employee-submitted intake (EI / wage-hour form). */
export function EmployeeIntakeReadOnly({ report, organizationName }: EmployeeIntakeReadOnlyProps) {
 const isWageHour = report.caseType === 'WAGE_HOUR' || Boolean(report.wageHourIntake);
 const completedAt = isWageHour ? report.wageHourIntakeCompletedAt : report.incidentIntakeCompletedAt;

 return (
 <Card className="mismo-card border border-[var(--color-border-200)]">
 <CardContent className="p-5 space-y-4">
 <div>
 <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
 {isWageHour ? 'Employee wage & hour intake' : 'Employee incident form (EI)'}
 </p>
 <p className="font-semibold text-[var(--color-text-primary)] mt-1">
 {employeeIncidentReportHeadline(report)}
 </p>
 <p className="text-xs font-mono text-[var(--color-text-secondary)] mt-1">
 Case reference: {formatCaseReference(report)}
 </p>
 {organizationName && (
 <p className="text-xs text-[var(--color-text-muted)] mt-1">{organizationName}</p>
 )}
 </div>

 <div className="grid sm:grid-cols-2 gap-3 text-sm border-t border-[var(--color-border-200)] pt-4">
 <div>
 <p className="text-xs text-[var(--color-text-muted)]">Form status</p>
 <p className="font-medium">{completedAt ? 'Complete' : 'Pending'}</p>
 </div>
 {completedAt && (
 <div>
 <p className="text-xs text-[var(--color-text-muted)]">Completed</p>
 <p>{formatDate(completedAt)}</p>
 </div>
 )}
 <div>
 <p className="text-xs text-[var(--color-text-muted)]">Report opened</p>
 <p>{formatDate(report.createdAt)}</p>
 </div>
 {report.incidentAt && (
 <div>
 <p className="text-xs text-[var(--color-text-muted)]">Incident date</p>
 <p>{formatDate(report.incidentAt)}</p>
 </div>
 )}
 </div>

 {isWageHour && report.wageHourIntake ? (
 <WageHourIntakeFields intake={report.wageHourIntake} />
 ) : (
 <dl className="space-y-3 text-sm">
 <div>
 <dt className="text-xs uppercase text-[var(--color-text-muted)]">What happened</dt>
 <dd className="mt-0.5 whitespace-pre-wrap">{report.description || '-'}</dd>
 </div>
 {report.peopleInvolved && (
 <div>
 <dt className="text-xs uppercase text-[var(--color-text-muted)]">People involved</dt>
 <dd className="mt-0.5">{report.peopleInvolved}</dd>
 </div>
 )}
 {report.location && (
 <div>
 <dt className="text-xs uppercase text-[var(--color-text-muted)]">Location</dt>
 <dd className="mt-0.5">{report.location}</dd>
 </div>
 )}
 </dl>
 )}

 <p className="text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border-200)] pt-3">
 Read-only copy of what the employee submitted. Edits here are not applied to the employee record; use internal
 notes on the investigation if the narrative needs correction.
 </p>
 </CardContent>
 </Card>
 );
}
