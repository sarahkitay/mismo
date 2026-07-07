/** Shared types for OpenAI-backed Mismo services (frontend + API). */

export type OutreachToneLevel =
  | 'EMPATHETIC'
  | 'PROFESSIONAL'
  | 'NEUTRAL'
  | 'DIRECT'
  | 'FIRM'
  | 'HARSH';

export type HrLawTopic =
  | 'WAGE_HOUR'
  | 'LEAVE'
  | 'DISCRIMINATION'
  | 'HARASSMENT'
  | 'RETALIATION'
  | 'WORKPLACE_SAFETY'
  | 'PRIVACY'
  | 'RECORDKEEPING'
  | 'UNEMPLOYMENT'
  | 'OTHER';

export interface ApplicableLawRef {
  citation: string;
  summary: string;
  relevance: string;
}

export interface OutreachCoachRequest {
  orgId: string;
  reportId?: string;
  investigationId?: string;
  subject?: string;
  body: string;
  stateCode?: string;
  caseCategory?: string;
  caseType?: string;
  /** Desired tone 1 (empathetic) – 6 (harsh). Omit for AI recommendation. */
  toneTarget?: number;
  createdBy?: string;
  applicableLaws?: { citation: string; summary: string }[];
}

export interface OutreachCoachResponse {
  tone_score: number;
  tone_level: OutreachToneLevel;
  risk_flags: string[];
  rationale: string;
  suggested_subject: string;
  suggested_body: string;
  applicable_laws: ApplicableLawRef[];
  promptVersion: string;
  model: string;
  disclaimer: string;
  sessionId?: string;
}

export interface HrLawRecord {
  id: string;
  stateCode: string;
  stateName: string;
  topic: HrLawTopic;
  title: string;
  summary: string;
  citation: string;
  sourceUrl?: string;
  effectiveDate?: string;
  updatedAt: string;
}

export interface HrLawUpdate {
  id: string;
  stateCode: string;
  changeType: 'NEW' | 'AMENDED' | 'REPEALED' | 'GUIDANCE_UPDATE' | 'DEADLINE';
  title: string;
  summary: string;
  detectedAt: string;
}

export interface OrgHrLawWatchlist {
  orgId: string;
  stateCodes: string[];
  topics: HrLawTopic[];
  notifyEmails: string[];
  notifyInApp: boolean;
}

/** Human-readable tone scale for UI (1 = best/supportive → 6 = harsh/risky). */
export const OUTREACH_TONE_SCALE: {
  score: number;
  level: OutreachToneLevel;
  label: string;
  description: string;
}[] = [
  { score: 1, level: 'EMPATHETIC', label: 'Empathetic', description: 'Supportive, care-focused — best for sensitive cases' },
  { score: 2, level: 'PROFESSIONAL', label: 'Professional', description: 'Standard HR tone — recommended default' },
  { score: 3, level: 'NEUTRAL', label: 'Neutral', description: 'Factual requests with minimal emotional framing' },
  { score: 4, level: 'DIRECT', label: 'Direct', description: 'Clear deadlines and expectations' },
  { score: 5, level: 'FIRM', label: 'Firm', description: 'Strong policy language — use with caution' },
  { score: 6, level: 'HARSH', label: 'Harsh', description: 'Punitive tone — high legal and reputation risk' },
];

export function toneLabelForScore(score: number): string {
  return OUTREACH_TONE_SCALE.find((t) => t.score === score)?.label ?? `Level ${score}`;
}

export function toneColorClass(score: number): string {
  if (score <= 2) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (score <= 4) return 'text-[var(--color-primary-900)] bg-[var(--color-surface-200)] border-[var(--color-border-200)]';
  if (score === 5) return 'text-amber-800 bg-amber-50 border-amber-200';
  return 'text-red-800 bg-red-50 border-red-200';
}
