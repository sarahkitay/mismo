import { getDefaultModel, getOpenAIClient, isOpenAiConfigured } from './openai.ts';
import { getSupabaseAdmin, isSupabaseConfigured } from './supabase.ts';

const OUTREACH_COACH_SYSTEM = `You are an HR communications coach for employee relations case notes and outreach.
Score tone from 1 (empathetic) to 6 (harsh, legally risky). Target 2-4 for most workplace notes.
Return JSON only with keys: tone_score, tone_level, risk_flags, rationale, suggested_subject, suggested_body, applicable_laws.
applicable_laws is an array of { citation, summary, relevance }. Not legal advice.
Never invent facts not supported by the provided source material. Keep notes factual, non-punitive, and suitable for an HR case file.`;

const TONE_HINT: Record<number, string> = {
  1: 'Empathetic — supportive, care-focused wording',
  2: 'Professional — clear standard HR tone',
  3: 'Neutral — factual, minimal emotion',
  4: 'Direct — clear expectations and next steps',
  5: 'Firm — strong policy language (use carefully)',
  6: 'Harsh — avoid; high legal risk',
};

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
  task?: 'soften' | 'employee_outcome';
  sourceMaterial?: string;
};

function buildUserContent(input: OutreachCoachRequest): string {
  const tone =
    input.toneTarget != null
      ? `${input.toneTarget} (${TONE_HINT[input.toneTarget] ?? 'custom'})`
      : 'recommend best fit (prefer 2–3)';

  if (input.task === 'employee_outcome') {
    return JSON.stringify({
      task: 'employee_outcome',
      instructions: [
        'Draft or revise the Employee Response Outcome case note.',
        'Base the note on Actual Response (what HR said or did with the employee).',
        'Describe how the employee responded and sensible next steps for the case file.',
        'If an existing outcome draft is provided, refine it; otherwise generate a fresh draft from Actual Response.',
        'Do not invent employee statements that are not implied by the source.',
        'suggested_body must be the full outcome note only (no subject line fluff).',
        'Match the preferred tone target.',
      ],
      preferredTone: tone,
      caseCategory: input.caseCategory,
      caseType: input.caseType,
      stateCode: input.stateCode,
      actualResponse: input.sourceMaterial ?? '',
      existingOutcomeDraft: input.body?.trim() || null,
      subject: input.subject,
      applicableLaws: input.applicableLaws,
    });
  }

  return JSON.stringify({
    task: 'soften',
    subject: input.subject,
    body: input.body,
    stateCode: input.stateCode,
    caseCategory: input.caseCategory,
    caseType: input.caseType,
    toneTarget: input.toneTarget,
    preferredTone: tone,
    applicableLaws: input.applicableLaws,
  });
}

export async function runOutreachCoach(input: OutreachCoachRequest) {
  const isOutcome = input.task === 'employee_outcome';
  const hasBody = Boolean(input.body?.trim());
  const hasSource = Boolean(input.sourceMaterial?.trim());

  if (isOutcome) {
    if (!hasBody && !hasSource) {
      throw new Error('Add an Actual Response (or an outcome draft) before generating.');
    }
  } else if (!hasBody) {
    throw new Error('body is required');
  }

  if (!isOpenAiConfigured()) throw new Error('OPENAI_API_KEY is not configured on the API server');

  const openai = getOpenAIClient();
  const model = getDefaultModel();
  const started = Date.now();

  // Persist path needs a non-empty original_body; use source when generating fresh.
  const originalBody =
    input.body?.trim() ||
    (isOutcome ? `[generated from actual response]\n${input.sourceMaterial?.trim() ?? ''}` : '');

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.35,
    max_tokens: Number(Deno.env.get('OPENAI_MAX_TOKENS_OUTREACH') ?? 1200),
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: OUTREACH_COACH_SYSTEM },
      { role: 'user', content: buildUserContent(input) },
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
          prompt_version: isOutcome ? 'edge-outcome-v1' : 'edge-v1',
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
          case_context: {
            category: input.caseCategory,
            caseType: input.caseType,
            task: input.task ?? 'soften',
          },
          original_subject: input.subject ?? null,
          original_body: originalBody,
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
    promptVersion: isOutcome ? 'edge-outcome-v1' : 'edge-v1',
    model,
    disclaimer: 'AI-generated draft for HR review only. Not legal advice.',
    sessionId: sessionId ?? undefined,
  };
}
