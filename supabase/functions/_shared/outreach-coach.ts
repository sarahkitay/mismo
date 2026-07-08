import { getDefaultModel, getOpenAIClient, isOpenAiConfigured } from './openai.ts';
import { getSupabaseAdmin, isSupabaseConfigured } from './supabase.ts';

const OUTREACH_COACH_SYSTEM = `You are an HR communications coach for employee relations outreach.
Analyze draft messages HR plans to send to employees about open cases.
Score tone from 1 (empathetic) to 6 (harsh, legally risky). Target 2-4 for most outreach.
Return JSON only with keys: tone_score, tone_level, risk_flags, rationale, suggested_subject, suggested_body, applicable_laws.
applicable_laws is an array of { citation, summary, relevance }. Not legal advice.`;

export type OutreachCoachRequest = {
  orgId: string;
  reportId?: string;
  investigationId?: string;
  subject?: string;
  body: string;
  stateCode?: string;
  caseCategory?: string;
  caseType?: string;
  toneTarget?: number;
  createdBy?: string;
  applicableLaws?: { citation: string; summary: string }[];
};

export async function runOutreachCoach(input: OutreachCoachRequest) {
  if (!input.body?.trim()) throw new Error('body is required');
  if (!isOpenAiConfigured()) throw new Error('OPENAI_API_KEY is not configured on the API server');

  const openai = getOpenAIClient();
  const model = getDefaultModel();
  const started = Date.now();

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.3,
    max_tokens: Number(Deno.env.get('OPENAI_MAX_TOKENS_OUTREACH') ?? 1200),
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: OUTREACH_COACH_SYSTEM },
      {
        role: 'user',
        content: JSON.stringify({
          subject: input.subject,
          body: input.body,
          stateCode: input.stateCode,
          caseCategory: input.caseCategory,
          caseType: input.caseType,
          toneTarget: input.toneTarget,
          applicableLaws: input.applicableLaws,
        }),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty OpenAI response');

  const result = JSON.parse(raw) as {
    tone_score: number;
    tone_level: string;
    risk_flags: string[];
    rationale: string;
    suggested_subject: string;
    suggested_body: string;
    applicable_laws: { citation: string; summary: string; relevance: string }[];
  };

  const latencyMs = Date.now() - started;
  let sessionId: string | null = null;

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      const { data: job } = await supabase
        .from('ai_job_runs')
        .insert({
          org_id: input.orgId,
          job_type: 'OUTREACH_COACH',
          status: 'SUCCEEDED',
          model,
          prompt_version: 'edge-v1',
          input_ref: input.reportId ?? input.investigationId ?? null,
          tokens_in: completion.usage?.prompt_tokens ?? null,
          tokens_out: completion.usage?.completion_tokens ?? null,
          latency_ms: latencyMs,
          result_summary: `Tone ${result.tone_score}/6 (${result.tone_level})`,
          started_at: new Date(started).toISOString(),
          finished_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      const { data: session } = await supabase
        .from('outreach_coach_sessions')
        .insert({
          org_id: input.orgId,
          report_id: input.reportId ?? null,
          investigation_id: input.investigationId ?? null,
          created_by: input.createdBy ?? 'system',
          jurisdiction: input.stateCode ?? null,
          case_context: { category: input.caseCategory, caseType: input.caseType },
          original_subject: input.subject ?? null,
          original_body: input.body,
          tone_level: result.tone_level,
          tone_score: result.tone_score,
          risk_flags: result.risk_flags,
          suggested_subject: result.suggested_subject,
          suggested_body: result.suggested_body,
          rationale: result.rationale,
          applicable_laws: result.applicable_laws,
          ai_job_run_id: job?.id ?? null,
        })
        .select('id')
        .single();

      sessionId = session?.id ?? null;
    } catch (err) {
      console.error('Coach persistence failed:', err);
    }
  }

  return {
    ...result,
    promptVersion: 'edge-v1',
    model,
    disclaimer: 'AI-generated draft for HR review only. Not legal advice.',
    sessionId: sessionId ?? undefined,
  };
}
