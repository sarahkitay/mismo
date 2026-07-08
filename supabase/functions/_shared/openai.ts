import OpenAI from 'openai';

export function getOpenAIClient(): OpenAI {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  return new OpenAI({ apiKey });
}

export function getDefaultModel(): string {
  return Deno.env.get('OPENAI_MODEL') ?? 'gpt-4.1-mini';
}

export function isOpenAiConfigured(): boolean {
  return Boolean(Deno.env.get('OPENAI_API_KEY'));
}
