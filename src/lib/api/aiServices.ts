import type {
 HrLawRecord,
 HrLawUpdate,
 OutreachCoachRequest,
 OutreachCoachResponse,
} from '@/types/aiServices';

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
const AI_ENABLED = import.meta.env.VITE_AI_FEATURES_ENABLED === 'true';

function apiUrl(path: string): string {
 const base = API_BASE?.replace(/\/$/, '') ?? '';
 return `${base}${path}`;
}

/** Mock coach when API URL is not configured. */
function mockOutreachCoach(req: OutreachCoachRequest): OutreachCoachResponse {
 const wordCount = req.body.split(/\s+/).length;
 const harshWords = /\b(must|immediately|failure|disciplinary|terminate|final warning)\b/i.test(req.body);
 const empatheticWords = /\b(thank|understand|support|confidential|questions)\b/i.test(req.body);
 let tone_score = 3;
 if (empatheticWords && !harshWords) tone_score = 2;
 if (harshWords) tone_score = 5;
 if (wordCount < 20) tone_score = Math.min(tone_score + 1, 6);

 const levels = ['EMPATHETIC', 'PROFESSIONAL', 'NEUTRAL', 'DIRECT', 'FIRM', 'HARSH'] as const;

 return {
 tone_score,
 tone_level: levels[tone_score - 1],
 risk_flags: tone_score >= 5 ? ['Tone may feel punitive - consider softening deadline language'] : [],
 rationale:
 tone_score >= 5
 ? 'Draft uses firm enforcement language. For case outreach, a professional or direct tone usually reduces retaliation concerns.'
 : 'Draft is within a reasonable range for HR outreach. Consider naming next steps and a contact person.',
 suggested_subject: req.subject ?? 'Follow-up regarding your HR matter',
 suggested_body: `${req.body.trim()}\n\nIf you have questions or need accommodations to respond, please reply to this message or contact HR directly. Thank you.`,
 applicable_laws: req.stateCode
 ? [
 {
 citation: `${req.stateCode} anti-retaliation provisions`,
 summary: 'Employers generally may not retaliate against employees for good-faith reporting.',
 relevance: 'Ensure outreach cannot be read as punishment for participating in a report or investigation.',
 },
 ]
 : [],
 promptVersion: 'mock-v1',
 model: 'mock',
 disclaimer: 'Demo coach - connect your Mismo API for live analysis. Not legal advice.',
 };
}

export function isAiFeaturesEnabled(): boolean {
 return import.meta.env.DEV || AI_ENABLED || Boolean(API_BASE);
}

export async function coachOutreachDraft(req: OutreachCoachRequest): Promise<OutreachCoachResponse> {
 if (!API_BASE) {
 await new Promise((r) => setTimeout(r, 600));
 return mockOutreachCoach(req);
 }

 const res = await fetch(apiUrl('/ai/outreach/coach'), {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(req),
 });

 if (!res.ok) {
 const err = (await res.json().catch(() => ({}))) as { error?: string };
 throw new Error(err.error ?? `Coach request failed (${res.status})`);
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
 if (!API_BASE) throw new Error('API not configured');
 const res = await fetch(apiUrl('/hr-laws/sync'), {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ stateCode, stateName, orgId }),
 });
 if (!res.ok) {
 const err = (await res.json().catch(() => ({}))) as { error?: string };
 throw new Error(err.error ?? 'Law sync failed');
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
