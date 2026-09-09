import type { Investigation, Policy, Report, ReportCategory } from '@/types';
import { getCategoryLabel } from '@/lib/utils';
import { getAllInvestigationEvidence } from '@/lib/investigationWorkflow';

export type PolicySuggestionConfidence = 'high' | 'medium' | 'low';

export interface PolicySuggestion {
  policyId: string;
  title: string;
  confidence: PolicySuggestionConfidence;
  score: number;
  reasons: string[];
  /** Short excerpt from policy body that matched case language */
  excerpt?: string;
  memoCategory?: string;
  policyType: Policy['type'];
}

const CATEGORY_KEYWORDS: Record<ReportCategory, string[]> = {
  HARASSMENT: [
    'harassment',
    'hostile',
    'sexual',
    'bullying',
    'intimidation',
    'unwelcome',
    'conduct',
    'anti-harassment',
    'workplace behavior',
  ],
  DISCRIMINATION: [
    'discrimination',
    'equal employment',
    'eeo',
    'protected class',
    'bias',
    'disparate',
    'title vii',
    'ada',
    'accommodation',
  ],
  RETALIATION: [
    'retaliation',
    'whistleblower',
    'protected activity',
    'reprisal',
    'non-retaliation',
    'complaint process',
  ],
  SAFETY: [
    'safety',
    'osha',
    'hazard',
    'injury',
    'ppe',
    'workplace violence',
    'emergency',
    'incident reporting',
  ],
  THEFT: ['theft', 'fraud', 'misappropriation', 'asset', 'inventory', 'dishonesty', 'code of ethics'],
  WAGE_HOURS: [
    'wage',
    'overtime',
    'payroll',
    'hours of work',
    'break breaks',
    'classification',
    'timekeeping',
    'compensation',
  ],
  OTHER: ['conduct', 'policy', 'handbook', 'standards', 'ethics', 'professional'],
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9&]+/)
    .filter((t) => t.length > 2);
}

function extractExcerpt(content: string, terms: string[], maxLen = 180): string | undefined {
  const lower = content.toLowerCase();
  for (const term of terms) {
    const idx = lower.indexOf(term.toLowerCase());
    if (idx < 0) continue;
    const start = Math.max(0, idx - 40);
    const end = Math.min(content.length, idx + term.length + 120);
    let snippet = content.slice(start, end).replace(/\s+/g, ' ').trim();
    if (start > 0) snippet = `…${snippet}`;
    if (end < content.length) snippet = `${snippet}…`;
    return snippet.slice(0, maxLen);
  }
  const plain = content.replace(/\s+/g, ' ').trim();
  return plain ? plain.slice(0, maxLen) + (plain.length > maxLen ? '…' : '') : undefined;
}

function caseCorpus(inv: Investigation, report?: Report): string {
  const evidence = getAllInvestigationEvidence(inv);
  return [
    inv.category ?? '',
    inv.investigationType ?? '',
    inv.findingsRationale ?? '',
    inv.policyAnalysisNotes ?? '',
    inv.initialContactNotes ?? '',
    report?.summary ?? '',
    report?.description ?? '',
    report?.category ?? '',
    ...(inv.notes ?? []).map((n) => n.body),
    ...evidence.map((e) => `${e.fileName} ${'description' in e && e.description ? e.description : ''} ${e.promptLabel ?? ''}`),
  ]
    .join(' ')
    .toLowerCase();
}

function confidenceForScore(score: number): PolicySuggestionConfidence {
  if (score >= 12) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
}

/**
 * Rank published policies against investigation facts and report language.
 * Deterministic local matching (no model call) so suggestions always appear.
 */
