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
 const seq =
 sameOrg.filter((r) => r.referenceNumber?.startsWith(`${prefix}-${year}-`)).length + 1;
 return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
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
