import OpenAI from 'openai';

export type OpenAIConfig = {
  apiKey: string;
  defaultModel?: string;
  maxTokensOutreach?: number;
  maxTokensLawResearch?: number;
};

let client: OpenAI | null = null;

export function getOpenAIClient(config?: OpenAIConfig): OpenAI {
  if (client) return client;
  const apiKey = config?.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  client = new OpenAI({ apiKey });
  return client;
}

export function getDefaultModel(): string {
  return process.env.OPENAI_MODEL ?? 'gpt-4.1';
}

export const TOKEN_LIMITS = {
  outreachCoach: Number(process.env.OPENAI_MAX_TOKENS_OUTREACH ?? 1200),
  hrLawResearch: Number(process.env.OPENAI_MAX_TOKENS_LAW_RESEARCH ?? 4000),
} as const;
