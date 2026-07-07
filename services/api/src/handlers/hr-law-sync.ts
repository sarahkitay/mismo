import { createHash } from 'node:crypto';
import type { ScheduledHandler } from 'aws-lambda';
import { getDefaultModel, getOpenAIClient, TOKEN_LIMITS } from '../lib/openai.js';
import {
  buildHrLawResearchUserPrompt,
  HR_LAW_RESEARCH_JSON_SCHEMA,
  HR_LAW_RESEARCH_SYSTEM,
  PROMPT_VERSION_HR_LAW,
} from '../prompts/hr-law-research.js';

type LawEntry = {
  topic: string;
  source_type: string;
  title: string;
  summary: string;
  citation: string;
  source_url: string;
  effective_date?: string | null;
};

export function hashLawSummary(summary: string, citation: string): string {
  return createHash('sha256').update(`${citation}::${summary.trim()}`).digest('hex');
}

/**
 * Research laws for one state via OpenAI structured output.
 * Persist + diff is done against RDS in production (see docs/OPENAI_HR_ASSISTANT.md).
 */
export async function researchStateLaws(
  stateCode: string,
  stateName: string,
  topics: string[] = ['WAGE_HOUR', 'RETALIATION', 'HARASSMENT', 'LEAVE']
): Promise<{ laws: LawEntry[]; contentHashes: string[] }> {
  const openai = getOpenAIClient();
  const model = getDefaultModel();

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: TOKEN_LIMITS.hrLawResearch,
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

  const parsed = JSON.parse(raw) as { laws: LawEntry[] };
  const contentHashes = parsed.laws.map((l) => hashLawSummary(l.summary, l.citation));

  return { laws: parsed.laws, contentHashes };
}

/** Weekly EventBridge target — sync watched states from org_hr_law_watchlists. */
export const handler: ScheduledHandler = async () => {
  // TODO: load watchlist union from RDS
  const watchedStates = [{ code: 'CA', name: 'California' }];

  for (const state of watchedStates) {
    const { laws, contentHashes } = await researchStateLaws(state.code, state.name);
    // TODO: upsert hr_law_records, insert hr_law_updates on hash mismatch
    console.log(JSON.stringify({
      job: 'HR_LAW_SYNC',
      promptVersion: PROMPT_VERSION_HR_LAW,
      state: state.code,
      lawCount: laws.length,
      sampleHash: contentHashes[0],
    }));
  }
};
