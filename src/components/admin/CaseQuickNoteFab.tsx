import { useMemo, useRef, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { InvestigationEvidenceType, ReportHandlingEntry } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Icons } from '@/lib/icons';
import { formatCaseReference } from '@/lib/caseTypes';
import { getInvestigationDisplayId } from '@/lib/investigationWorkflow';
import { formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';

type QuickNoteMode = 'add' | 'history';

type TimelineItem = {
  id: string;
  at: Date;
  kind: string;
  title: string;
  body: string;
  fileName?: string;
  fileUrl?: string;
  source: 'case' | 'investigation' | 'outreach';
};

interface CaseQuickNoteFabProps {
  dataStore: DataStore;
  /** Open case page — notes attach to this report. */
  reportId?: string;
  /** Open investigation page — notes attach to this investigation. */
  investigationId?: string;
}

function evidenceTypeForFile(file: File): InvestigationEvidenceType {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic)$/.test(name)) return 'SCREENSHOT';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'PDF';
  if (mime.startsWith('audio/')) return 'AUDIO';
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime.startsWith('message/') || name.includes('email')) return 'EMAIL';
  return 'DOCUMENT';
}

function ledgerKindLabel(entry: ReportHandlingEntry): string {
  switch (entry.type) {
    case 'FILE':
      return 'File';
    case 'PLAN':
      return 'Plan';
    case 'ACTION_TAKEN':
      return 'Action';
    case 'EMPLOYEE_RESPONSE':
      return 'Employee response';
    default:
      return 'Note';
  }
}

