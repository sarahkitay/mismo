/**
 * Contract checks for report/wage case identity + law-corpus publish gate.
 * Run: node scripts/qa-report-contract.mjs
 */
import assert from 'node:assert/strict';

function allocateCaseReferenceNumber(existingReports, orgId, caseType) {
  const year = new Date().getFullYear();
  const prefix = caseType === 'WAGE_HOUR' ? 'WH' : 'CAS';
  const sameOrg = existingReports.filter((r) => r.orgId === orgId);
  const re = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  let maxSeq = 0;
  for (const r of sameOrg) {
    const m = r.referenceNumber?.match(re);
    if (m) maxSeq = Math.max(maxSeq, Number.parseInt(m[1], 10));
  }
  return `${prefix}-${year}-${String(maxSeq + 1).padStart(4, '0')}`;
}

function formatCaseReference(report) {
  if (report.referenceNumber) return report.referenceNumber;
  const num = report.id.replace(/^report-/, '').toUpperCase();
  const prefix = report.caseType === 'WAGE_HOUR' ? 'WH' : 'CAS';
  return num.startsWith(`${prefix}-`) || num.startsWith('IR-')
    ? num.replace(/^IR-/, 'CAS-')
    : `${prefix}-${num}`;
}

function validateLawCorpusForPublish(laws) {
  const issues = [];
  for (const law of laws) {
    const hay = `${law.title} ${law.summary}`.toLowerCase();
    if (!hay.includes('paid sick') && !hay.includes('sick leave')) continue;
    if (/\b24\s*hours?\b/.test(hay) || /\bthree\s+days?\b/.test(hay) || /\b3\s+days?\b/.test(hay)) {
      issues.push(law.id);
    }
  }
  return issues;
}

const year = new Date().getFullYear();
const existing = [
  { orgId: 'org-1', referenceNumber: `WH-${year}-0001` },
  { orgId: 'org-1', referenceNumber: `WH-${year}-0003` },
];
const next = allocateCaseReferenceNumber(existing, 'org-1', 'WAGE_HOUR');
assert.equal(next, `WH-${year}-0004`, 'reference allocator must use max seq, not count');

const report = {
  id: 'report-1710000000000',
  referenceNumber: next,
  caseType: 'WAGE_HOUR',
};
assert.equal(formatCaseReference(report), next, 'employee confirmation must match stored reference');
assert.notEqual(formatCaseReference(report), report.id, 'must not surface raw report id when ref exists');

const stale = validateLawCorpusForPublish([
  {
    id: 'law-1',
    title: 'California Paid Sick Leave Law',
    summary: 'Employers must provide at least 24 hours or three days of paid sick leave.',
  },
]);
assert.equal(stale.length, 1, 'stale CA sick leave must block publish');

const fresh = validateLawCorpusForPublish([
  {
    id: 'law-2',
    title: 'California Paid Sick Leave Law',
    summary: 'Employers must provide at least 40 hours or five days of paid sick leave.',
  },
]);
assert.equal(fresh.length, 0, 'updated CA sick leave must allow publish');

console.log('qa-report-contract: ok');
