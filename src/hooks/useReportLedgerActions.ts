import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type {
  AppNotification,
  Report,
  ReportHandlingEntry,
  ReportHandlingEntryType,
  User,
} from '@/types';
import { sendNotificationEmail } from '@/lib/api/notifications';

export type ReportLedgerDeps = {
  reports: Report[];
  currentUser: User;
  effectiveOrgId: string;
  orgSettings: { enableEmail?: boolean };
  setReports: Dispatch<SetStateAction<Report[]>>;
  setAppNotifications: Dispatch<SetStateAction<AppNotification[]>>;
};

export function useReportLedgerActions(deps: ReportLedgerDeps) {
  const { reports, currentUser, effectiveOrgId, orgSettings, setReports, setAppNotifications } = deps;

 const addReportMessage = useCallback((reportId: string, body: string, options?: { sendEmail?: boolean }) => {
 const now = new Date();
 setReports((prev) =>
 prev.map((report) =>
 report.id === reportId
 ? {
 ...report,
 messages: [...(report.messages ?? []), { id: `msg-${Date.now()}`, authorUserId: currentUser.id, body, createdAt: now }],
 updatedAt: now,
 }
 : report
 )
 );
 if (options?.sendEmail === false) return;
 const report = reports.find((r) => r.id === reportId);
 if (report && body.trim() && orgSettings.enableEmail !== false) {
   const reporterId = report.createdByUserId;
   const assigneeId = report.assignedTo;
   const preferredRecipient =
     currentUser.id === reporterId ? assigneeId : reporterId;
   const toUserId =
     preferredRecipient && preferredRecipient !== currentUser.id
       ? preferredRecipient
       : assigneeId && assigneeId !== currentUser.id
         ? assigneeId
         : reporterId && reporterId !== currentUser.id
           ? reporterId
           : null;
   if (toUserId) {
     void sendNotificationEmail({
       recipientUserId: toUserId,
       subject: 'Case update on Mismo',
       body: body.trim(),
       kind: 'CASE_UPDATE',
       actionPage: 'report-detail',
       actionParams: { id: reportId },
       templateId: 'new_message',
     }).then((result) => {
       if (!result) return;
       setAppNotifications((prev) => [
         {
           id: result.notificationId ?? `notif-case-${Date.now()}`,
           orgId: effectiveOrgId,
           userId: toUserId,
           kind: 'CASE_UPDATE',
           title: 'Case update on Mismo',
           body: body.trim().slice(0, 500),
           actionPage: 'report-detail',
           actionParams: { id: reportId },
           emailStatus: result.emailStatus,
           actorUserId: currentUser.id,
           createdAt: new Date(),
         },
         {
           id: `notif-case-sent-${Date.now()}`,
           orgId: effectiveOrgId,
           userId: currentUser.id,
           kind: 'SYSTEM',
           title: 'Case message sent',
           body: `Update emailed (${result.emailStatus ?? 'unknown'}).`,
           actionPage: 'report-detail',
           actionParams: { id: reportId },
           emailStatus: result.emailStatus,
           actorUserId: currentUser.id,
           createdAt: new Date(),
         },
         ...prev,
       ]);
     });
   }
 }
 }, [currentUser.id, reports, orgSettings.enableEmail, effectiveOrgId]);

 const addReportHandlingEntry = useCallback((reportId: string, type: ReportHandlingEntryType, text: string) => {
 if (!text.trim()) return;
 const now = new Date();
 const entry: ReportHandlingEntry = {
 id: `ledger-${Date.now()}`,
 type,
 text: text.trim(),
 createdAt: now,
 createdBy: currentUser.id,
 };
 setReports((prev) =>
 prev.map((report) =>
 report.id === reportId
 ? {
 ...report,
 handlingLedger: [...(report.handlingLedger ?? []), entry],
 updatedAt: now,
 }
 : report
 )
 );
 }, [currentUser.id]);

 const addReportLedgerFile = useCallback((reportId: string, file: File) => {
 const now = new Date();
 const reader = new FileReader();
 reader.onload = () => {
 const dataUrl = reader.result as string;
 const entry: ReportHandlingEntry = {
 id: `ledger-${Date.now()}`,
 type: 'FILE',
 text: file.name,
 createdAt: now,
 createdBy: currentUser.id,
 fileFileName: file.name,
 fileSize: file.size,
 fileDataUrl: dataUrl,
 };
 setReports((prev) =>
 prev.map((report) =>
 report.id === reportId
 ? {
 ...report,
 handlingLedger: [...(report.handlingLedger ?? []), entry],
 updatedAt: now,
 }
 : report
 )
 );
 };
 reader.readAsDataURL(file);
 }, [currentUser.id]);

 const removeReportLedgerEntry = useCallback((reportId: string, entryId: string) => {
 const now = new Date();
 setReports((prev) =>
 prev.map((report) =>
 report.id === reportId
 ? {
 ...report,
 handlingLedger: (report.handlingLedger ?? []).filter((entry) => entry.id !== entryId),
 updatedAt: now,
 }
 : report
 )
 );
 }, []);

 const updateReportHandling = useCallback(
 (
 reportId: string,
 updates: Pick<
 Report,
 'responsePlan' | 'responseActionTaken' | 'employeeResponseOutcome' | 'ginaBuildNotes' | 'evidenceMetadata'
 >
 ) => {
 const now = new Date();
 setReports((prev) =>
 prev.map((report) =>
 report.id === reportId
 ? {
 ...report,
 ...updates,
 updatedAt: now,
 }
 : report
 )
 );
 },
 []
 );

 const toggleReportChecklistItem = useCallback((reportId: string, itemId: string, completed: boolean) => {
 const now = new Date();
 setReports((prev) =>
 prev.map((report) =>
 report.id === reportId
 ? {
 ...report,
 responseChecklist: (report.responseChecklist ?? []).map((item) =>
 item.id === itemId
 ? {
 ...item,
 completed,
 completedAt: completed ? now : undefined,
 completedBy: completed ? currentUser.id : undefined,
 }
 : item
 ),
 updatedAt: now,
 }
 : report
 )
 );
 }, [currentUser.id]);

 const updateReportChecklistItemEvidence = useCallback(
 (
 reportId: string,
 itemId: string,
 updates: {
 completed?: boolean;
 evidenceNote?: string;
 evidenceFileFileName?: string;
 evidenceFileDataUrl?: string;
 }
 ) => {
 const now = new Date();
 setReports((prev) =>
 prev.map((report) =>
 report.id === reportId
 ? {
 ...report,
 responseChecklist: (report.responseChecklist ?? []).map((item) =>
 item.id === itemId
 ? {
 ...item,
 ...(updates.completed !== undefined && {
 completed: updates.completed,
 completedAt: updates.completed ? now : undefined,
 completedBy: updates.completed ? currentUser.id : undefined,
 }),
 ...(updates.evidenceNote !== undefined && { evidenceNote: updates.evidenceNote }),
 ...(updates.evidenceFileFileName !== undefined && {
 evidenceFileFileName: updates.evidenceFileFileName,
 evidenceFileDataUrl: updates.evidenceFileDataUrl,
 }),
 }
 : item
 ),
 updatedAt: now,
 }
 : report
 )
 );
 },
 [currentUser.id]
 );


  return {
    addReportMessage,
    addReportHandlingEntry,
    addReportLedgerFile,
    removeReportLedgerEntry,
    updateReportHandling,
    toggleReportChecklistItem,
    updateReportChecklistItemEvidence,
  };
}