export function CaseQuickNoteFab({ dataStore, reportId, investigationId }: CaseQuickNoteFabProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<QuickNoteMode>('add');
  const [note, setNote] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const investigation = investigationId
    ? dataStore.investigations.find((i) => i.id === investigationId)
    : undefined;
  const report =
    (reportId ? dataStore.reports.find((r) => r.id === reportId) : undefined) ??
    (investigation
      ? dataStore.reports.find(
          (r) =>
            r.investigationId === investigation.id ||
            investigation.linkedReportIds.includes(r.id)
        )
      : undefined);

  const targetLabel = investigation
    ? `Investigation ${getInvestigationDisplayId(investigation)}`
    : report
      ? `Case ${formatCaseReference(report)}`
      : 'Record';

  const linkedReportIds = useMemo(() => {
    const ids = new Set<string>();
    if (reportId) ids.add(reportId);
    if (report?.id) ids.add(report.id);
    investigation?.linkedReportIds?.forEach((id) => ids.add(id));
    return [...ids];
  }, [investigation?.linkedReportIds, report?.id, reportId]);

  const timeline = useMemo(() => {
    const items: TimelineItem[] = [];

    for (const rid of linkedReportIds) {
      const r = dataStore.reports.find((rep) => rep.id === rid);
      if (!r) continue;
      for (const entry of r.handlingLedger ?? []) {
        items.push({
          id: `ledger-${entry.id}`,
          at: entry.createdAt,
          kind: ledgerKindLabel(entry),
          title: ledgerKindLabel(entry),
          body: entry.text,
          fileName: entry.fileFileName,
          fileUrl: entry.fileDataUrl,
          source: 'case',
        });
      }
      for (const msg of r.messages ?? []) {
        items.push({
          id: `msg-${msg.id}`,
          at: msg.createdAt,
          kind: 'Message',
          title: 'Case message',
          body: msg.body,
          source: 'case',
        });
      }
    }

    for (const n of dataStore.nudges) {
      if (n.context.reportId && linkedReportIds.includes(n.context.reportId)) {
        items.push({
          id: `nudge-${n.id}`,
          at: n.sentAt ?? n.createdAt,
          kind: 'Outreach',
          title: `${n.channel} outreach`,
          body: n.message,
          source: 'outreach',
        });
      }
    }

    if (investigation) {
      for (const invNote of investigation.notes ?? []) {
        items.push({
          id: `inv-note-${invNote.id}`,
          at: invNote.createdAt,
          kind: invNote.visibility === 'EMPLOYEE' ? 'Shared note' : 'Internal note',
          title: invNote.noteType ? invNote.noteType.replace(/_/g, ' ') : 'Investigation note',
          body: invNote.body,
          fileName: invNote.attachments?.[0]?.fileName,
          fileUrl: invNote.attachments?.[0]?.dataUrl,
          source: 'investigation',
        });
      }
      for (const ev of investigation.evidenceRecords ?? []) {
        items.push({
          id: `ev-${ev.id}`,
          at: ev.uploadedAt,
          kind: 'Evidence',
          title: ev.description || 'Uploaded file',
          body: ev.fileName,
          fileName: ev.fileName,
          fileUrl: ev.dataUrl,
          source: 'investigation',
        });
      }
      if (investigation.initialContactNotes?.trim()) {
        items.push({
          id: `initial-contact-${investigation.id}`,
          at: investigation.openedAt ?? investigation.createdAt,
          kind: 'Initial contact',
          title: 'Initial contact notes',
          body: investigation.initialContactNotes,
          source: 'investigation',
        });
      }
    }

    return items.sort((a, b) => b.at.getTime() - a.at.getTime());
  }, [dataStore.nudges, dataStore.reports, investigation, linkedReportIds]);

  if (!reportId && !investigationId) return null;
  if (!report && !investigation) return null;

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleSave = async () => {
    const body = note.trim();
    if (!body && pendingFiles.length === 0) {
      toast.error('Add a note or attach a file.');
      return;
    }

    setSaving(true);
    try {
      if (investigationId && investigation) {
        const attachments =
          pendingFiles.length > 0
            ? await Promise.all(
                pendingFiles.map(async (file) => ({
                  id: `att-${Date.now()}-${file.name}`,
                  fileName: file.name,
                  mimeType: file.type || 'application/octet-stream',
                  dataUrl: await readFileAsDataUrl(file),
                }))
              )
            : undefined;

        if (body || attachments?.length) {
          dataStore.addInvestigationNote(investigationId, {
            visibility: 'INTERNAL',
            body: body || (attachments?.length === 1 ? `Attached ${attachments[0].fileName}` : `Attached ${attachments?.length ?? 0} files`),
            attachments,
            noteType: 'PRIVATE_HR',
          });
        }

        for (const file of pendingFiles) {
          const dataUrl = await readFileAsDataUrl(file);
          dataStore.addInvestigationEvidence(investigationId, {
            type: evidenceTypeForFile(file),
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            dataUrl,
            sourceType: 'UPLOAD',
            description: body || undefined,
          });
        }

        toast.success('Saved to investigation.');
      } else if (reportId || report?.id) {
        const targetReportId = reportId ?? report!.id;
        if (body) {
          dataStore.addReportHandlingEntry(targetReportId, 'NOTE', body);
        }
        for (const file of pendingFiles) {
          dataStore.addReportLedgerFile(targetReportId, file);
        }
        toast.success('Saved to case.');
      }

      setNote('');
      setPendingFiles([]);
      setMode('history');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save note.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMode('add');
          setOpen(true);
        }}
        className="fixed bottom-5 right-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-900)] text-white shadow-lg hover:bg-[var(--color-primary-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-900)] focus-visible:ring-offset-2"
        aria-label={`Add note to ${targetLabel}`}
        title="Add note"
      >
        <Icons.edit className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col gap-0 p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-[var(--color-border-200)]">
            <DialogTitle>Quick note</DialogTitle>
            <DialogDescription>
              Saving to <span className="font-medium text-[var(--color-text-primary)]">{targetLabel}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-1 px-5 pt-3">
            <Button
              type="button"
              size="sm"
              variant={mode === 'add' ? 'default' : 'outline'}
              className={mode === 'add' ? 'bg-[var(--color-primary-900)] text-white' : undefined}
              onClick={() => setMode('add')}
            >
              Add note / files
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'history' ? 'default' : 'outline'}
              className={mode === 'history' ? 'bg-[var(--color-primary-900)] text-white' : undefined}
              onClick={() => setMode('history')}
            >
              Past notes ({timeline.length})
            </Button>
          </div>

          {mode === 'add' ? (
            <div className="px-5 py-4 space-y-3 overflow-y-auto">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Write an internal note…"
                rows={5}
                className="resize-y min-h-[120px]"
              />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length) setPendingFiles((prev) => [...prev, ...files]);
                      e.target.value = '';
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Icons.upload className="h-4 w-4 mr-2" />
                    Add files or docs
                  </Button>
                </div>
                {pendingFiles.length > 0 && (
                  <ul className="space-y-1 text-sm text-[var(--color-text-secondary)]">
                    {pendingFiles.map((file, idx) => (
                      <li key={`${file.name}-${idx}`} className="flex items-center justify-between gap-2 border border-[var(--color-border-200)] px-2 py-1.5 rounded-md">
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          className="text-xs text-[var(--color-alert-600)] hover:underline shrink-0"
                          onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-[var(--color-primary-900)] text-white"
                  disabled={saving}
                  onClick={() => void handleSave()}
                >
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-5 py-4 overflow-y-auto max-h-[55vh] space-y-2">
              {timeline.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)] py-6 text-center">
                  No notes or documented communication yet.
                </p>
              ) : (
                timeline.map((item) => (
                  <div key={item.id} className="border border-[var(--color-border-200)] rounded-md p-3 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        {item.kind}
                        <span className="font-normal normal-case tracking-normal text-[var(--color-text-secondary)]">
                          {' '}
                          · {item.source}
                        </span>
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">{formatRelativeTime(item.at)}</span>
                    </div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{item.title}</p>
                    <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{item.body}</p>
                    {item.fileUrl && item.fileName && (
                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex text-xs text-[var(--mismo-blue)] hover:underline"
                      >
                        {item.fileName}
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
