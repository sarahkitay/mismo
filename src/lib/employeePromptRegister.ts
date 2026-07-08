import type { Prompt, PromptDelivery, PromptResponse, Report, User } from '@/types';
import { inDateRange, type DateRangeState } from '@/lib/dateFilters';
import { formatCaseReference } from '@/lib/caseTypes';
import { linkedReportForPromptRow } from '@/lib/recordLinks';

export type EmployeePromptRegisterRow = {
  id: string;
  deliveryId: string;
  userId: string;
  promptTitle: string;
  promptType: string;
  userName: string;
  answer: 'HAS_ISSUE' | 'NO_ISSUE' | 'UNANSWERED';
  date: Date;
  modified: Date;
  needsReview: boolean;
};

export function buildEmployeePromptRegisterRows(
  employeeId: string,
  users: User[],
  deliveries: PromptDelivery[],
  responses: PromptResponse[],
  prompts: Prompt[],
  options?: {
    channelPromptIds?: Set<string>;
    range?: DateRangeState;
    answerFilter?: 'HAS_ISSUE' | 'NO_ISSUE' | 'UNANSWERED' | null;
    needsReviewOnly?: boolean;
  }
): EmployeePromptRegisterRow[] {
  const employee = users.find((u) => u.id === employeeId);
  const userName = employee ? `${employee.firstName} ${employee.lastName}` : 'Employee';
  const channelIds = options?.channelPromptIds;
  const range = options?.range;
  const answerFilter = options?.answerFilter ?? null;
  const needsReviewOnly = options?.needsReviewOnly ?? false;

  const rows: EmployeePromptRegisterRow[] = [];

  if (answerFilter === null || answerFilter === 'UNANSWERED') {
    for (const d of deliveries) {
      if (d.userId !== employeeId || d.status !== 'PENDING') continue;
      if (channelIds && !channelIds.has(d.promptId)) continue;
      if (range && !inDateRange(d.deliveredAt, range)) continue;
      const prompt = prompts.find((p) => p.id === d.promptId);
      rows.push({
        id: d.id,
        deliveryId: d.id,
        userId: employeeId,
        promptTitle: prompt?.title ?? 'Prompt',
        promptType: prompt?.type ?? 'GENERAL',
        userName,
        answer: 'UNANSWERED',
        date: d.deliveredAt,
        modified: d.updatedAt ?? d.deliveredAt,
        needsReview: false,
      });
    }
  }

  if (answerFilter === null || answerFilter === 'HAS_ISSUE' || answerFilter === 'NO_ISSUE') {
    for (const r of responses) {
      if (r.userId !== employeeId) continue;
      if (channelIds && !channelIds.has(r.promptId)) continue;
      if (range && !inDateRange(r.submittedAt, range)) continue;
      if (answerFilter && r.answer !== answerFilter) continue;
      if (needsReviewOnly && (r.answer !== 'HAS_ISSUE' || r.reviewedAt || r.needsReview === false)) continue;
      const prompt = prompts.find((p) => p.id === r.promptId);
      rows.push({
        id: r.id,
        deliveryId: r.promptDeliveryId,
        userId: employeeId,
        promptTitle: prompt?.title ?? 'Prompt',
        promptType: prompt?.type ?? 'GENERAL',
        userName,
        answer: r.answer,
        date: r.submittedAt,
        modified: r.updatedAt ?? r.submittedAt,
        needsReview: r.answer === 'HAS_ISSUE' && !r.reviewedAt && r.needsReview !== false,
      });
    }
  }

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function exportEmployeePromptRegisterCsv(
  rows: EmployeePromptRegisterRow[],
  reports: Report[],
  employeeLabel: string,
  filenameSuffix: string
): { headers: string[]; rows: string[][]; filename: string } {
  const headers = [
    'Employee',
    'Prompt',
    'Category',
    'Answer',
    'Status',
    'Submitted',
    'Last modified',
    'Linked case',
  ];
  const csvRows = rows.map((row) => {
    const linkedCase = linkedReportForPromptRow(row, reports);
    return [
      employeeLabel,
      row.promptTitle,
      row.promptType,
      row.answer === 'HAS_ISSUE' ? 'Yes' : row.answer === 'NO_ISSUE' ? 'No' : 'Unanswered',
      row.answer === 'UNANSWERED' ? 'Pending' : row.needsReview ? 'Needs review' : 'Reviewed',
      row.date.toISOString(),
      row.modified.toISOString(),
      linkedCase ? formatCaseReference(linkedCase) : '',
    ];
  });
  return {
    headers,
    rows: csvRows,
    filename: `mismo-employee-checkins-${filenameSuffix}-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}
