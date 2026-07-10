import type {
 HrLawRecord,
 HrLawUpdate,
 OutreachCoachRequest,
 OutreachCoachResponse,
} from '@/types/aiServices';
import { API_NOT_CONFIGURED, sanitizeInfraError } from '@/lib/infraMessaging';

function resolveApiBase(): string | undefined {
  const explicit = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (explicit?.trim()) return explicit.replace(/\/$/, '');
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (supabaseUrl?.trim()) {
    return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/mismo-api`;
  }
  return undefined;
}

const API_BASE = resolveApiBase();
const AI_ENABLED = import.meta.env.VITE_AI_FEATURES_ENABLED !== 'false';

function apiUrl(path: string): string {
 const base = API_BASE?.replace(/\/$/, '') ?? '';
 return `${base}${path}`;
}

export function getApiBaseUrl(): string | undefined {
 return API_BASE;
}

export type ApiHealthStatus = {
 ok: boolean;
 apiBase?: string;
 database?: boolean;
 openai?: boolean;
 runtime?: string;
};

export async function fetchApiHealth(): Promise<ApiHealthStatus> {
 if (!API_BASE) return { ok: false };
 try {
 const res = await fetch(apiUrl('/health'));
 if (!res.ok) return { ok: false, apiBase: API_BASE };
 const data = (await res.json()) as ApiHealthStatus;
 return { ...data, ok: true, apiBase: API_BASE };
 } catch {
 return { ok: false, apiBase: API_BASE };
 }
}

export function isAiFeaturesEnabled(): boolean {
 return Boolean(API_BASE) && AI_ENABLED;
}

export async function coachOutreachDraft(req: OutreachCoachRequest): Promise<OutreachCoachResponse> {
 if (!API_BASE) {
 throw new Error(API_NOT_CONFIGURED);
 }

 const res = await fetch(apiUrl('/ai/outreach/coach'), {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(req),
 });

 if (!res.ok) {
 const err = (await res.json().catch(() => ({}))) as { error?: string };
 throw new Error(sanitizeInfraError(err.error ?? `Coach request failed (${res.status})`));
 }

 return res.json() as Promise<OutreachCoachResponse>;
}

export async function fetchHrLaws(stateCode: string, topic?: string): Promise<{ laws: HrLawRecord[] }> {
 if (!API_BASE) return { laws: [] };
 const params = new URLSearchParams({ state: stateCode });
 if (topic) params.set('topic', topic);
 const res = await fetch(apiUrl(`/hr-laws?${params}`));
 if (!res.ok) return { laws: [] };
 return res.json() as Promise<{ laws: HrLawRecord[] }>;
}

export async function fetchHrLawUpdates(orgId: string): Promise<{ updates: HrLawUpdate[] }> {
 if (!API_BASE) return { updates: [] };
 const res = await fetch(apiUrl(`/hr-laws/updates?orgId=${encodeURIComponent(orgId)}`));
 if (!res.ok) return { updates: [] };
 return res.json() as Promise<{ updates: HrLawUpdate[] }>;
}

export async function syncHrLawsForState(
 stateCode: string,
 stateName: string,
 orgId?: string
): Promise<{ ok: boolean; lawCount: number; inserted: number; updated: number }> {
 if (!API_BASE) throw new Error(API_NOT_CONFIGURED);
 const res = await fetch(apiUrl('/hr-laws/sync'), {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ stateCode, stateName, orgId }),
 });
 if (!res.ok) {
 const err = (await res.json().catch(() => ({}))) as { error?: string };
 throw new Error(sanitizeInfraError(err.error ?? 'Law sync failed'));
 }
 return res.json() as Promise<{ ok: boolean; lawCount: number; inserted: number; updated: number }>;
}

export type HrNextTask = {
 id: string;
 priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
 title: string;
 detail: string;
 action: string;
 count?: number;
 source?: 'database' | 'snapshot' | 'ai';
};

export type DashboardSnapshot = {
 payrollExpedited?: number;
 needsInfo?: number;
 wageHour?: number;
 yesReview?: number;
 unassigned?: number;
 lawUpdates?: number;
 atRiskEmployees?: number;
 unansweredPrompts?: number;
 openInvestigations?: number;
};

export async function fetchHrNextTasks(
 orgId: string,
 snapshot?: DashboardSnapshot
): Promise<{ tasks: HrNextTask[]; aiEnabled?: boolean; dataSource?: string }> {
 if (!API_BASE) return { tasks: [] };
 const params = new URLSearchParams({ orgId });
 if (snapshot) {
 for (const [key, value] of Object.entries(snapshot)) {
 if (value != null && value > 0) params.set(key, String(value));
 }
 }
 const res = await fetch(apiUrl(`/hr/next-tasks?${params}`));
 if (!res.ok) return { tasks: [] };
 return res.json() as Promise<{ tasks: HrNextTask[]; aiEnabled?: boolean; dataSource?: string }>;
}
