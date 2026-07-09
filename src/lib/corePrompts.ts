import type { Prompt } from '@/types';
import { DEFAULT_ORG_ID } from '@/data/orgDefaults';

/** Stable id for the mandatory daily incident YES/NO check-in. */
export const CORE_INCIDENT_PROMPT_ID = 'prompt-core-incident';

export const CORE_FINANCIAL_LABEL = 'Financial follow-up';

export const CORE_INCIDENT_DEFAULTS: Omit<Prompt, 'orgId' | 'createdBy' | 'createdAt' | 'updatedAt'> = {
  id: CORE_INCIDENT_PROMPT_ID,
  type: 'INCIDENT',
  title: 'Incident Query',
  description:
    'Mandatory employment-rights incident screen. Employees and HR staff answer Yes or No daily; Yes may open a secure case for review.',
  schedule: {
    cadence: 'ONCE',
    startAt: new Date('2024-01-01'),
  },
  targeting: {
    audience: 'ALL',
  },
  severityOnHasIssue: 'HIGH',
  allowAnonymousReports: true,
  includeFinancialQuestion: true,
  status: 'ACTIVE',
};

export const CORE_FINANCIAL_DESCRIPTION =
  'Pay and compensation screening: employees answer this after their main check-in response, before the check-in is saved.';

export function isCoreIncidentPrompt(prompt: Pick<Prompt, 'id' | 'type'>): boolean {
  return prompt.id === CORE_INCIDENT_PROMPT_ID || prompt.type === 'INCIDENT';
}

/** Core prompts cannot be deactivated; optional company prompts can. */
export function isLockedCorePrompt(prompt: Pick<Prompt, 'id' | 'type'>): boolean {
  return prompt.type === 'INCIDENT';
}

export function isOptionalPrompt(prompt: Pick<Prompt, 'id' | 'type'>): boolean {
  return !isLockedCorePrompt(prompt);
}

export function buildCoreIncidentPrompt(orgId: string, createdBy: string): Prompt {
  const now = new Date();
  return {
    ...CORE_INCIDENT_DEFAULTS,
    orgId,
    createdBy,
    createdAt: now,
    updatedAt: now,
    status: 'ACTIVE',
    includeFinancialQuestion: true,
  };
}

/** Merge org prompts with required core incident prompt (always ACTIVE + financial follow-up). */
export function mergeCorePrompts(existing: Prompt[], orgId: string, createdBy: string): Prompt[] {
  const priorCore =
    existing.find((p) => p.id === CORE_INCIDENT_PROMPT_ID) ?? existing.find((p) => p.type === 'INCIDENT');
  const coreId = priorCore?.id ?? CORE_INCIDENT_PROMPT_ID;

  const others = existing.filter((p) => p.id !== coreId);

  const core: Prompt = priorCore
    ? {
        ...priorCore,
        type: 'INCIDENT',
        status: 'ACTIVE',
        includeFinancialQuestion: true,
        orgId,
        updatedAt: new Date(),
      }
    : buildCoreIncidentPrompt(orgId, createdBy || 'system');

  return [core, ...others];
}

export function resolveDailyCheckInPrompt(prompts: Prompt[], orgId: string = DEFAULT_ORG_ID): Prompt | undefined {
  return (
    prompts.find((p) => p.id === CORE_INCIDENT_PROMPT_ID && p.orgId === orgId && p.status === 'ACTIVE') ??
    prompts.find((p) => p.orgId === orgId && p.type === 'INCIDENT' && p.status === 'ACTIVE') ??
    prompts.find((p) => p.orgId === orgId && p.status === 'ACTIVE')
  );
}

export function promptIsActiveForDelivery(prompt: Prompt): boolean {
  return prompt.status === 'ACTIVE' || prompt.status === 'SCHEDULED';
}
