import type { Prompt } from '@/types';
import { DEFAULT_ORG_ID } from '@/data/orgDefaults';

/** Legacy stable id for the primary org (existing FKs / seed rows). */
export const CORE_INCIDENT_PROMPT_ID = 'prompt-core-incident';

/** Per-org core prompt id. Keeps multi-tenant rows from colliding on the global PK. */
export function coreIncidentPromptId(orgId: string): string {
  if (!orgId || orgId === DEFAULT_ORG_ID) return CORE_INCIDENT_PROMPT_ID;
  return `${CORE_INCIDENT_PROMPT_ID}:${orgId}`;
}

export function isCoreIncidentPromptId(id: string): boolean {
  return id === CORE_INCIDENT_PROMPT_ID || id.startsWith(`${CORE_INCIDENT_PROMPT_ID}:`);
}

export const CORE_FINANCIAL_LABEL = 'Financial follow-up';

export const CORE_INCIDENT_DEFAULTS: Omit<Prompt, 'id' | 'orgId' | 'createdBy' | 'createdAt' | 'updatedAt'> = {
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
  return isCoreIncidentPromptId(prompt.id) || prompt.type === 'INCIDENT';
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
    id: coreIncidentPromptId(orgId),
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
  const expectedId = coreIncidentPromptId(orgId);
  const priorCore =
    existing.find((p) => p.id === expectedId) ??
    existing.find((p) => p.id === CORE_INCIDENT_PROMPT_ID && p.orgId === orgId) ??
    existing.find((p) => p.type === 'INCIDENT' && p.orgId === orgId);
  const coreId = priorCore?.id ?? expectedId;

  const others = existing.filter((p) => p.id !== coreId);

  const core: Prompt = priorCore
    ? {
        ...priorCore,
        id: priorCore.orgId === orgId ? priorCore.id : expectedId,
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
  const expectedId = coreIncidentPromptId(orgId);
  return (
    prompts.find((p) => p.id === expectedId && p.orgId === orgId && p.status === 'ACTIVE') ??
    prompts.find((p) => p.id === CORE_INCIDENT_PROMPT_ID && p.orgId === orgId && p.status === 'ACTIVE') ??
    prompts.find((p) => p.orgId === orgId && p.type === 'INCIDENT' && p.status === 'ACTIVE') ??
    prompts.find((p) => p.orgId === orgId && p.status === 'ACTIVE')
  );
}

export function promptIsActiveForDelivery(prompt: Prompt): boolean {
  return prompt.status === 'ACTIVE' || prompt.status === 'SCHEDULED';
}