export function suggestPoliciesForInvestigation(
  inv: Investigation,
  policies: Policy[],
  report?: Report,
  options?: { limit?: number; minScore?: number }
): PolicySuggestion[] {
  const limit = options?.limit ?? 8;
  const minScore = options?.minScore ?? 3;
  const published = policies.filter((p) => p.status === 'PUBLISHED');
  const category = (inv.category ?? report?.category ?? 'OTHER') as ReportCategory;
  const categoryKeywords = CATEGORY_KEYWORDS[category] ?? CATEGORY_KEYWORDS.OTHER;
  const corpus = caseCorpus(inv, report);
  const corpusTokens = new Set(tokenize(corpus));
  const categoryLabel = getCategoryLabel(category).toLowerCase();

  const suggestions: PolicySuggestion[] = [];

  for (const policy of published) {
    const haystack = normalize(
      `${policy.title} ${policy.memoCategory ?? ''} ${policy.type} ${(policy.tags ?? []).join(' ')} ${policy.content}`
    );
    const reasons: string[] = [];
    let score = 0;
    const matchedTerms: string[] = [];

    if (corpus.includes(normalize(policy.title)) || haystack.includes(categoryLabel)) {
      score += 5;
      reasons.push(`Title/category aligns with ${getCategoryLabel(category)}`);
    }

    for (const kw of categoryKeywords) {
      if (haystack.includes(kw)) {
        score += 2;
        matchedTerms.push(kw);
      }
    }
    if (matchedTerms.length) {
      reasons.push(`Matches allegation themes: ${matchedTerms.slice(0, 4).join(', ')}`);
    }

    const policyTokens = tokenize(`${policy.title} ${policy.memoCategory ?? ''} ${(policy.tags ?? []).join(' ')}`);
    let overlap = 0;
    for (const token of policyTokens) {
      if (corpusTokens.has(token) && token.length > 3) overlap += 1;
    }
    if (overlap >= 2) {
      score += Math.min(6, overlap);
      reasons.push(`Shared language with case record (${overlap} terms)`);
    }

    if (policy.type === 'CONDUCT' && ['HARASSMENT', 'DISCRIMINATION', 'RETALIATION', 'OTHER'].includes(category)) {
      score += 2;
      reasons.push('Conduct policy type fits allegation class');
    }
    if (policy.type === 'SAFETY' && category === 'SAFETY') {
      score += 3;
      reasons.push('Safety policy type matches safety allegation');
    }
    if (policy.type === 'LEGAL' && ['DISCRIMINATION', 'RETALIATION', 'WAGE_HOURS'].includes(category)) {
      score += 2;
      reasons.push('Legal/compliance memo may apply');
    }

    const memo = (policy.memoCategory ?? '').toLowerCase();
    if (memo && (corpus.includes(memo) || categoryKeywords.some((k) => memo.includes(k)))) {
      score += 2;
      reasons.push(`Memo category: ${policy.memoCategory}`);
    }

    if (score < minScore) continue;

    suggestions.push({
      policyId: policy.id,
      title: policy.title,
      confidence: confidenceForScore(score),
      score,
      reasons: reasons.slice(0, 3),
      excerpt: extractExcerpt(policy.content || policy.title, matchedTerms.length ? matchedTerms : categoryKeywords.slice(0, 3)),
      memoCategory: policy.memoCategory,
      policyType: policy.type,
    });
  }

  return suggestions.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}

/** High-confidence policy IDs safe to auto-link without HR confirmation. */
export function autoLinkPolicyIds(suggestions: PolicySuggestion[], existingIds: string[] = []): string[] {
  const high = suggestions.filter((s) => s.confidence === 'high').map((s) => s.policyId);
  const mediumTop = suggestions.filter((s) => s.confidence === 'medium').slice(0, 2).map((s) => s.policyId);
  return Array.from(new Set([...existingIds, ...high, ...mediumTop]));
}

export function buildSuggestedPolicyAnalysisNotes(
  suggestions: PolicySuggestion[],
  category?: ReportCategory
): string {
  if (!suggestions.length) {
    return [
      `Allegation class: ${category ? getCategoryLabel(category) : 'Other'}.`,
      'No published policies scored as a strong match yet. Link handbook sections manually or publish relevant memos, then re-run suggestions.',
    ].join('\n');
  }

  const lines = [
    `Suggested policy mapping for ${category ? getCategoryLabel(category) : 'this allegation'}:`,
    '',
  ];
  for (const s of suggestions.slice(0, 5)) {
    lines.push(`• ${s.title} (${s.confidence} confidence)`);
    if (s.reasons[0]) lines.push(`  - ${s.reasons[0]}`);
    if (s.excerpt) lines.push(`  - Excerpt: "${s.excerpt}"`);
  }
  lines.push(
    '',
    'Review each linked policy against the evidence timeline. Note any conduct concerns that may not rise to a policy violation.'
  );
  return lines.join('\n');
}
