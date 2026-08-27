import { useRef, useState, useEffect, useCallback } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { Investigation, InvestigationAttachment, Report, User } from '@/types';
import { InvestigationSubModule } from '@/components/admin/investigation/InvestigationModuleShell';
import { PreservedFilePreviewDialog } from '@/components/PreservedFilePreviewDialog';
import type { PreservedFilePreviewSource } from '@/lib/preservedFilePreview';
import { useInvestigationDraftRegistration } from '@/hooks/useInvestigationDraftRegistration';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/lib/icons';
import { toast } from 'sonner';
import { sendNotificationEmail } from '@/lib/api/notifications';
import {
  buildInitialContactReviewEmailBody,
  caseNoteAckStatusLabel,
} from '@/lib/caseNoteAcknowledgement';
import { formatRelativeTime } from '@/lib/utils';

function readContactFile(file: File): Promise<InvestigationAttachment | null> {
  return new Promise((resolve) => {
    if (file.size > 5_000_000) {
      toast.error('File must be under 5 MB.');
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: `initial-contact-file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataUrl: typeof reader.result === 'string' ? reader.result : '',
      });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

interface InitialContactWithEmployeeSectionProps {
  investigation: Investigation;
  dataStore: DataStore;
  primaryReport?: Report;
  reporter?: User | null;
}

export function InitialContactWithEmployeeSection({
  investigation,
  dataStore,
  primaryReport,
  reporter,
}: InitialContactWithEmployeeSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [draftNotes, setDraftNotes] = useState(investigation.initialContactNotes ?? '');
  const [isEditing, setIsEditing] = useState(!investigation.initialContactSavedAt);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [previewFile, setPreviewFile] = useState<PreservedFilePreviewSource | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const saved = Boolean(investigation.initialContactSavedAt);
  const showEditor = !saved || isEditing;
  const attachments = investigation.initialContactAttachments ?? [];

  const contactAcks = dataStore.caseNoteAcknowledgements.filter(
    (ack) => ack.investigationId === investigation.id && ack.kind === 'INITIAL_CONTACT'
  );
  const pendingAck = contactAcks.find((ack) => ack.status === 'PENDING');

  useEffect(() => {
    if (!isEditing) {
      setDraftNotes(investigation.initialContactNotes ?? '');
    }
    if (investigation.initialContactSavedAt && !isEditing) {
      setIsEditing(false);
    }
  }, [investigation.initialContactNotes, investigation.initialContactSavedAt, isEditing]);

  const syncDraftFromInvestigation = () => {
    setDraftNotes(investigation.initialContactNotes ?? '');
  };

  const openAttachmentPreview = (entry: InvestigationAttachment) => {
    if (!entry.dataUrl) return;
    setPreviewFile({ fileName: entry.fileName, mimeType: entry.mimeType, dataUrl: entry.dataUrl });
    setPreviewOpen(true);
  };

  useInvestigationDraftRegistration(
    investigation.id,
    'Initial contact notes',
    useCallback(
      () => isEditing && draftNotes.trim() !== (investigation.initialContactNotes ?? '').trim(),
      [draftNotes, investigation.initialContactNotes, isEditing]
    ),
    useCallback(() => {
      dataStore.setInvestigationInitialContactNotes(investigation.id, draftNotes);
    }, [dataStore, draftNotes, investigation.id])
  );

  const handleSave = () => {
    const text = draftNotes.trim();
    if (!text) {
      toast.error('Add initial contact notes before saving.');
      return;
    }
    setSaving(true);
    dataStore.setInvestigationInitialContactNotes(investigation.id, text);
    dataStore.saveInvestigationInitialContact(investigation.id);
    setIsEditing(false);
    setSaving(false);
    toast.success('Initial contact saved.');
  };

  const handleEdit = () => {
    syncDraftFromInvestigation();
    dataStore.unlockInvestigationInitialContact(investigation.id);
    setIsEditing(true);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const parsed = await readContactFile(file);
      if (parsed) dataStore.addInitialContactAttachment(investigation.id, parsed);
    }
    if (fileRef.current) fileRef.current.value = '';
    toast.success('Attachment added.');
  };

  const handleShare = async () => {
    const body = (investigation.initialContactNotes ?? '').trim();
    if (!body) {
      toast.error('Save initial contact notes before sharing.');
      return;
    }
    const recipientUserId = primaryReport?.createdByUserId;
    if (!recipientUserId || primaryReport?.isAnonymous) {
      toast.error('Link a named employee to this investigation before sharing.');
      return;
    }
    if (pendingAck) {
      toast.message('A sign-off request is already pending for this initial contact summary.');
      return;
    }

    setSharing(true);
    try {
      const ack = dataStore.createCaseNoteAcknowledgement({
        reportId: primaryReport.id,
        userId: recipientUserId,
        subject: 'Initial contact summary for your review',
        body,
        kind: 'INITIAL_CONTACT',
        investigationId: investigation.id,
        attachments: investigation.initialContactAttachments,
      });

      const result = await sendNotificationEmail({
        recipientUserId,
        subject: `${ack.subject} (review and sign off)`,
        body: buildInitialContactReviewEmailBody(body),
        kind: 'CASE_UPDATE',
        actionPage: `employee/case-note-review/${ack.id}`,
        templateId: 'new_message',
      });

      if (result?.ok && result.emailStatus === 'sent') {
        toast.success(`Shared with ${reporter?.email ?? 'employee'} via email.`);
      } else if (result?.ok && result.emailStatus?.startsWith('skipped')) {
        toast.message('Sign-off request created in Mismo.', {
          description: result.message || 'Email skipped in this environment.',
        });
      } else {
        toast.success('Sign-off request created. Email could not be delivered.');
      }
      void dataStore.refreshAppNotifications?.();
    } catch {
      toast.error('Could not share initial contact summary.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <InvestigationSubModule
      title="Initial contact with employee"
      description="Document first outreach, scheduling, and triage thoughts. Internal only until you send a shared note."
    >
      {showEditor ? (
        <div className="space-y-3">
          <Textarea
            rows={4}
            placeholder="Initial contact notes - call summary, meeting scheduled, interim safety steps…"
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
          />
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/heic,.png,.jpg,.jpeg,.webp,.gif,.heic,.pdf,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => void handleUpload(e.target.files)}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Icons.upload className="h-3.5 w-3.5 mr-1.5" />
              Upload screenshot / file
            </Button>
          </div>
          {attachments.length > 0 && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {attachments.map((entry) => {
                const isImage = entry.dataUrl.startsWith('data:image/') || /\.(png|jpe?g|gif|webp|heic)$/i.test(entry.fileName);
                return (
                  <li key={entry.id} className="border border-[var(--color-border-200)] bg-white p-2 text-sm space-y-1">
                    {isImage ? (
                      <button type="button" onClick={() => openAttachmentPreview(entry)} className="block w-full">
                        <img src={entry.dataUrl} alt={entry.fileName} className="max-h-32 w-full object-contain bg-[var(--color-surface-200)] cursor-pointer" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openAttachmentPreview(entry)}
                      className="font-medium truncate text-left text-[var(--mismo-blue)] hover:underline w-full"
                    >
                      {entry.fileName}
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <a href={entry.dataUrl} download={entry.fileName} className="text-xs text-[var(--mismo-blue)] underline">
                        Open / download
                      </a>
                      <button
                        type="button"
                        className="text-xs text-[var(--color-alert-600)] hover:underline"
                        onClick={() => dataStore.removeInitialContactAttachment(investigation.id, entry.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save initial contact'}
            </Button>
            {saved && isEditing && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  syncDraftFromInvestigation();
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-[var(--color-border-200)] bg-white p-3 text-sm whitespace-pre-wrap text-[var(--mismo-text)]">
            {investigation.initialContactNotes}
          </div>
          {attachments.length > 0 && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {attachments.map((entry) => (
                <li key={entry.id} className="border border-[var(--color-border-200)] bg-white p-2 text-sm">
                  <button
                    type="button"
                    onClick={() => openAttachmentPreview(entry)}
                    className="text-[var(--mismo-blue)] hover:underline text-left"
                  >
                    {entry.fileName}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {investigation.initialContactSavedAt && (
            <p className="text-xs text-[var(--color-text-muted)]">
              Saved {formatRelativeTime(investigation.initialContactSavedAt)}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleEdit}>
              <Icons.edit className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-[var(--mismo-blue)] hover:bg-blue-600"
              onClick={() => void handleShare()}
              disabled={sharing || !primaryReport?.createdByUserId || primaryReport.isAnonymous}
            >
              <Icons.mail className="h-3.5 w-3.5 mr-1.5" />
              {sharing ? 'Sharing…' : 'Share with employee for sign-off'}
            </Button>
          </div>
        </div>
      )}

      {contactAcks.length > 0 && (
        <div className="mt-4 border border-[var(--color-border-200)] rounded-md p-3 space-y-2 bg-[var(--color-surface-100)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Employee sign-off</p>
          <ul className="space-y-2">
            {contactAcks.map((ack) => (
              <li key={ack.id} className="text-sm border border-[var(--color-border-200)] rounded px-2 py-1.5 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{ack.subject}</span>
                  <Badge variant="outline" className="text-xs">
                    {caseNoteAckStatusLabel(ack.status)}
                  </Badge>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Sent {formatRelativeTime(ack.sentAt)}
                  {ack.respondedAt ? ` · Responded ${formatRelativeTime(ack.respondedAt)}` : ''}
                </p>
                {ack.status === 'REVISION_REQUESTED' && ack.revisionNote && (
                  <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1 whitespace-pre-wrap">
                    {ack.revisionNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <PreservedFilePreviewDialog file={previewFile} open={previewOpen} onOpenChange={setPreviewOpen} />
    </InvestigationSubModule>
  );
}
