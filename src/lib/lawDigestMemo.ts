import type { HrLawRecord } from '@/types/aiServices';
import type { LawDigestEntry, LawDigestMeta, Policy, PolicyAcknowledgement, User } from '@/types';

export const LAW_DIGEST_TAG = 'LAW_DIGEST';

export function lawDigestStateTag(stateCode: string): string {
  return `LAW_DIGEST_${stateCode.toUpperCase()}`;
}

export function isLawDigestPolicy(policy: Policy): boolean {
  return Boolean(policy.lawDigest?.entries?.length) || (policy.tags ?? []).includes(LAW_DIGEST_TAG);
}

export function toLawDigestEntries(laws: HrLawRecord[]): LawDigestEntry[] {
  return laws.map((law) => ({
    lawRecordId: law.id,
    title: law.title,
    summary: law.summary,
    citation: law.citation,
    topic: law.topic,
    sourceUrl: law.sourceUrl,
    updatedAt: law.updatedAt,
  }));
}

export function buildLawDigestMeta(
  stateCode: string,
  stateName: string,
  laws: HrLawRecord[]
): LawDigestMeta {
  return {
    stateCode: stateCode.toUpperCase(),
    stateName,
    syncedAt: new Date().toISOString(),
    entries: toLawDigestEntries(laws),
  };
}

export function formatLawDigestContent(stateName: string, entries: LawDigestEntry[]): string {
  const lines = [
    `${stateName} employment-law summary`,
    '',
    'Please read the laws below and acknowledge that you have reviewed them. If laws are updated after you sign, you will only be asked to review the changes since your last acknowledgement.',
    '',
  ];
  for (const entry of entries) {
    lines.push(entry.title);
    lines.push(entry.topic.replace(/_/g, ' '));
    lines.push(entry.summary);
    lines.push(
      entry.sourceUrl ? `${entry.citation} · ${entry.sourceUrl}` : entry.citation
    );
    lines.push('');
  }
  return lines.join('\n').trim();
}

/** Laws the employee has not yet acknowledged (new or replaced record ids since last sign). */
export function pendingLawDigestEntries(
  policy: Policy,
  ack: PolicyAcknowledgement | undefined
): LawDigestEntry[] {
  const entries = policy.lawDigest?.entries ?? [];
  if (entries.length === 0) return [];
  const signedIds = new Set((ack?.acknowledgedLawDigest ?? []).map((e) => e.lawRecordId));
  return entries.filter((entry) => !signedIds.has(entry.lawRecordId));
}

/**
 * Whether this employee still owes an acknowledgement for the memo.
 * Law digests: pending when any current law record was not in their last signed snapshot.
 */
export function employeeNeedsPolicyAck(
  policy: Policy,
  ack: PolicyAcknowledgement | undefined
): boolean {
  if (policy.status !== 'PUBLISHED' || !policy.acknowledgmentRequired) return false;
  if (ack?.outcome === 'REQUEST_CLARIFICATION') return true;
  if (policy.lawDigest?.entries?.length) {
    return pendingLawDigestEntries(policy, ack).length > 0;
  }
  if (!ack) return true;
  if (ack.outcome === 'READ_UNDERSTOOD' && !ack.signatureDataUrl) return true;
  return false;
}

export function findLawDigestPolicy(
  policies: Policy[],
  stateCode: string
): Policy | undefined {
  const code = stateCode.toUpperCase();
  return policies.find(
    (p) =>
      p.status !== 'ARCHIVED' &&
      (p.lawDigest?.stateCode === code || (p.tags ?? []).includes(lawDigestStateTag(code)))
  );
}

export function countEmployeesNeedingLawDigestAck(
  policy: Policy,
  users: User[],
  acknowledgements: PolicyAcknowledgement[]
): number {
  if (!policy.acknowledgmentRequired || policy.status !== 'PUBLISHED') return 0;
  return users.filter((u) => {
    if (u.role !== 'EMPLOYEE' || u.status !== 'active') return false;
    const ack = acknowledgements.find((a) => a.policyId === policy.id && a.userId === u.id);
    return employeeNeedsPolicyAck(policy, ack);
  }).length;
}

export function employeeFacingLawDigestBody(
  policy: Policy,
  ack: PolicyAcknowledgement | undefined
): { heading: string; body: string; pendingCount: number; isDelta: boolean } {
  const pending = pendingLawDigestEntries(policy, ack);
  const all = policy.lawDigest?.entries ?? [];
  const stateName = policy.lawDigest?.stateName ?? 'State';
  if (pending.length === 0) {
    return {
      heading: policy.title,
      body: policy.content,
      pendingCount: 0,
      isDelta: false,
    };
  }
  const isDelta = Boolean(ack?.acknowledgedLawDigest?.length) && pending.length < all.length;
  if (isDelta) {
    return {
      heading: `Updates since your last acknowledgement (${pending.length})`,
      body: formatLawDigestContent(stateName, pending),
      pendingCount: pending.length,
      isDelta: true,
    };
  }
  return {
    heading: policy.title,
    body: formatLawDigestContent(stateName, pending.length ? pending : all),
    pendingCount: pending.length || all.length,
    isDelta: false,
  };
}
