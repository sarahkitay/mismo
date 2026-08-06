import type { CaseType, Report } from '@/types';

/** Unified case file ID - same on report, employee EI form, and investigation */
export function allocateCaseReferenceNumber(
 existingReports: Pick<Report, 'referenceNumber' | 'orgId'>[],
 orgId: string,
 caseType?: CaseType
): string {
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

export function getUnifiedCaseId(entity: {
 referenceNumber?: string;
 id: string;
 caseType?: CaseType;
}): string {
 if (entity.referenceNumber) return entity.referenceNumber;
 const num = entity.id.replace(/^(report|inv)-/, '').toUpperCase();
 const prefix = entity.caseType === 'WAGE_HOUR' ? 'WH' : 'CAS';
 return num.startsWith(`${prefix}-`) || num.startsWith('IR-') || num.startsWith('INV-')
 ? num.replace(/^INV-/, 'CAS-').replace(/^IR-/, 'CAS-')
 : `${prefix}-${num}`;
}

export function formatReportCaseId(report: Pick<Report, 'id' | 'referenceNumber' | 'caseType'>): string {
 return getUnifiedCaseId(report);
}
