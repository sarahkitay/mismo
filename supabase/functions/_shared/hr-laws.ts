import { getSupabaseAdmin, isSupabaseConfigured } from './supabase.ts';

export async function listHrLawsForState(stateCode: string, topic?: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseAdmin();

  const { data: jurisdiction } = await supabase
    .from('hr_law_jurisdictions')
    .select('id, state_code, state_name')
    .eq('state_code', stateCode.toUpperCase())
    .maybeSingle();

  if (!jurisdiction) return [];

  let query = supabase
    .from('hr_law_records')
    .select('id, topic, title, summary, citation, source_url, effective_date, updated_at')
    .eq('jurisdiction_id', jurisdiction.id)
    .eq('is_current', true)
    .order('topic');

  if (topic) query = query.eq('topic', topic);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    stateCode: jurisdiction.state_code,
    stateName: jurisdiction.state_name,
    topic: row.topic,
    title: row.title,
    summary: row.summary,
    citation: row.citation,
    sourceUrl: row.source_url ?? undefined,
    effectiveDate: row.effective_date ?? undefined,
    updatedAt: row.updated_at,
  }));
}

export async function listHrLawUpdates(orgId?: string, limit = 20) {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('hr_law_updates')
    .select('id, change_type, title, summary, detected_at, jurisdiction_id, org_id')
    .order('detected_at', { ascending: false })
    .limit(limit);

  if (orgId) query = query.or(`org_id.is.null,org_id.eq.${orgId}`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const jurisdictionIds = [...new Set((data ?? []).map((u) => u.jurisdiction_id))];
  const { data: jurisdictions } = await supabase
    .from('hr_law_jurisdictions')
    .select('id, state_code')
    .in('id', jurisdictionIds.length ? jurisdictionIds : ['00000000-0000-0000-0000-000000000000']);

  const stateByJurisdiction = new Map((jurisdictions ?? []).map((j) => [j.id, j.state_code]));

  return (data ?? []).map((row) => ({
    id: row.id,
    stateCode: stateByJurisdiction.get(row.jurisdiction_id) ?? '??',
    changeType: row.change_type,
    title: row.title,
    summary: row.summary,
    detectedAt: row.detected_at,
  }));
}

/** Law sync with OpenAI research is available via the local API until full sync is ported here. */
export async function syncStateLawsPlaceholder(stateCode: string, stateName: string) {
  const existing = await listHrLawsForState(stateCode);
  return {
    ok: true,
    stateCode: stateCode.toUpperCase(),
    lawCount: existing.length,
    inserted: 0,
    updated: 0,
    message:
      existing.length > 0
        ? `Loaded ${existing.length} law record(s) from Supabase for ${stateName}.`
        : `No laws in database for ${stateName} yet. Run SQL seed (02_ai_hr_laws.sql) or sync via local API with OpenAI.`,
  };
}
