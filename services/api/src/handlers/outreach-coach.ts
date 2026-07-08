import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { z } from 'zod';
import { getDefaultModel, getOpenAIClient, TOKEN_LIMITS } from '../lib/openai.js';
import {
  buildOutreachCoachUserPrompt,
  OUTREACH_COACH_JSON_SCHEMA,
  OUTREACH_COACH_SYSTEM,
  PROMPT_VERSION_OUTREACH,
} from '../prompts/outreach-tone.js';
import { persistOutreachCoachSession } from '../lib/persist-coach.js';

const RequestSchema = z.object({
  orgId: z.string(),
  reportId: z.string().optional(),
  investigationId: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().min(1),
  stateCode: z.string().length(2).optional(),
  caseCategory: z.string().optional(),
  caseType: z.string().optional(),
  toneTarget: z.number().int().min(1).max(6).optional(),
  createdBy: z.string().optional(),
  applicableLaws: z
    .array(z.object({ citation: z.string(), summary: z.string() }))
    .optional(),
});

const CoachResponseSchema = z.object({
  tone_score: z.number().int().min(1).max(6),
  tone_level: z.string(),
  risk_flags: z.array(z.string()),
  rationale: z.string(),
  suggested_subject: z.string(),
  suggested_body: z.string(),
  applicable_laws: z.array(
    z.object({
      citation: z.string(),
      summary: z.string(),
      relevance: z.string(),
    })
  ),
});

export type OutreachCoachRequest = z.infer<typeof RequestSchema>;
export type OutreachCoachResponse = z.infer<typeof CoachResponseSchema> & {
  promptVersion: string;
  model: string;
  disclaimer: string;
  sessionId?: string;
};

export async function runOutreachCoach(input: OutreachCoachRequest): Promise<OutreachCoachResponse> {
  const parsed = RequestSchema.parse(input);
  const openai = getOpenAIClient();
  const model = getDefaultModel();
  const started = Date.now();

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.3,
    max_tokens: TOKEN_LIMITS.outreachCoach,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'outreach_coach',
        strict: true,
        schema: OUTREACH_COACH_JSON_SCHEMA,
      },
    },
    messages: [
      { role: 'system', content: OUTREACH_COACH_SYSTEM },
      {
        role: 'user',
        content: buildOutreachCoachUserPrompt({
          subject: parsed.subject,
          body: parsed.body,
          toneTarget: parsed.toneTarget,
          caseCategory: parsed.caseCategory,
          caseType: parsed.caseType,
          stateCode: parsed.stateCode,
          applicableLaws: parsed.applicableLaws,
        }),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty OpenAI response');

  const result = CoachResponseSchema.parse(JSON.parse(raw));

  const latencyMs = Date.now() - started;
  const sessionId = await persistOutreachCoachSession({
    orgId: parsed.orgId,
    reportId: parsed.reportId,
    investigationId: parsed.investigationId,
    createdBy: parsed.createdBy ?? 'system',
    stateCode: parsed.stateCode,
    caseCategory: parsed.caseCategory,
    caseType: parsed.caseType,
    subject: parsed.subject,
    body: parsed.body,
    toneLevel: result.tone_level,
    toneScore: result.tone_score,
    riskFlags: result.risk_flags,
    suggestedSubject: result.suggested_subject,
    suggestedBody: result.suggested_body,
    rationale: result.rationale,
    applicableLaws: result.applicable_laws,
    model,
    promptVersion: PROMPT_VERSION_OUTREACH,
    tokensIn: completion.usage?.prompt_tokens,
    tokensOut: completion.usage?.completion_tokens,
    latencyMs,
  });

  return {
    ...result,
    promptVersion: PROMPT_VERSION_OUTREACH,
    model,
    disclaimer: 'AI-generated draft for HR review only. Not legal advice.',
    sessionId: sessionId ?? undefined,
  };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (event.requestContext.http.method !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    const body = JSON.parse(event.body ?? '{}') as unknown;
    const result = await runOutreachCoach(body as OutreachCoachRequest);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: message }),
    };
  }
};
