const SLA_DAYS = 14;

export function getSlaLabel(report: {
  createdAt: Date;
  updatedAt: Date;
  status: string;
}): { label: string; overdue: boolean } {
  const created = report.createdAt instanceof Date ? report.createdAt : new Date(report.createdAt);
  const due = new Date(created.getTime() + SLA_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  if (['RESOLVED', 'CLOSED'].includes(report.status)) {
    return { label: 'Closed', overdue: false };
  }
  if (now.getTime() > due.getTime()) {
    const days = Math.floor((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
    return { label: `Overdue by ${days} day${days !== 1 ? 's' : ''}`, overdue: true };
  }
  const days = Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  return { label: `Due in ${days} day${days !== 1 ? 's' : ''}`, overdue: false };
}

export function buildHrSignOff(opts: {
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  organizationName: string;
  caseReference: string;
}): string {
  const name = `${opts.firstName ?? ''} ${opts.lastName ?? ''}`.trim() || 'Human Resources';
  const title = opts.jobTitle?.trim() || 'Human Resources';
  return [
    '',
    'Best regards,',
    name,
    title,
    opts.organizationName,
    `Case reference: ${opts.caseReference}`,
  ].join('\n');
}

export function openEmployeeMailto(email: string, subject: string, body: string): void {
  const params = new URLSearchParams();
  params.set('subject', subject);
  params.set('body', body);
  window.location.href = `mailto:${email}?${params.toString()}`;
}
