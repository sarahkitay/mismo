import { useMemo, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { InvestigationAttachment, InvestigationEmployeeContactPreference } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Icons } from '@/lib/icons';
import {
  formatDate,
  formatRelativeTime,
  getCategoryColor,
  getCategoryLabel,
  getSeverityColor,
  getStatusColor,
  getEffectiveInvestigationPhase,
  investigationWorkflowLabel,
  isIncidentIntakeComplete,
} from '@/lib/utils';
import { toast } from 'sonner';

interface AdminInvestigationDetailProps {
  dataStore: DataStore;
  investigationId: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

function readFileAsAttachment(file: File): Promise<InvestigationAttachment | null> {
  return new Promise((resolve) => {
    if (!/^image\/(jpeg|png)|application\/pdf$/i.test(file.type)) {
      toast.error('Use PDF or JPEG/PNG only.');
      resolve(null);
      return;
    }
    if (file.size > 2_500_000) {
      toast.error('File must be under 2.5 MB for this demo.');
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      resolve({
        id: `att-${Date.now()}`,
        fileName: file.name,
        mimeType: file.type,
        dataUrl,
      });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export function AdminInvestigationDetail({ dataStore, investigationId, onNavigate }: AdminInvestigationDetailProps) {
  const investigation = dataStore.investigations.find((i) => i.id === investigationId);
  const {
    users,
    reports,
    pickUpInvestigation,
    setInvestigationSubjectUsers,
    addInvestigationNote,
    sendInvestigationOutcomeToEmployee,
    closeInvestigation,
  } = dataStore;

  const [pickupContact, setPickupContact] = useState<InvestigationEmployeeContactPreference>('IN_APP_MESSAGE');
  const [internalNoteBody, setInternalNoteBody] = useState('');
  const [sharedNoteBody, setSharedNoteBody] = useState('');
  const [sharedAttachments, setSharedAttachments] = useState<InvestigationAttachment[]>([]);
  const [sharedRequiresSig, setSharedRequiresSig] = useState(false);
  const [outcomeSummary, setOutcomeSummary] = useState('');
  const [outcomeRequiresSig, setOutcomeRequiresSig] = useState(true);
  const [outcomeFile, setOutcomeFile] = useState<InvestigationAttachment | null>(null);

  const linkedReports = useMemo(
    () => reports.filter((r) => investigation?.linkedReportIds.includes(r.id)),
    [reports, investigation?.linkedReportIds]
  );

  const employees = useMemo(
    () => users.filter((u) => u.orgId === investigation?.orgId && u.role === 'EMPLOYEE' && u.status === 'active'),
    [users, investigation?.orgId]
  );

  if (!investigation) {
    return <div className="text-sm text-[var(--mismo-text-secondary)]">Investigation not found.</div>;
  }

  const phase = getEffectiveInvestigationPhase(investigation);
  const primaryReport = linkedReports[0];
  const reporter = primaryReport?.createdByUserId ? users.find((u) => u.id === primaryReport.createdByUserId) : null;
  const owner = users.find((u) => u.id === investigation.ownerId);
  const investigationAgeDays = Math.max(0, Math.floor((Date.now() - investigation.openedAt.getTime()) / (1000 * 60 * 60 * 24)));

  const subjectIds = investigation.subjectUserIds ?? [];
  const toggleSubject = (userId: string) => {
    const next = subjectIds.includes(userId) ? subjectIds.filter((id) => id !== userId) : [...subjectIds, userId];
    setInvestigationSubjectUsers(investigation.id, next);
  };

  const handlePickup = () => {
    pickUpInvestigation(investigation.id, pickupContact);
    toast.success('Investigation marked in progress. Preferred contact saved.');
  };

  const handleAddInternalNote = () => {
    if (!internalNoteBody.trim()) {
      toast.error('Enter a note.');
      return;
    }
    addInvestigationNote(investigation.id, { visibility: 'INTERNAL', body: internalNoteBody.trim() });
    setInternalNoteBody('');
    toast.success('Internal note added.');
  };

  const handleAddSharedNote = async () => {
    if (!sharedNoteBody.trim()) {
      toast.error('Enter text to share with the employee.');
      return;
    }
    addInvestigationNote(investigation.id, {
      visibility: 'EMPLOYEE',
      body: sharedNoteBody.trim(),
      attachments: sharedAttachments.length ? sharedAttachments : undefined,
      requiresEmployeeSignature: sharedRequiresSig,
    });
    setSharedNoteBody('');
    setSharedAttachments([]);
    setSharedRequiresSig(false);
    toast.success('Shared note posted to the case file.');
  };

  const handleSendOutcome = () => {
    if (!outcomeSummary.trim()) {
      toast.error('Enter the outcome summary for the employee.');
      return;
    }
    sendInvestigationOutcomeToEmployee(investigation.id, {
      summary: outcomeSummary.trim(),
      requiresSignature: outcomeRequiresSig,
      attachment: outcomeFile ?? undefined,
    });
    setOutcomeSummary('');
    setOutcomeFile(null);
    toast.success('Outcome sent. Employee will see it on their report and can confirm.');
  };

  const handleClose = () => {
    if (investigation.status === 'CLOSED') return;
    if (
      phase === 'AWAITING_OUTCOME_ACK' &&
      investigation.outcomeEmployeeSignedAt == null &&
      !window.confirm(
        'The employee has not yet confirmed the outcome. Close anyway? (Use only for documented exceptions.)'
      )
    ) {
      return;
    }
    closeInvestigation(investigation.id);
    toast.success('Investigation closed.');
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" className="enterprise-interactive w-fit" onClick={() => onNavigate('investigations')}>
        <Icons.arrowLeft className="h-4 w-4 mr-2" />
        Back to Investigations
      </Button>

      <Card className="mismo-card border border-[var(--color-border-200)]">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Investigation Record</p>
              <h1 className="mismo-heading text-3xl text-[var(--color-primary-900)] mt-1">
                Investigation {investigation.id.toUpperCase()}
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Queued cases move to in progress when an investigator picks them up. Outcomes and shared notes appear in
                the employee&apos;s portal.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Badge className={investigation.status === 'CLOSED' ? 'status-chip status-chip--success' : 'status-chip status-chip--warn'}>
                {investigation.status}
              </Badge>
              <Badge variant="outline" className="border-[var(--color-border-200)]">
                {investigationWorkflowLabel(phase)}
              </Badge>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="border border-[var(--color-border-200)] bg-[var(--color-surface-200)] p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Owner</p>
              <p className="text-sm font-medium text-[var(--color-text-primary)] mt-1">
                {owner ? `${owner.firstName} ${owner.lastName}` : 'Unassigned'}
              </p>
            </div>
            <div className="border border-[var(--color-border-200)] bg-[var(--color-surface-200)] p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Opened</p>
              <p className="text-sm font-medium text-[var(--color-text-primary)] mt-1">{formatDate(investigation.openedAt)}</p>
            </div>
            <div className="border border-[var(--color-border-200)] bg-[var(--color-surface-200)] p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Age</p>
              <p className="text-sm font-medium text-[var(--color-text-primary)] mt-1">{investigationAgeDays} days</p>
            </div>
            <div className="border border-[var(--color-border-200)] bg-[var(--color-surface-200)] p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Preferred contact</p>
              <p className="text-sm font-medium text-[var(--color-text-primary)] mt-1">
                {investigation.employeePreferredContact === 'PHONE_CALL'
                  ? 'Phone call'
                  : investigation.employeePreferredContact === 'IN_APP_MESSAGE'
                    ? 'Mismo messaging'
                    : '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {primaryReport && (
        <Card className="mismo-card border border-[var(--color-border-200)]">
          <CardContent className="p-6 space-y-3">
            <h2 className="mismo-heading text-xl text-[var(--color-primary-900)]">Incident &amp; intake</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs uppercase text-[var(--color-text-secondary)]">Date reported</p>
                <p className="font-medium text-[var(--color-text-primary)]">{formatDate(primaryReport.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-[var(--color-text-secondary)]">Employee</p>
                <p className="font-medium text-[var(--color-text-primary)]">
                  {reporter ? `${reporter.firstName} ${reporter.lastName}` : primaryReport.isAnonymous ? 'Anonymous' : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-[var(--color-text-secondary)]">Incident form</p>
                <p className="font-medium">
                  {isIncidentIntakeComplete(primaryReport) ? (
                    <span className="text-emerald-700">Complete</span>
                  ) : (
                    <span className="text-amber-700">Pending: link sent with receipt email (simulated)</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-[var(--color-text-secondary)]">Case</p>
                <Button variant="link" className="h-auto p-0" onClick={() => onNavigate('report-detail', { id: primaryReport.id })}>
                  Open report #{primaryReport.id.replace('report-', '').toUpperCase()}
                </Button>
              </div>
            </div>
            {!isIncidentIntakeComplete(primaryReport) && reporter && (
              <p className="text-xs text-[var(--color-text-secondary)]">
                Employee portal path (for email link):{' '}
                <code className="bg-[var(--color-surface-200)] px-1 rounded">
                  /employee/my-reports/{primaryReport.id}/intake
                </code>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {phase === 'QUEUED' && investigation.status === 'OPEN' && (
        <Card className="mismo-card border-2 border-[var(--color-primary-700)]/30">
          <CardContent className="p-6 space-y-4">
            <h2 className="mismo-heading text-xl text-[var(--color-primary-900)]">Pick up this investigation</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Record how the employee prefers to communicate. You can walk through their incident form on the phone or
              via direct message while it&apos;s open in another tab.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="space-y-2 flex-1">
                <Label>Employee contact preference</Label>
                <Select value={pickupContact} onValueChange={(v) => setPickupContact(v as InvestigationEmployeeContactPreference)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN_APP_MESSAGE">Mismo messaging (in-app)</SelectItem>
                    <SelectItem value="PHONE_CALL">Phone call</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="enterprise-interactive bg-[var(--color-primary-900)]" onClick={handlePickup}>
                Start investigation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mismo-card border border-[var(--color-border-200)]">
        <CardContent className="p-6 space-y-4">
          <h2 className="mismo-heading text-xl text-[var(--color-primary-900)]">Persons named in this case</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Select anyone referenced so admins can open their profile in one click.
          </p>
          <div className="flex flex-wrap gap-2">
            {employees.map((emp) => {
              const on = subjectIds.includes(emp.id);
              return (
                <Button
                  key={emp.id}
                  type="button"
                  size="sm"
                  variant={on ? 'default' : 'outline'}
                  className={on ? 'bg-[var(--mismo-blue)]' : ''}
                  onClick={() => toggleSubject(emp.id)}
                >
                  {emp.firstName} {emp.lastName}
                </Button>
              );
            })}
          </div>
          {subjectIds.length > 0 && (
            <ul className="text-sm space-y-1 border-t border-[var(--color-border-200)] pt-3">
              {subjectIds.map((id) => {
                const u = users.find((x) => x.id === id);
                if (!u) return null;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className="text-[var(--mismo-blue)] hover:underline font-medium"
                      onClick={() => onNavigate('employee-detail', { id })}
                    >
                      {u.firstName} {u.lastName}
                    </button>
                    <span className="text-[var(--color-text-secondary)]"> ({u.email})</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="mismo-card border border-[var(--color-border-200)]">
          <CardContent className="p-6 space-y-4">
            <h2 className="mismo-heading text-lg text-[var(--color-primary-900)]">Internal notes</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Not visible to the employee. Line breaks are preserved.</p>
            <Textarea value={internalNoteBody} onChange={(e) => setInternalNoteBody(e.target.value)} rows={4} placeholder="Investigator notes…" />
            <Button variant="secondary" onClick={handleAddInternalNote}>
              Add internal note
            </Button>
            <ul className="space-y-3 max-h-64 overflow-y-auto border-t border-[var(--color-border-200)] pt-3">
              {(investigation.notes ?? [])
                .filter((n) => n.visibility === 'INTERNAL')
                .map((n) => {
                  const author = users.find((u) => u.id === n.createdByUserId);
                  return (
                    <li key={n.id} className="text-sm border border-[var(--color-border-200)] rounded-md p-3 bg-[var(--color-surface-200)]">
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {author?.firstName} {author?.lastName} · {formatRelativeTime(n.createdAt)}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-[var(--color-text-primary)]">{n.body}</p>
                    </li>
                  );
                })}
            </ul>
          </CardContent>
        </Card>

        <Card className="mismo-card border border-[var(--color-border-200)]">
          <CardContent className="p-6 space-y-4">
            <h2 className="mismo-heading text-lg text-[var(--color-primary-900)]">Notes shared with employee</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Attach PDF or JPEG. Optional: require a signature confirming the information is correct.
            </p>
            <Textarea value={sharedNoteBody} onChange={(e) => setSharedNoteBody(e.target.value)} rows={4} placeholder="Message the employee will see…" />
            <div className="space-y-2">
              <Label htmlFor="shared-files">Attachments</Label>
              <Input
                id="shared-files"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                multiple
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []);
                  const next: InvestigationAttachment[] = [];
                  for (const f of files) {
                    const att = await readFileAsAttachment(f);
                    if (att) next.push(att);
                  }
                  setSharedAttachments((prev) => [...prev, ...next]);
                  e.target.value = '';
                }}
              />
              {sharedAttachments.length > 0 && (
                <ul className="text-xs text-[var(--color-text-secondary)]">
                  {sharedAttachments.map((a) => (
                    <li key={a.id}>{a.fileName}</li>
                  ))}
                </ul>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sharedRequiresSig} onChange={(e) => setSharedRequiresSig(e.target.checked)} />
              Request signature on this shared note
            </label>
            <Button variant="outline" className="enterprise-interactive" onClick={() => void handleAddSharedNote()}>
              Post shared note
            </Button>
            <ul className="space-y-3 max-h-48 overflow-y-auto border-t border-[var(--color-border-200)] pt-3">
              {(investigation.notes ?? [])
                .filter((n) => n.visibility === 'EMPLOYEE')
                .map((n) => {
                  const author = users.find((u) => u.id === n.createdByUserId);
                  return (
                    <li key={n.id} className="text-sm border border-[var(--color-border-200)] rounded-md p-3">
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {author?.firstName} {author?.lastName} · {formatRelativeTime(n.createdAt)}
                        {n.requiresEmployeeSignature && (
                          <span className="ml-2 text-amber-700">Signature requested</span>
                        )}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap">{n.body}</p>
                    </li>
                  );
                })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mismo-card border border-[var(--color-border-200)]">
        <CardContent className="p-6 space-y-4">
          <h2 className="mismo-heading text-xl text-[var(--color-primary-900)]">Outcome letter to employee</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            When the investigation concludes, send the written outcome here. The employee confirms agreement (or not)
            from their report view.
          </p>
          <Textarea
            rows={6}
            value={outcomeSummary}
            onChange={(e) => setOutcomeSummary(e.target.value)}
            placeholder="Summary of findings and next steps…"
          />
          <div className="space-y-2">
            <Label>Optional outcome PDF / image</Label>
            <Input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const att = await readFileAsAttachment(f);
                setOutcomeFile(att);
                e.target.value = '';
              }}
            />
            {outcomeFile && <p className="text-xs text-[var(--color-text-secondary)]">{outcomeFile.fileName}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={outcomeRequiresSig} onChange={(e) => setOutcomeRequiresSig(e.target.checked)} />
            Require signature confirming the outcome information is correct
          </label>
          <div className="flex flex-wrap gap-2">
            <Button className="bg-[var(--mismo-blue)] hover:bg-blue-600" onClick={handleSendOutcome} disabled={phase === 'AWAITING_OUTCOME_ACK'}>
              Send outcome to employee
            </Button>
          </div>
          {investigation.outcomeSummary && (
            <div className="rounded-md border border-[var(--color-border-200)] p-4 bg-[var(--color-surface-200)] text-sm space-y-2">
              <p className="text-xs uppercase text-[var(--color-text-secondary)]">Last sent outcome</p>
              <p className="whitespace-pre-wrap">{investigation.outcomeSummary}</p>
              {investigation.outcomeSentAt && (
                <p className="text-xs text-[var(--color-text-secondary)]">Sent {formatRelativeTime(investigation.outcomeSentAt)}</p>
              )}
              {investigation.outcomeEmployeeSignedAt && (
                <p className="text-xs">
                  Employee signed {formatRelativeTime(investigation.outcomeEmployeeSignedAt)}.{' '}
                  {investigation.outcomeEmployeeAgreed === true
                    ? 'agreed with resolution'
                    : investigation.outcomeEmployeeAgreed === false
                      ? 'does not agree'
                      : ''}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mismo-card border border-[var(--color-border-200)]">
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-[var(--color-border-200)]">
            <h2 className="mismo-heading text-2xl text-[var(--color-primary-900)]">Linked reports</h2>
          </div>
          <div className="divide-y divide-[var(--color-border-200)]">
            {linkedReports.map((report) => (
              <div key={report.id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--color-text-primary)]">Case #{report.id.replace('report-', '').toUpperCase()}</p>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">{report.summary}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">Updated {formatRelativeTime(report.updatedAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={getCategoryColor(report.category)}>{getCategoryLabel(report.category)}</Badge>
                  <Badge className={getSeverityColor(report.severity)}>{report.severity}</Badge>
                  <Badge className={getStatusColor(report.status)}>{report.status}</Badge>
                  <Button size="sm" variant="outline" className="enterprise-interactive" onClick={() => onNavigate('report-detail', { id: report.id })}>
                    Open case
                  </Button>
                </div>
              </div>
            ))}
            {linkedReports.length === 0 && (
              <p className="px-5 py-6 text-sm text-[var(--color-text-secondary)]">No reports linked to this investigation.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" className="border-[var(--color-alert-600)] text-[var(--color-alert-700)]" onClick={handleClose}>
          Close investigation
        </Button>
      </div>
    </div>
  );
}
