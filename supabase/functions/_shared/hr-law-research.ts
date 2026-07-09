import { getDefaultModel, getOpenAIClient, isOpenAiConfigured } from './openai.ts';

export const HR_LAW_RESEARCH_SYSTEM = `You are a legal research assistant for US employment law.
You summarize statutes and agency guidance for HR professionals.
Rules:
- Only cite official sources (state .gov labor sites, DOL, official code databases).
- If uncertain, say so and omit the entry rather than invent citations.
- Focus on practical HR obligations: wage/hour, leave, harassment, retaliation, safety, recordkeeping.
- Output valid JSON matching the schema exactly.
- This is informational research, not legal advice.`;

export function buildHrLawResearchUserPrompt(stateCode: string, stateName: string, topics: string[]): string {
  return `Research current employment laws for ${stateName} (${stateCode}).
Topics to cover: ${topics.join(', ')}.

For each distinct law or requirement return:
- topic (WAGE_HOUR | LEAVE | DISCRIMINATION | HARASSMENT | RETALIATION | WORKPLACE_SAFETY | PRIVACY | RECORDKEEPING | UNEMPLOYMENT | OTHER)
- source_type (STATUTE | REGULATION | AGENCY_GUIDANCE | POSTER_REQUIREMENT | OTHER)
- title
- summary (2-4 sentences, HR-actionable)
- citation (official cite string)
- source_url (https URL to official source)
- effective_date (ISO date or null)

Return JSON: { "laws": [ ... ] }`;
}

export const HR_LAW_RESEARCH_JSON_SCHEMA = {
  type: 'object',
  properties: {
    laws: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          source_type: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          citation: { type: 'string' },
          source_url: { type: 'string' },
          effective_date: { type: ['string', 'null'] },
        },
        required: ['topic', 'title', 'summary', 'citation', 'source_url'],
        additionalProperties: false,
      },
    },
  },
  required: ['laws'],
  additionalProperties: false,
} as const;

export type LawEntry = {
  topic: string;
  source_type: string;
  title: string;
  summary: string;
  citation: string;
  source_url: string;
  effective_date?: string | null;
};

export async function hashLawSummary(summary: string, citation: string): Promise<string> {
  const data = new TextEncoder().encode(`${citation}::${summary.trim()}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function researchStateLaws(
  stateCode: string,
  stateName: string,
  topics: string[] = ['WAGE_HOUR', 'RETALIATION', 'HARASSMENT', 'LEAVE', 'WORKPLACE_SAFETY', 'RECORDKEEPING']
): Promise<{ laws: LawEntry[] }> {
  if (!isOpenAiConfigured()) {
    throw new Error('OPENAI_API_KEY is not configured on the API server');
  }

  const openai = getOpenAIClient();
  const model = getDefaultModel();

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: Number(Deno.env.get('OPENAI_MAX_TOKENS_LAW_RESEARCH') ?? 4000),
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'hr_law_research',
        strict: true,
        schema: HR_LAW_RESEARCH_JSON_SCHEMA,
      },
    },
    messages: [
      { role: 'system', content: HR_LAW_RESEARCH_SYSTEM },
      { role: 'user', content: buildHrLawResearchUserPrompt(stateCode, stateName, topics) },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty OpenAI response');

  return JSON.parse(raw) as { laws: LawEntry[] };
}
