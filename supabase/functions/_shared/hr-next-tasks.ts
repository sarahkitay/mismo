import { getSupabaseAdmin, isSupabaseConfigured } from './supabase.ts';
import { getDefaultModel, getOpenAIClient, isOpenAiConfigured } from './openai.ts';

export type HrNextTask = {
  id: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  detail: string;
  action: string;
  count?: number;
  source?: 'database' | 'snapshot' | 'ai';
};

export type DashboardSnapshot = {
  payrollExpedited?: number;
  needsInfo?: number;
  wageHour?: number;
  yesReview?: number;
  unassigned?: number;
  lawUpdates?: number;
  atRiskEmployees?: number;
  unansweredPrompts?: number;
  openInvestigations?: number;
};

function buildTasksFromCounts(
  counts: {
    payroll: number;
    needsInfo: number;
    wageHour: number;
    yesReview: number;
    lawUpdates: number;
    unassigned: number;
    atRiskEmployees?: number;
    unansweredPrompts?: number;
    openInvestigations?: number;
  },
  source: HrNextTask['source']
): HrNextTask[] {
  const tasks: HrNextTask[] = [];

  if (counts.payroll > 0) {
    tasks.push({
      id: 'payroll-expedited',
      priority: 'URGENT',
      title: 'Payroll issues - 24h administrator action',
      detail: `${counts.payroll} expedited payroll memo(s) require resolution within SLA.`,
      action: 'prompt-responses?view=register&register=1&channel=register&status=PAYROLL_EXPEDITED',
      count: counts.payroll,
      source,
    });
  }
  if (counts.yesReview > 0) {
    tasks.push({
      id: 'yes-review',
      priority: 'HIGH',
      title: 'Yes check-in responses need review',
      detail: `${counts.yesReview} employee(s) answered Yes on a check-in and need HR triage.`,
      action: 'prompt-responses?view=prompts&answer=HAS_ISSUE&needs_review=1&channel=incident',
      count: counts.yesReview,
      source,
    });
  }
  if (counts.needsInfo > 0) {
    tasks.push({
      id: 'needs-info',
      priority: 'HIGH',
      title: 'Cases awaiting employee clarification',
      detail: `${counts.needsInfo} report(s) are waiting on additional information.`,
      action: 'prompt-responses?view=register&register=1&channel=register&needs_info=1',
      count: counts.needsInfo,
      source,
    });
  }
  if ((counts.unansweredPrompts ?? 0) > 0) {
    tasks.push({
      id: 'unanswered-prompts',
      priority: 'HIGH',
      title: 'Daily check-ins not answered',
      detail: `${counts.unansweredPrompts} employee(s) have not completed a required check-in.`,
      action: 'prompt-responses?view=prompts&bucket=UNANSWERED&channel=incident',
      count: counts.unansweredPrompts,
      source,
    });
  }
  if (counts.wageHour > 0) {
    tasks.push({
      id: 'wage-hour',
      priority: 'MEDIUM',
      title: 'Wage & hour intakes pending review',
      detail: `${counts.wageHour} wage & hour report sheet(s) need HR review.`,
      action: 'prompt-responses?view=register&register=1&channel=register&status=PENDING_WAGE_HOUR_REVIEW',
      count: counts.wageHour,
      source,
    });
  }
  if (counts.unassigned > 0) {
    tasks.push({
      id: 'unassigned',
      priority: 'MEDIUM',
      title: 'Unassigned new cases',
      detail: `${counts.unassigned} case(s) have no assigned owner yet.`,
      action: 'prompt-responses?view=register&register=1&channel=register&unassigned=1',
      count: counts.unassigned,
      source,
    });
  }
  if ((counts.atRiskEmployees ?? 0) > 0) {
    tasks.push({
      id: 'at-risk',
      priority: 'MEDIUM',
      title: 'At-risk employees need outreach',
      detail: `${counts.atRiskEmployees} employee(s) show low engagement or missed responses.`,
      action: 'users?atRisk=true',
      count: counts.atRiskEmployees,
      source,
    });
  }
  if ((counts.openInvestigations ?? 0) > 0) {
    tasks.push({
      id: 'investigations',
      priority: 'MEDIUM',
      title: 'Open investigations in progress',
      detail: `${counts.openInvestigations} investigation(s) are active and may need follow-up.`,
      action: 'investigations?status=OPEN',
      count: counts.openInvestigations,
      source,
    });
  }
  if (counts.lawUpdates > 0) {
    tasks.push({
      id: 'law-updates',
      priority: 'MEDIUM',
      title: 'State HR law updates to review',
      detail: `${counts.lawUpdates} new or amended law summary(ies) detected for your watched states.`,
      action: 'compliance?tab=STATE_NEXUS',
      count: counts.lawUpdates,
      source,
    });
  }

  return tasks;
}

