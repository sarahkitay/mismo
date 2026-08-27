import type { Investigation } from '@/types';

const STORAGE_KEY = 'mismo_investigation_workspace_v1';

/** Fields stored locally when cloud DB lacks full investigation child rows. */
const WORKSPACE_KEYS: (keyof Investigation)[] = [
  'notes',
  'evidenceRecords',
  'persons',
  'responseRequests',
  'correctiveActions',
  'followUps',
  'stageHistory',
  'subjectUserIds',
  'witnessUserIds',
  'witnessExternal',
  'initialContactNotes',
  'initialContactSavedAt',
  'initialContactAttachments',
  'findingsRationale',
  'policyAnalysisNotes',
  'linkedPolicyIds',
  'finalFindingsReport',
  'legalInvolved',
  'legalInvolvementNotes',
  'employeePreferredContact',
  'pickedUpAt',
  'outcomeSummary',
  'outcomeRequiresSignature',
  'outcomeSentAt',
  'outcomeAttachment',
  'outcomeEmployeeSignedAt',
  'outcomeEmployeeAgreed',
  'outcomeEmployeeSignatureDataUrl',
  'outcomeEmployeeRevisionNote',
  'outcomeClassification',
  'outcomeViewedAt',
  'nonRetaliationSentAt',
  'riskLevel',
  'investigationType',
  'reportSourceType',
  'workflowPagesCompleted',
  'checklistStages',
];

function replacer(_key: string, value: unknown) {
  if (value instanceof Date) return { __type: 'Date', value: value.toISOString() };
  return value;
}

function reviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && (value as { __type?: string }).__type === 'Date') {
    return new Date(String((value as { value: string }).value));
  }
  return value;
}

function readStore(): Record<string, Partial<Investigation>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw, reviver) as Record<string, Partial<Investigation>>;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, Partial<Investigation>>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store, replacer));
  } catch {
    // ignore quota errors
  }
}

export function pickInvestigationWorkspacePayload(inv: Investigation): Partial<Investigation> {
  const payload: Partial<Investigation> = { id: inv.id, updatedAt: inv.updatedAt, lastUpdateAt: inv.lastUpdateAt };
  for (const key of WORKSPACE_KEYS) {
    const value = inv[key];
    if (value !== undefined) {
      (payload as Record<string, unknown>)[key] = value;
    }
  }
  return payload;
}

export function saveInvestigationWorkspace(inv: Investigation): void {
  const store = readStore();
  store[inv.id] = pickInvestigationWorkspacePayload(inv);
  writeStore(store);
}

export function mergeInvestigationWorkspace(base: Investigation): Investigation {
  const overlay = readStore()[base.id];
  if (!overlay) return base;
  const merged = { ...base, ...overlay } as Investigation;
  const overlayUpdated = overlay.updatedAt instanceof Date ? overlay.updatedAt.getTime() : 0;
  const baseUpdated = base.updatedAt instanceof Date ? base.updatedAt.getTime() : 0;
  if (overlayUpdated >= baseUpdated) return merged;
  return { ...merged, ...base, ...overlay };
}

export function mergeInvestigationsWithWorkspace(investigations: Investigation[]): Investigation[] {
  return investigations.map(mergeInvestigationWorkspace);
}
