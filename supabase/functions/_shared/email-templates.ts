/**
 * Mismo email templates for Resend (and Auth SMTP).
 * Brand: Mismo. Never mention vendor names in copy.
 *
 * Variables use {{name}} placeholders. Call renderTemplate() to fill them.
 */

export type EmailTemplateId =
  | 'welcome'
  | 'account_confirmation'
  | 'password_reset'
  | 'password_change'
  | 'unlock_account'
  | 'new_message'
  | 'new_memo'
  | 'prompt_notice'
  | 'incident_yes_employee'
  | 'incident_yes_admin'
  | 'wage_hour_yes_employee'
  | 'wage_hour_yes_payroll';

export type EmailTemplate = {
  id: EmailTemplateId;
  subject: string;
  /** Plain-text body (Resend text field). */
  text: string;
  /** Simple HTML body (Resend html field). */
  html: string;
  /** When this email should send. */
  when: string;
  /** Default on/off until product policy is finalized. */
  autoSendDefault: boolean;
};

function wrapHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
  <div style="margin-bottom: 24px;">
    <strong style="font-size: 20px; letter-spacing: -0.02em;">Mismo</strong>
  </div>
  ${bodyHtml}
  <p style="margin-top: 32px; font-size: 12px; color: #666;">Need help? Contact your administrator or Mismo support.</p>
</body>
</html>`;
}

const RETALIATION_NOTE =
  'Note: Retaliation for reporting an issue or participating in an investigation that involves our employees\' employment rights is against the law, as well as against our company policy, and will not be tolerated.';

export const EMAIL_TEMPLATES: Record<EmailTemplateId, EmailTemplate> = {
  welcome: {
    id: 'welcome',
    subject: "You've been added to {{orgName}} on Mismo",
    when: 'Optional: when HR adds an employee. Confirm with product before enabling auto-send (announcements may precede go-live).',
    autoSendDefault: false,
    text: `Hi {{userName}},

You've been added to {{orgName}}'s team on Mismo.

Get started:
{{inviteUrl}}

Need help? Please contact support.`,
    html: wrapHtml(
      'Welcome to Mismo',
      `<p>Hi {{userName}},</p>
<p>You've been added to <strong>{{orgName}}</strong>'s team on Mismo.</p>
<p><a href="{{inviteUrl}}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Get started</a></p>
<p style="font-size:13px;color:#666;">Or copy this link: {{inviteUrl}}</p>`
    ),
  },

  account_confirmation: {
    id: 'account_confirmation',
    subject: 'Confirm your Mismo account',
    when: 'Auth: email confirmation (if enabled in Auth settings).',
    autoSendDefault: true,
    text: `Welcome {{email}}!

You can confirm your account email through the link below:

{{confirmUrl}}`,
    html: wrapHtml(
      'Confirm your account',
      `<p>Welcome <strong>{{email}}</strong>!</p>
<p>You can confirm your account email through the link below:</p>
<p><a href="{{confirmUrl}}">Confirm my account</a></p>`
    ),
  },

  password_reset: {
    id: 'password_reset',
    subject: 'Reset your Mismo password',
    when: 'Auth: user requests a password reset.',
    autoSendDefault: true,
    text: `Hello {{userName}},

Someone has requested a link to change your password. You can do this through the link below:

{{resetUrl}}

