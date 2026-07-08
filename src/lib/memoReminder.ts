import type { Policy, PolicyAcknowledgement, User } from '@/types';
import { formatDate } from '@/lib/utils';

export function getMemoUnacknowledgedEmployees(
  policyId: string,
  policy: Policy | undefined,
  users: User[],
  acknowledgements: PolicyAcknowledgement[]
): User[] {
  if (!policy?.acknowledgmentRequired || policy.status !== 'PUBLISHED') return [];
  return users.filter(
    (u) =>
      u.role === 'EMPLOYEE' &&
      u.status === 'active' &&
      !acknowledgements.some((a) => a.policyId === policyId && a.userId === u.id)
  );
}

export function buildMemoReminderContent(policy: Policy): {
  subject: string;
  emailBody: string;
  smsBody: string;
  reason: string;
} {
  const dueLine = policy.completionDueDate
    ? `Please read and acknowledge by ${formatDate(policy.completionDueDate)}.`
    : 'Please read and acknowledge when you can.';

  const reason = `You have not yet acknowledged the memo "${policy.title}" in the employee portal.`;

  const emailBody = `Hello,

You are receiving this email because our records show you have not yet acknowledged the company memo "${policy.title}".

${dueLine}

Log in to the employee portal to read the memo and confirm you have read it. If you have questions, contact HR.

Thank you,
Human Resources`;

  const smsBody = `HR reminder: Please acknowledge the company memo "${policy.title}" in the employee portal. ${policy.completionDueDate ? `Due ${formatDate(policy.completionDueDate)}.` : ''} Contact HR with questions.`;

  return {
    subject: `Reminder: ${policy.title}`,
    emailBody,
    smsBody,
    reason,
  };
}

/** Format stored nudge message for admin history display. */
export function formatNudgeMessageForDisplay(channel: 'EMAIL' | 'SMS' | 'MANUAL', message: string): string {
  if (channel === 'EMAIL' && message.startsWith('Subject:')) {
    return message;
  }
  return message;
}
