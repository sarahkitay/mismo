import type { Investigation } from '@/types';
import { OUTCOME_CLASSIFICATION_LABELS } from '@/lib/investigationWorkflow';

export function investigationOutcomeSignOffPending(investigation: Investigation): boolean {
  if (!investigation.outcomeSentAt) return false;
  if (investigation.outcomeRequiresSignature === false) return false;
  return investigation.outcomeEmployeeSignedAt == null;
}

export function canCloseInvestigation(investigation: Investigation): { ok: boolean; message?: string } {
  if (investigation.status === 'CLOSED') return { ok: true };
  if (investigationOutcomeSignOffPending(investigation)) {
    return {
      ok: false,
      message:
        'Employee sign-off is still pending. Send the outcome summary and wait for the employee to agree before closing.',
    };
  }
  if (
    investigation.outcomeSentAt &&
    investigation.outcomeRequiresSignature !== false &&
    investigation.outcomeEmployeeAgreed === false
  ) {
    return {
      ok: false,
      message:
        'The employee did not agree with the outcome. Follow up with them before closing the investigation.',
    };
  }
  return { ok: true };
}

export function buildInvestigationOutcomeOverview(investigation: Investigation): string {
  const lines: string[] = [
    'Investigation summary',
    '',
    'This overview describes how your concern was reviewed and what actions were taken.',
    '',
  ];

  if (investigation.outcomeClassification) {
    lines.push(`Outcome: ${OUTCOME_CLASSIFICATION_LABELS[investigation.outcomeClassification]}`);
    lines.push('');
  }

  if (investigation.findingsRationale?.trim()) {
    lines.push('What we found:');
    lines.push(investigation.findingsRationale.trim());
    lines.push('');
  }

  if (investigation.finalFindingsReport?.trim()) {
    lines.push('How the matter was handled:');
    lines.push(investigation.finalFindingsReport.trim());
    lines.push('');
  }

  const actions = investigation.correctiveActions ?? [];
  if (actions.length > 0) {
    lines.push('Actions taken:');
    actions.forEach((action) => {
      lines.push(`- ${action.type.replace(/_/g, ' ')}: ${action.description} (${action.status.replace(/_/g, ' ').toLowerCase()})`);
    });
    lines.push('');
  }

  lines.push(
    'Please review this summary. If it looks accurate, sign below to confirm you agree the investigation is complete and the issue is resolved.'
  );

  return lines.join('\n').trim();
}

export function buildInvestigationOutcomeEmailBody(summary: string): string {
  return [
    'Your investigation is complete. Please review the outcome summary below in Mismo.',
    'If you agree that the matter was handled appropriately and the issue is resolved, sign off in the app.',
    'If something is inaccurate, you can indicate that you do not agree and explain your concerns.',
    '',
    summary,
  ].join('\n');
}

export function investigationOutcomeStatusLabel(investigation: Investigation): string {
  if (!investigation.outcomeSentAt) return 'Not sent';
  if (investigation.outcomeEmployeeSignedAt == null) return 'Awaiting employee sign-off';
  if (investigation.outcomeEmployeeAgreed === true) return 'Employee agreed and signed';
  if (investigation.outcomeEmployeeAgreed === false) return 'Employee did not agree';
  return 'Employee acknowledged';
}
