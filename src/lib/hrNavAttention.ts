const STORAGE_KEY = 'mismo_hr_nav_seen_v1';

import type { Investigation, PromptResponse, Report } from '@/types';
import { promptResponseNeedsHrReview } from '@/lib/investigationWorkload';

type SeenKind = 'investigation' | 'prompt_response';

type SeenStore = Record<string, Partial<Record<SeenKind, string[]>>>;

function readStore(): SeenStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SeenStore;
  } catch {
    return {};
  }
}

function writeStore(store: SeenStore) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota
  }
}

export function getHrNavSeenIds(userId: string, kind: SeenKind): Set<string> {
  const list = readStore()[userId]?.[kind] ?? [];
  return new Set(list);
}

export function markHrNavSeen(userId: string, kind: SeenKind, id: string): void {
  if (!userId || !id) return;
  const store = readStore();
  const user = store[userId] ?? {};
  const prev = new Set(user[kind] ?? []);
  if (prev.has(id)) return;
  prev.add(id);
  // Cap growth so localStorage stays bounded
  const next = [...prev].slice(-200);
  store[userId] = { ...user, [kind]: next };
  writeStore(store);
}

export function countUnseenOpenInvestigations(
  userId: string,
  investigations: Array<{ id: string; status: string }>
): number {
  const seen = getHrNavSeenIds(userId, 'investigation');
  return investigations.filter((inv) => inv.status === 'OPEN' && !seen.has(inv.id)).length;
}

/** Shared org-wide: Yes still needing review (opened by anyone clears it). */
export function countUnseenYesNeedingReview(
  _userId: string,
  responses: PromptResponse[],
  reports: Report[] = [],
  investigations: Investigation[] = []
): number {
  return responses.filter((r) => promptResponseNeedsHrReview(r, reports, investigations)).length;
}
