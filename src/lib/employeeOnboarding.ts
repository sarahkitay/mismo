import type {
  EmployeeOnboardingExposure,
  EmployeeOnboardingKind,
  Prompt,
  PromptDelivery,
  PromptResponse,
  Report,
  WageHourScreeningAcknowledgement,
} from '@/types';

export const ONBOARDING_PROMPT_IDS = {
  INCIDENT: 'prompt-1',
  WAGE_HOUR: 'prompt-wage-hour',
} as const;

export function getOnboardingKind(prompt: Pick<Prompt, 'id' | 'onboardingKind'>): EmployeeOnboardingKind | undefined {
  if (prompt.onboardingKind) return prompt.onboardingKind;
  if (prompt.id === ONBOARDING_PROMPT_IDS.INCIDENT) return 'INCIDENT';
  if (prompt.id === ONBOARDING_PROMPT_IDS.WAGE_HOUR) return 'WAGE_HOUR';
  return undefined;
}

export function isOnboardingPrompt(prompt: Pick<Prompt, 'id' | 'onboardingKind'>): boolean {
  return Boolean(getOnboardingKind(prompt));
}

export function hasFinalizedOnboardingResponse(
  kind: EmployeeOnboardingKind,
  userId: string,
  responses: PromptResponse[],
  prompts: Prompt[]
): boolean {
  const promptId = kind === 'INCIDENT' ? ONBOARDING_PROMPT_IDS.INCIDENT : ONBOARDING_PROMPT_IDS.WAGE_HOUR;
  return responses.some(
    (r) =>
      r.userId === userId &&
      r.finalizedAt &&
      (r.promptId === promptId || prompts.some((p) => p.id === r.promptId && getOnboardingKind(p) === kind))
  );
}

export function hasCompletedWageHourOnboarding(
  userId: string,
  wageHourAcknowledgements: WageHourScreeningAcknowledgement[],
  reports: Report[]
): boolean {
  return (
    wageHourAcknowledgements.some((a) => a.userId === userId) ||
    reports.some((r) => r.createdByUserId === userId && r.caseType === 'WAGE_HOUR')
  );
}

export function computePendingOnboardingSteps(input: {
  userId: string;
  prompts: Prompt[];
  responses: PromptResponse[];
  deliveries: PromptDelivery[];
  reports: Report[];
  wageHourAcknowledgements: WageHourScreeningAcknowledgement[];
  exposure: EmployeeOnboardingExposure | undefined;
}): EmployeeOnboardingKind[] {
  const { userId, prompts, responses, reports, wageHourAcknowledgements, exposure } = input;
  const steps: EmployeeOnboardingKind[] = [];

  const needsIncident =
    !hasFinalizedOnboardingResponse('INCIDENT', userId, responses, prompts) && !exposure?.INCIDENT;
  const needsWageHour =
    !hasFinalizedOnboardingResponse('WAGE_HOUR', userId, responses, prompts) &&
    !hasCompletedWageHourOnboarding(userId, wageHourAcknowledgements, reports) &&
    !exposure?.WAGE_HOUR;

  if (needsIncident) steps.push('INCIDENT');
  if (needsWageHour) steps.push('WAGE_HOUR');
  return steps;
}

export function getOnboardingDelivery(
  kind: EmployeeOnboardingKind,
  userId: string,
  deliveries: PromptDelivery[]
): PromptDelivery | undefined {
  const promptId = kind === 'INCIDENT' ? ONBOARDING_PROMPT_IDS.INCIDENT : ONBOARDING_PROMPT_IDS.WAGE_HOUR;
  return deliveries.find(
    (d) =>
      d.userId === userId &&
      d.promptId === promptId &&
      (d.status === 'PENDING' || !d.completedAt)
  );
}
