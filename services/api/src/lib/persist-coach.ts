import { getSupabaseAdmin, isSupabaseConfigured } from './supabase.js';

export type CoachPersistInput = {
  orgId: string;
  reportId?: string;
  investigationId?: string;
  createdBy: string;
  stateCode?: string;
  caseCategory?: string;
  caseType?: string;
  subject?: string;
  body: string;
  toneLevel: string;
  toneScore: number;
  riskFlags: string[];
  suggestedSubject: string;
  suggestedBody: string;
  rationale: string;
  applicableLaws: unknown[];
  model: string;
  promptVersion: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
};

export async function persistOutreachCoachSession(input: CoachPersistInput): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseAdmin();
  const started = new Date();

  const { data: job, error: jobErr } = await supabase
    .from('ai_job_runs')
    .insert({
      org_id: input.orgId,
      job_type: 'OUTREACH_COACH',
      status: 'SUCCEEDED',
      model: input.model,
      prompt_version: input.promptVersion,
      input_ref: input.reportId ?? input.investigationId ?? null,
      tokens_in: input.tokensIn ?? null,
      tokens_out: input.tokensOut ?? null,
      latency_ms: input.latencyMs ?? null,
      result_summary: `Tone ${input.toneScore}/6 (${input.toneLevel})`,
      started_at: started.toISOString(),
      finished_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (jobErr) {
    console.error('ai_job_runs insert failed:', jobErr.message);
  }

  const { data: session, error: sessionErr } = await supabase
    .from('outreach_coach_sessions')
    .insert({
      org_id: input.orgId,
      report_id: input.reportId ?? null,
      investigation_id: input.investigationId ?? null,
      created_by: input.createdBy,
      jurisdiction: input.stateCode ?? null,
      case_context: {
        category: input.caseCategory,
        caseType: input.caseType,
      },
      original_subject: input.subject ?? null,
      original_body: input.body,
      tone_level: input.toneLevel,
      tone_score: input.toneScore,
      risk_flags: input.riskFlags,
      suggested_subject: input.suggestedSubject,
      suggested_body: input.suggestedBody,
      rationale: input.rationale,
      applicable_laws: input.applicableLaws,
      ai_job_run_id: job?.id ?? null,
    })
    .select('id')
    .single();

  if (sessionErr) {
    console.error('outreach_coach_sessions insert failed:', sessionErr.message);
    return null;
  }

  return session?.id ?? null;
}
