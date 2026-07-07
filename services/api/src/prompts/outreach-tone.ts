export const OUTREACH_COACH_SYSTEM = `You are an HR communications coach for employee relations outreach.
Analyze draft messages HR plans to send to employees about open cases (investigations, wage disputes, policy matters).

Score tone from 1 (empathetic, supportive) to 6 (harsh, punitive, legally risky).
Most workplace outreach should target scores 2-4.

Flag risk_flags when language may imply:
- retaliation or punishment for reporting
- promises HR cannot keep
- discriminatory or biased tone
- undue pressure or threats
- sharing confidential investigation details inappropriately

Suggest improved subject and body that preserve HR goals while reducing legal/reputation risk.
Reference applicable state laws only when provided in context — cite by citation string.

Output valid JSON only. Not legal advice.`;

export function buildOutreachCoachUserPrompt(input: {
  subject?: string;
  body: string;
  toneTarget?: number;
  caseCategory?: string;
  caseType?: string;
  stateCode?: string;
  applicableLaws?: { citation: string; summary: string }[];
}): string {
  const lawsBlock =
    input.applicableLaws?.length ?
      `\nApplicable laws:\n${input.applicableLaws.map((l) => `- ${l.citation}: ${l.summary}`).join('\n')}`
    : '';

  return `Analyze this HR outreach draft.

Case category: ${input.caseCategory ?? 'GENERAL'}
Case type: ${input.caseType ?? 'WORKPLACE_INVESTIGATION'}
Employee work state: ${input.stateCode ?? 'unknown'}
Desired tone target (1-6, optional): ${input.toneTarget ?? 'none — recommend best fit'}

Subject: ${input.subject ?? '(none)'}
Body:
"""
${input.body}
"""
${lawsBlock}

Return JSON:
{
  "tone_score": 1-6,
  "tone_level": "EMPATHETIC|PROFESSIONAL|NEUTRAL|DIRECT|FIRM|HARSH",
  "risk_flags": ["..."],
  "rationale": "brief explanation",
  "suggested_subject": "...",
  "suggested_body": "...",
  "applicable_laws": [{ "citation": "...", "summary": "...", "relevance": "..." }]
}`;
}

export const OUTREACH_COACH_JSON_SCHEMA = {
  type: 'object',
  properties: {
    tone_score: { type: 'integer', minimum: 1, maximum: 6 },
    tone_level: { type: 'string' },
    risk_flags: { type: 'array', items: { type: 'string' } },
    rationale: { type: 'string' },
    suggested_subject: { type: 'string' },
    suggested_body: { type: 'string' },
    applicable_laws: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          citation: { type: 'string' },
          summary: { type: 'string' },
          relevance: { type: 'string' },
        },
        required: ['citation', 'summary', 'relevance'],
        additionalProperties: false,
      },
    },
  },
  required: ['tone_score', 'tone_level', 'risk_flags', 'rationale', 'suggested_subject', 'suggested_body', 'applicable_laws'],
  additionalProperties: false,
} as const;

export const PROMPT_VERSION_OUTREACH = 'outreach-coach-v1';

export const TONE_LEVEL_BY_SCORE: Record<number, string> = {
  1: 'EMPATHETIC',
  2: 'PROFESSIONAL',
  3: 'NEUTRAL',
  4: 'DIRECT',
  5: 'FIRM',
  6: 'HARSH',
};

export const TONE_LABELS: Record<string, string> = {
  EMPATHETIC: 'Empathetic — supportive and care-focused',
  PROFESSIONAL: 'Professional — standard HR tone',
  NEUTRAL: 'Neutral — factual, minimal emotion',
  DIRECT: 'Direct — clear expectations and deadlines',
  FIRM: 'Firm — strong policy enforcement language',
  HARSH: 'Harsh — high legal/reputation risk',
};
