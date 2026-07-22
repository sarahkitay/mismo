/** Structured output schema for state HR law research (OpenAI JSON mode). */
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
        required: ['topic', 'source_type', 'title', 'summary', 'citation', 'source_url', 'effective_date'],
        additionalProperties: false,
      },
    },
  },
  required: ['laws'],
  additionalProperties: false,
} as const;

export const PROMPT_VERSION_HR_LAW = 'hr-law-research-v1';