async function fetchDbCounts(orgId: string) {
  const supabase = getSupabaseAdmin();
  const [payrollRes, needsInfoRes, wageHourRes, yesReviewRes, lawUpdatesRes, unassignedRes] =
    await Promise.all([
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'PAYROLL_EXPEDITED'),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'NEEDS_INFO'),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'PENDING_WAGE_HOUR_REVIEW'),
      supabase
        .from('prompt_responses')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('answer', 'HAS_ISSUE')
        .eq('needs_review', true)
        .is('reviewed_at', null),
      supabase
        .from('hr_law_updates')
        .select('id', { count: 'exact', head: true })
        .or(`org_id.is.null,org_id.eq.${orgId}`)
        .is('notified_at', null),
      supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .in('status', ['NEW', 'TRIAGED'])
        .is('assigned_to', null),
    ]);

  return {
    payroll: payrollRes.count ?? 0,
    needsInfo: needsInfoRes.count ?? 0,
    wageHour: wageHourRes.count ?? 0,
    yesReview: yesReviewRes.count ?? 0,
    lawUpdates: lawUpdatesRes.count ?? 0,
    unassigned: unassignedRes.count ?? 0,
  };
}

async function generateAiRecommendations(
  orgId: string,
  snapshot: DashboardSnapshot,
  existing: HrNextTask[]
): Promise<HrNextTask[]> {
  if (!isOpenAiConfigured()) return [];
  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: getDefaultModel(),
      temperature: 0.3,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are an HR operations advisor. Given dashboard counts, suggest up to 2 additional next actions HR should take. Return JSON: { "recommendations": [{ "priority": "URGENT|HIGH|MEDIUM|LOW", "title": string, "detail": string, "action": string }] }. Actions are app routes like users?atRisk=true or compliance?tab=STATE_NEXUS. Do not duplicate items already listed.',
        },
        {
          role: 'user',
          content: JSON.stringify({ orgId, snapshot, existingTitles: existing.map((t) => t.title) }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      recommendations?: { priority: HrNextTask['priority']; title: string; detail: string; action: string }[];
    };
    return (parsed.recommendations ?? []).slice(0, 2).map((rec, index) => ({
      id: `ai-rec-${index}`,
      priority: rec.priority,
      title: rec.title,
      detail: rec.detail,
      action: rec.action,
      source: 'ai' as const,
    }));
  } catch (err) {
    console.error('AI next-task recommendations failed:', err);
    return [];
  }
}

export async function computeHrNextTasks(
  orgId: string,
  snapshot?: DashboardSnapshot
): Promise<{ tasks: HrNextTask[]; aiEnabled: boolean; dataSource: 'database' | 'snapshot' | 'mixed' }> {
  let dbCounts = {
    payroll: 0,
    needsInfo: 0,
    wageHour: 0,
    yesReview: 0,
    lawUpdates: 0,
    unassigned: 0,
  };

  let loadedFromDb = false;
  if (isSupabaseConfigured()) {
    try {
      dbCounts = await fetchDbCounts(orgId);
      loadedFromDb = true;
    } catch (err) {
      console.error('Failed to load HR next tasks from database:', err);
    }
  }

  const mergedCounts = {
    payroll: dbCounts.payroll || snapshot?.payrollExpedited || 0,
    needsInfo: dbCounts.needsInfo || snapshot?.needsInfo || 0,
    wageHour: dbCounts.wageHour || snapshot?.wageHour || 0,
    yesReview: dbCounts.yesReview || snapshot?.yesReview || 0,
    lawUpdates: dbCounts.lawUpdates || snapshot?.lawUpdates || 0,
    unassigned: dbCounts.unassigned || snapshot?.unassigned || 0,
    atRiskEmployees: snapshot?.atRiskEmployees,
    unansweredPrompts: snapshot?.unansweredPrompts,
    openInvestigations: snapshot?.openInvestigations,
  };

  const dbTotal = Object.values(dbCounts).reduce((sum, n) => sum + n, 0);
  const source: HrNextTask['source'] = dbTotal > 0 ? 'database' : snapshot ? 'snapshot' : 'database';
  const tasks = buildTasksFromCounts(mergedCounts, source);

  const aiSnapshot: DashboardSnapshot = {
    payrollExpedited: mergedCounts.payroll,
    needsInfo: mergedCounts.needsInfo,
    wageHour: mergedCounts.wageHour,
    yesReview: mergedCounts.yesReview,
    lawUpdates: mergedCounts.lawUpdates,
    unassigned: mergedCounts.unassigned,
    atRiskEmployees: mergedCounts.atRiskEmployees,
    unansweredPrompts: mergedCounts.unansweredPrompts,
    openInvestigations: mergedCounts.openInvestigations,
  };

  if (isOpenAiConfigured()) {
    const aiTasks = await generateAiRecommendations(orgId, aiSnapshot, tasks);
    tasks.push(...aiTasks);
  }

  const order = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  tasks.sort((a, b) => order[a.priority] - order[b.priority]);

  return {
    tasks,
    aiEnabled: isOpenAiConfigured(),
    dataSource: loadedFromDb ? (snapshot ? 'mixed' : 'database') : snapshot ? 'snapshot' : 'database',
  };
}