If you didn't request this, please ignore this email.
Your password won't change until you access the link above and create a new one.`,
    html: wrapHtml(
      'Reset your password',
      `<p>Hello {{userName}},</p>
<p>Someone has requested a link to change your password. You can do this through the link below.</p>
<p><a href="{{resetUrl}}">Change my password</a></p>
<p>If you didn't request this, please ignore this email.<br>
Your password won't change until you access the link above and create a new one.</p>`
    ),
  },

  password_change: {
    id: 'password_change',
    subject: 'Your Mismo password was changed',
    when: 'Auth: after a successful password change.',
    autoSendDefault: true,
    text: `Hello {{email}},

We're contacting you to notify you that your password has been changed.`,
    html: wrapHtml(
      'Password changed',
      `<p>Hello {{email}},</p>
<p>We're contacting you to notify you that your password has been changed.</p>`
    ),
  },

  unlock_account: {
    id: 'unlock_account',
    subject: 'Unlock your Mismo account',
    when: 'Auth: account locked after too many failed sign-in attempts.',
    autoSendDefault: true,
    text: `Hello {{email}},

Your account has been locked due to an excessive number of unsuccessful sign in attempts.

Click the link below to unlock your account:

{{unlockUrl}}`,
    html: wrapHtml(
      'Unlock your account',
      `<p>Hello {{email}},</p>
<p>Your account has been locked due to an excessive number of unsuccessful sign in attempts.</p>
<p><a href="{{unlockUrl}}">Unlock my account</a></p>`
    ),
  },

  new_message: {
    id: 'new_message',
    subject: 'You have a new memo on Mismo',
    when: 'When a memo/message is available for the employee to review. Prefer reminder digests over firing on every publish unless configured.',
    autoSendDefault: false,
    text: `Hi {{userName}},

You have a new memo on Mismo. Please click here to review.

Read message:
{{memoUrl}}`,
    html: wrapHtml(
      'New memo',
      `<p>Hi {{userName}},</p>
<p>You have a new memo on Mismo. Please click here to review.</p>
<p><a href="{{memoUrl}}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Read message</a></p>`
    ),
  },

  new_memo: {
    id: 'new_memo',
    subject: '{{orgName}} published {{memoTitle}}',
    when: 'When a memo is published for employees to read and acknowledge. Product may prefer digests/reminders instead of auto-send.',
    autoSendDefault: false,
    text: `Hi {{userName}},

{{orgName}} has just published {{memoTitle}} for all employees to read and acknowledge.

Read memo:
{{memoUrl}}`,
    html: wrapHtml(
      'New memo published',
      `<p>Hi {{userName}},</p>
<p><strong>{{orgName}}</strong> has just published <strong>{{memoTitle}}</strong> for all employees to read and acknowledge.</p>
<p><a href="{{memoUrl}}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Read memo</a></p>`
    ),
  },

  prompt_notice: {
    id: 'prompt_notice',
    subject: 'New check-in from {{orgName}}',
    when: 'When a new prompt is delivered. Often better handled in-app; enable only if org opts in.',
    autoSendDefault: false,
    text: `Hi {{userName}},

You have a new prompt from {{orgName}}.

{{promptText}}

Nothing to Report: {{noIssueUrl}}
I need to report an issue: {{hasIssueUrl}}`,
    html: wrapHtml(
      'New prompt',
      `<p>Hi {{userName}},</p>
<p>You have a new prompt from <strong>{{orgName}}</strong>.</p>
<p>{{promptText}}</p>
<p>
  <a href="{{noIssueUrl}}">Nothing to Report</a><br>
  <a href="{{hasIssueUrl}}">I need to report an issue</a>
</p>`
    ),
  },

  /** Fired when employee answers Yes on the incident query. */
  incident_yes_employee: {
    id: 'incident_yes_employee',
    subject: 'Regarding your Incident Report',
    when: 'Immediately when an employee answers Yes on the Incident Query / workplace concern prompt.',
    autoSendDefault: true,
    text: `Regarding the Incident Report:

Mismo has relayed your response to the individuals designated by this company to receive it. You will be contacted to initially discuss the circumstances surrounding your response in the very near future pursuant to this company's policy.

We take all employee reports very seriously. If, after discussing the circumstances with you, it is determined that an investigation is warranted in order to correct or resolve any actual or potential problem, we will undertake to do so.

${RETALIATION_NOTE}`,
    html: wrapHtml(
      'Incident Report received',
      `<p><strong>Regarding the Incident Report:</strong></p>
<p>Mismo has relayed your response to the individuals designated by this company to receive it. You will be contacted to initially discuss the circumstances surrounding your response in the very near future pursuant to this company's policy.</p>
<p>We take all employee reports very seriously. If, after discussing the circumstances with you, it is determined that an investigation is warranted in order to correct or resolve any actual or potential problem, we will undertake to do so.</p>
<p><em>${RETALIATION_NOTE}</em></p>`
    ),
  },

  /** Simultaneous notice to HR/Admin and investigators when employee answers Yes on incident. */
  incident_yes_admin: {
    id: 'incident_yes_admin',
    subject: 'Action required: Incident Report response',
    when: 'Simultaneously with incident_yes_employee. Send to administrators and assigned investigators.',
    autoSendDefault: true,
    text: `Regarding the Incident Report:

Mismo has recorded an employee response today which requires your immediate attention. See your Mismo Administrative Dashboard Alerts for employee information.

Please contact the reporting employee within the time frame pursuant to company policy to initially discuss the circumstances surrounding today's response by the employee, and to determine whether or not an investigation is warranted in order to correct or resolve any potential or actual problem.

${RETALIATION_NOTE}

Dashboard: {{dashboardUrl}}
Case: {{caseUrl}}`,
    html: wrapHtml(
      'Incident Report alert',
      `<p><strong>Regarding the Incident Report:</strong></p>
<p>Mismo has recorded an employee response today which requires your immediate attention. See your <a href="{{dashboardUrl}}">Mismo Administrative Dashboard Alerts</a> for employee information.</p>
<p>Please contact the reporting employee within the time frame pursuant to company policy to initially discuss the circumstances surrounding today's response by the employee, and to determine whether or not an investigation is warranted in order to correct or resolve any potential or actual problem.</p>
<p><em>${RETALIATION_NOTE}</em></p>
<p><a href="{{caseUrl}}">Open case</a></p>`
    ),
  },

  /** Fired when employee indicates a wage & hour concern. */
  wage_hour_yes_employee: {
    id: 'wage_hour_yes_employee',
    subject: 'Regarding Wage and Hour',
    when: 'Immediately when an employee reports a wage & hour concern.',
    autoSendDefault: true,
    text: `Regarding Wage and Hour:

Mismo has relayed your response to the payroll representative designated by this company to receive it. You will be contacted in the immediate future to discuss the circumstances surrounding your response.

Please have your paycheck, or a copy of your paycheck, readily available for your meeting, as well as your time record if applicable. This will speed up the process of addressing your concerns or to immediately correct any qualified discrepancies in your payroll amount, deductions or benefits calculations.

${RETALIATION_NOTE}`,
    html: wrapHtml(
      'Wage and Hour received',
      `<p><strong>Regarding Wage and Hour:</strong></p>
<p>Mismo has relayed your response to the payroll representative designated by this company to receive it. You will be contacted in the immediate future to discuss the circumstances surrounding your response.</p>
<p>Please have your paycheck, or a copy of your paycheck, readily available for your meeting, as well as your time record if applicable. This will speed up the process of addressing your concerns or to immediately correct any qualified discrepancies in your payroll amount, deductions or benefits calculations.</p>
<p><em>${RETALIATION_NOTE}</em></p>`
    ),
  },

  /** Simultaneous notice to payroll administrator. */
  wage_hour_yes_payroll: {
    id: 'wage_hour_yes_payroll',
    subject: 'Action required: Wage and Hour response',
    when: 'Simultaneously with wage_hour_yes_employee. Send to payroll administrator(s).',
    autoSendDefault: true,
    text: `Regarding Wage and Hour:

Mismo has recorded an employee response today which requires your immediate attention. See your Mismo Administrative Dashboard Alerts for employee information.

It is imperative that you contact the employee immediately to address any questions or concerns they may have regarding their most recent paycheck. Should you find there is a discrepancy in the amount paid, the amounts deducted, or in the benefits calculations, please resolve it immediately.

${RETALIATION_NOTE}

Dashboard: {{dashboardUrl}}
Case: {{caseUrl}}`,
    html: wrapHtml(
      'Wage and Hour alert',
      `<p><strong>Regarding Wage and Hour:</strong></p>
<p>Mismo has recorded an employee response today which requires your immediate attention. See your <a href="{{dashboardUrl}}">Mismo Administrative Dashboard Alerts</a> for employee information.</p>
<p>It is imperative that you contact the employee immediately to address any questions or concerns they may have regarding their most recent paycheck. Should you find there is a discrepancy in the amount paid, the amounts deducted, or in the benefits calculations, please resolve it immediately.</p>
<p><em>${RETALIATION_NOTE}</em></p>
<p><a href="{{caseUrl}}">Open case</a></p>`
    ),
  },
};

/** Replace {{key}} placeholders in a template string. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

export function buildEmail(
  id: EmailTemplateId,
  vars: Record<string, string>
): { subject: string; text: string; html: string; autoSendDefault: boolean } {
  const t = EMAIL_TEMPLATES[id];
  return {
    subject: renderTemplate(t.subject, vars),
    text: renderTemplate(t.text, vars),
    html: renderTemplate(t.html, vars),
    autoSendDefault: t.autoSendDefault,
  };
}
