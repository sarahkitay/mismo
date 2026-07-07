import { getSupabaseAdmin, isSupabaseConfigured } from './supabase.js';
import { researchStateLaws, hashLawSummary } from '../handlers/hr-law-sync.js';

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

  if (orgId) {
    query = query.or(`org_id.is.null,org_id.eq.${orgId}`);
  }

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

export async function syncStateLawsToDb(
  stateCode: string,
  stateName: string,
  orgId?: string
): Promise<{ inserted: number; updated: number; lawCount: number }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Database not configured');
  }

  const supabase = getSupabaseAdmin();
  const { laws } = await researchStateLaws(stateCode, stateName);

  const { data: jurisdiction, error: jErr } = await supabase
    .from('hr_law_jurisdictions')
    .select('id')
    .eq('state_code', stateCode.toUpperCase())
    .single();

  if (jErr || !jurisdiction) throw new Error(`Jurisdiction not found: ${stateCode}`);

  let inserted = 0;
  let updated = 0;

  for (const law of laws) {
    const contentHash = hashLawSummary(law.summary, law.citation);

    const { data: existing } = await supabase
      .from('hr_law_records')
      .select('id, content_hash')
      .eq('jurisdiction_id', jurisdiction.id)
      .eq('citation', law.citation)
      .eq('is_current', true)
      .maybeSingle();

    if (existing?.content_hash === contentHash) continue;

    if (existing) {
      await supabase.from('hr_law_records').update({ is_current: false }).eq('id', existing.id);
      updated += 1;

      await supabase.from('hr_law_updates').insert({
        org_id: orgId ?? null,
        jurisdiction_id: jurisdiction.id,
        law_record_id: existing.id,
        change_type: 'AMENDED',
        title: law.title,
        summary: law.summary,
        previous_hash: existing.content_hash,
        new_hash: contentHash,
      });
    } else {
      inserted += 1;
      await supabase.from('hr_law_updates').insert({
        org_id: orgId ?? null,
        jurisdiction_id: jurisdiction.id,
        change_type: 'NEW',
        title: law.title,
        summary: law.summary,
        new_hash: contentHash,
      });
    }

    await supabase.from('hr_law_records').insert({
      jurisdiction_id: jurisdiction.id,
      topic: law.topic,
      source_type: law.source_type,
      title: law.title,
      summary: law.summary,
      citation: law.citation,
      source_url: law.source_url,
      effective_date: law.effective_date,
      content_hash: contentHash,
      is_current: true,
    });
  }

  await supabase
    .from('hr_law_jurisdictions')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', jurisdiction.id);

  return { inserted, updated, lawCount: laws.length };
}
