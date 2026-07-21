# Mismo email templates (Resend)

Ready-to-use copy for Auth and product emails. Brand is **Mismo** only (no vendor names in user-facing copy). Legacy PCG wording was rewritten: **Title VII → Incident Report**, **PCG → Mismo**.

Implementation lives in:
- `supabase/functions/_shared/email-templates.ts`
- `supabase/functions/_shared/resend.ts`

Until `RESEND_API_KEY` (and preferably `RESEND_FROM`) are set on the API, sends are skipped safely. Invite links still work without email.

---

## Policy notes (from product discussion)

| Topic | Recommendation |
| --- | --- |
| Welcome email when an employee is added | **Optional / off by default.** Confirm before enabling, especially if JeStar or the company will announce go-live separately. Admins can still share the invite **link** without email. |
| Memo / prompt / message emails | Prefer **in-app** delivery. Auto-email only for **unread memo reminders** and org-opted digests. |
| Incident / wage-hour **Yes** responses | **Auto-send** to the reporting employee and to admins/investigators/payroll. These are the compliance notice emails. |
| Auth emails (reset, confirm, unlock, password changed) | Handled by Auth SMTP once Resend is wired; keep the copy below. |

---

## Auth templates

### Welcome Email (`welcome`) — auto-send **off** by default

**Subject:** You've been added to {{orgName}} on Mismo

```
Hi {{userName}},

You've been added to {{orgName}}'s team on Mismo.

Get started
{{inviteUrl}}

Need help? Please contact support.
```

### Account Confirmation (`account_confirmation`)

```
Welcome {{email}}!

You can confirm your account email through the link below:

Confirm my account → {{confirmUrl}}
```

### Password Reset (`password_reset`)

```
Hello {{userName}},

Someone has requested a link to change your password. You can do this through the link below.

Change my password → {{resetUrl}}

If you didn't request this, please ignore this email.
Your password won't change until you access the link above and create a new one.
```

### Password Change (`password_change`)

```
Hello {{email}},

We're contacting you to notify you that your password has been changed.
```

### Unlock Account (`unlock_account`)

```
Hello {{email}},

Your account has been locked due to an excessive number of unsuccessful sign in attempts.

Unlock my account → {{unlockUrl}}
```

---

## Product templates (optional auto-send)

### New Message (`new_message`)

```
Hi {{userName}},

You have a new memo on Mismo. Please click here to review.

Read message → {{memoUrl}}
```

### New Memo (`new_memo`)

```
Hi {{userName}},

{{orgName}} has just published {{memoTitle}} for all employees to read and acknowledge.

Read Memo → {{memoUrl}}
```

### Prompt Notice (`prompt_notice`)

```
Hi {{userName}},

You have a new prompt from {{orgName}}.

{{promptText}}

"Nothing to Report" → {{noIssueUrl}}
"I need to report an issue." → {{hasIssueUrl}}
```

---

## Yes-response notices (auto-send **on**)

These fire when an employee answers **Yes** on the core prompts. Send **simultaneously** to the employee and to the designated admins.

### Incident Report → reporting employee (`incident_yes_employee`)

**Subject:** Regarding your Incident Report

```
Regarding the Incident Report:

Mismo has relayed your response to the individuals designated by this company to receive it. You will be contacted to initially discuss the circumstances surrounding your response in the very near future pursuant to this company's policy.

We take all employee reports very seriously. If, after discussing the circumstances with you, it is determined that an investigation is warranted in order to correct or resolve any actual or potential problem, we will undertake to do so.

Note: Retaliation for reporting an issue or participating in an investigation that involves our employees' employment rights is against the law, as well as against our company policy, and will not be tolerated.
```

### Incident Report → administrators & investigators (`incident_yes_admin`)

**Subject:** Action required: Incident Report response

```
Regarding the Incident Report:

Mismo has recorded an employee response today which requires your immediate attention. See your Mismo Administrative Dashboard Alerts for employee information.

Please contact the reporting employee within the time frame pursuant to company policy to initially discuss the circumstances surrounding today's response by the employee, and to determine whether or not an investigation is warranted in order to correct or resolve any potential or actual problem.

Note: Retaliation for reporting an issue or participating in an investigation that involves our employees' employment rights is against the law, as well as against our company policy, and will not be tolerated.
```

### Wage and Hour → reporting employee (`wage_hour_yes_employee`)

**Subject:** Regarding Wage and Hour

```
Regarding Wage and Hour:

Mismo has relayed your response to the payroll representative designated by this company to receive it. You will be contacted in the immediate future to discuss the circumstances surrounding your response.

Please have your paycheck, or a copy of your paycheck, readily available for your meeting, as well as your time record if applicable. This will speed up the process of addressing your concerns or to immediately correct any qualified discrepancies in your payroll amount, deductions or benefits calculations.

Note: Retaliation for reporting an issue or participating in an investigation that involves our employees' employment rights is against the law, as well as against our company policy, and will not be tolerated.
```

### Wage and Hour → payroll administrator (`wage_hour_yes_payroll`)

**Subject:** Action required: Wage and Hour response

```
Regarding Wage and Hour:

Mismo has recorded an employee response today which requires your immediate attention. See your Mismo Administrative Dashboard Alerts for employee information.

It is imperative that you contact the employee immediately to address any questions or concerns they may have regarding their most recent paycheck. Should you find there is a discrepancy in the amount paid, the amounts deducted, or in the benefits calculations, please resolve it immediately.

Note: Retaliation for reporting an issue or participating in an investigation that involves our employees' employment rights is against the law, as well as against our company policy, and will not be tolerated.
```

---

## Resend setup (when domain is ready)

1. Create a Resend account and verify your domain.
2. Set Edge Function secrets:
   - `RESEND_API_KEY`
   - `RESEND_FROM` (e.g. `Mismo <noreply@yourdomain.com>`)
3. For Auth emails (reset / confirm / invite), also configure Supabase Dashboard → Authentication → SMTP with the same Resend SMTP credentials, and paste the Auth template copy above into the Auth email templates.
4. Redeploy `mismo-api` after secrets are set.

Until then, use **shareable invite links** in the Employees UI for onboarding tests.
