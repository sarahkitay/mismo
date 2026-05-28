import { useRef, useState, type ComponentType } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type {
  CorrectiveActionType,
  FollowUpType,
  Investigation,
  InvestigationEmployeeContactPreference,
  InvestigationEvidenceType,
  OutcomeClassification,
  User,
  Report,
  ResponseRequestMethod,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AIGuidancePanel,
  InvestigationModuleShell,
  InvestigationSubModule,
} from '@/components/admin/investigation/InvestigationModuleShell';
import {
  EVIDENCE_GATHERING_PROMPTS,
  formatReportReference,
  getAllInvestigationEvidence,
  getCompletenessReview,
  getInvestigationPersons,
  getLinkedPromptContext,
  getModuleProgress,
  OUTCOME_CLASSIFICATION_LABELS,
  PERSON_ROLE_LABELS,
  REPORT_SOURCE_LABELS,
} from '@/lib/investigationWorkflow';
import { formatDate, formatRelativeTime, getCategoryLabel, isIncidentIntakeComplete } from '@/lib/utils';
import { EmployeeIntakeReadOnly } from '@/components/admin/EmployeeIntakeReadOnly';
import { downloadCsv } from '@/lib/exportCsv';
import { toast } from 'sonner';

export interface WorkflowContext {
  investigation: Investigation;
  dataStore: DataStore;
  users: User[];
  primaryReport?: Report;
  reporter?: User;
  owner?: User;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  onTabChange: (tab: string) => void;
  openProfile: (userId: string) => void;
  EmployeeLink: ComponentType<{ user?: User; onClick: () => void }>;
}

const CORRECTIVE_ACTION_LABELS: Record<CorrectiveActionType, string> = {
  COACHING: 'Coaching',
  WARNING: 'Warning',
  SUSPENSION: 'Suspension',
  TERMINATION: 'Termination',
  TRAINING: 'Training',
  MEDIATION: 'Mediation',
  REASSIGNMENT: 'Reassignment',
  MONITORING: 'Monitoring',
  POLICY_UPDATE: 'Policy update',
  NO_ACTION: 'No action',
};

const FOLLOW_UP_LABELS: Record<FollowUpType, string> = {
  RETALIATION_CHECK: 'Retaliation check',
  WELLNESS: 'Wellness follow-up',
  MANAGER_REVIEW: 'Manager review',
  CORRECTIVE_VERIFY: 'Corrective action verification',
  GENERAL: 'General check-in',
};

const RESPONSE_METHOD_LABELS: Record<ResponseRequestMethod, string> = {
  IN_APP: 'Respond in Mismo',
  WRITTEN_STATEMENT: 'Upload written statement',
  ATTORNEY_STATEMENT: 'Upload attorney statement',
  EMAIL: 'Email response',
  MEETING: 'Schedule interview / meeting',
};

function readEvidenceFile(file: File): Promise<{ fileName: string; mimeType: string; dataUrl: string } | null> {
  return new Promise((resolve) => {
    if (file.size > 5_000_000) {
      toast.error('File must be under 5 MB for this demo.');
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataUrl: typeof reader.result === 'string' ? reader.result : '',
      });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export function IntakeTriageModule(ctx: WorkflowContext) {
  const { investigation, dataStore, primaryReport, reporter, owner, onNavigate, openProfile, EmployeeLink } = ctx;
  const progress = getModuleProgress(investigation)['intake-triage'];
  const promptCtx = getLinkedPromptContext(investigation, primaryReport, dataStore.prompts, dataStore.responses);
  const [pickupContact, setPickupContact] = useState<InvestigationEmployeeContactPreference>('IN_APP_MESSAGE');
  const [showIntake, setShowIntake] = useState(true);
  const stage = investigation.stage ?? 'PENDING_REVIEW';

  return (
    <InvestigationModuleShell
      title="Page 1 — Intake & assignment"
      subtitle="Automatic report data, unified case ID, admin assignment, employee form status, and initial contact notes."
      completionPercent={progress.percent}
      status={progress.status}
    >
      {primaryReport && (
        <InvestigationSubModule title="Automatic intake from report" badge={isIncidentIntakeComplete(primaryReport) ? 'EI complete' : 'EI pending'}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Case file ID</p>
              <p className="font-medium font-mono">{formatReportReference(primaryReport)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Reported from</p>
              <p>{REPORT_SOURCE_LABELS[investigation.reportSourceType ?? primaryReport.reportSourceType ?? 'SELF_REPORTED']}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Reporting party</p>
              <EmployeeLink user={reporter} onClick={() => reporter && openProfile(reporter.id)} />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Date / time reported</p>
              <p>{formatDate(primaryReport.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Allegation type</p>
              <p>{getCategoryLabel(primaryReport.category)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Lead investigator</p>
              <p>{owner ? `${owner.firstName} ${owner.lastName}` : 'Unassigned'}</p>
            </div>
          </div>
          {promptCtx.prompt && (
            <div className="mt-3 p-3 bg-[var(--color-surface-100)] border border-[var(--color-border-200)] text-sm">
              <p className="font-medium">Linked prompt: {promptCtx.prompt.title}</p>
              {promptCtx.response && (
                <p className="text-[var(--color-text-secondary)]">
                  Employee answered: {promptCtx.response.answer}
                  {promptCtx.response.finalizedAt && ` · Submitted ${formatDate(promptCtx.response.finalizedAt)}`}
                </p>
              )}
              <Button
                size="sm"
                variant="link"
                className="px-0 h-auto mt-1"
                onClick={() =>
                  promptCtx.response
                    ? onNavigate('prompt-response-detail', { id: promptCtx.response.id })
                    : onNavigate('prompts')
                }
              >
                Open prompt response
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-3">
            <Button size="sm" variant="outline" onClick={() => setShowIntake((v) => !v)}>
              {showIntake ? 'Hide employee form' : 'View employee form'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate('report-detail', { id: primaryReport.id, fromInvestigation: investigation.id })}>
              Open report record
            </Button>
            <Button size="sm" variant="outline" onClick={() => ctx.onTabChange('page-2')}>
              Add persons (Page 2)
            </Button>
          </div>
          {showIntake && (
            <div className="mt-3">
              <EmployeeIntakeReadOnly report={primaryReport} organizationName={dataStore.organizationName} />
            </div>
          )}
        </InvestigationSubModule>
      )}

      <InvestigationSubModule
        title="Triage actions"
        description="Assign ownership, record preferred contact method, and open the case to begin structured information gathering."
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Lead investigator</Label>
            <Select value={investigation.ownerId} onValueChange={(v) => dataStore.assignInvestigationOwner(investigation.id, v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ctx.users.filter((u) => ['HR', 'ADMIN', 'MANAGER'].includes(u.role)).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Preferred contact method</Label>
            <Select value={pickupContact} onValueChange={(v) => setPickupContact(v as InvestigationEmployeeContactPreference)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="IN_APP_MESSAGE">Direct message</SelectItem>
                <SelectItem value="PHONE_CALL">Phone call</SelectItem>
                <SelectItem value="EMAIL">Email</SelectItem>
                <SelectItem value="IN_PERSON">In person</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {(stage === 'PENDING_REVIEW' || stage === 'ASSIGNED' || !investigation.pickedUpAt) && (
          <Button
            className="mt-3 bg-[var(--color-primary-900)]"
            onClick={() => {
              dataStore.pickUpInvestigation(investigation.id, pickupContact);
              toast.success('Case opened. Proceed to Information Gathering.');
              ctx.onTabChange('page-2');
              dataStore.markInvestigationPageComplete(investigation.id, 'intake');
            }}
          >
            Open case &amp; begin investigation
          </Button>
        )}
      </InvestigationSubModule>

      <InvestigationSubModule title="Initial contact with employee" description="Document first outreach, scheduling, and triage thoughts. Internal only until you send a shared note.">
        <Textarea
          rows={4}
          placeholder="Initial contact notes — call summary, meeting scheduled, interim safety steps…"
          value={investigation.initialContactNotes ?? ''}
          onChange={(e) => dataStore.setInvestigationInitialContactNotes(investigation.id, e.target.value)}
        />
      </InvestigationSubModule>

      <AIGuidancePanel
        items={[
          'Review allegation classification against intake narrative.',
          'Flag immediate retaliation or safety concerns for escalation.',
          'Confirm reporting party receipt acknowledgment will be sent automatically.',
        ]}
      />
    </InvestigationModuleShell>
  );
}

export function InformationGatheringModule(ctx: WorkflowContext) {
  const { investigation, dataStore, primaryReport, users } = ctx;
  const progress = getModuleProgress(investigation)['information-gathering'];
  const evidence = getAllInvestigationEvidence(investigation);
  const fileRef = useRef<HTMLInputElement>(null);
  const [activePrompt, setActivePrompt] = useState(EVIDENCE_GATHERING_PROMPTS[0].id);
  const [uploadDesc, setUploadDesc] = useState('');
  const complaintAt = primaryReport?.createdAt ?? investigation.openedAt;
  const persons = getInvestigationPersons(investigation, ctx.owner).filter((p) => p.userId);
  const policiesInEffect = dataStore.policies.filter(
    (p) => p.status === 'PUBLISHED' && p.effectiveDate.getTime() <= complaintAt.getTime()
  );

  const handleUpload = async (file: File, type: InvestigationEvidenceType, promptLabel?: string) => {
    const parsed = await readEvidenceFile(file);
    if (!parsed) return;
    dataStore.addInvestigationEvidence(investigation.id, {
      type,
      fileName: parsed.fileName,
      mimeType: parsed.mimeType,
      dataUrl: parsed.dataUrl,
      description: uploadDesc || undefined,
      sourceType: 'UPLOAD',
      promptLabel,
    });
    setUploadDesc('');
    toast.success('Evidence uploaded and preserved with audit timestamp.');
  };

  return (
    <InvestigationModuleShell
      title="Page 2 — Gather information"
      subtitle="Persons involved, interviews, evidence, company policies, and legal involvement."
      completionPercent={progress.percent}
      status={progress.status}
    >
      <InvestigationSubModule
        title="Company policies & memo acknowledgements"
        description={`Published memos/policies effective on or before the complaint date (${formatDate(complaintAt)}). Select a person on this case to see what they had read.`}
      >
        {persons.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Add named employees on Page 2 (persons table) to review acknowledgement history.</p>
        ) : (
          <div className="space-y-4">
            {persons.map((person) => {
              const u = users.find((x) => x.id === person.userId);
              if (!u) return null;
              return (
                <div key={person.id} className="border border-[var(--color-border-200)] p-3">
                  <p className="font-medium text-sm">
                    {u.firstName} {u.lastName}{' '}
                    <span className="text-xs text-[var(--color-text-muted)]">({PERSON_ROLE_LABELS[person.role]})</span>
                  </p>
                  <ul className="mt-2 space-y-1 text-xs max-h-40 overflow-auto">
                    {policiesInEffect.slice(0, 8).map((policy) => {
                      const ack = dataStore.policyAcknowledgements.find(
                        (a) => a.policyId === policy.id && a.userId === u.id
                      );
                      const readBeforeComplaint = ack && ack.acknowledgedAt.getTime() <= complaintAt.getTime();
                      return (
                        <li key={policy.id} className="flex justify-between gap-2">
                          <span className="truncate">{policy.title}</span>
                          <span className={readBeforeComplaint ? 'text-emerald-700 shrink-0' : 'text-amber-700 shrink-0'}>
                            {ack
                              ? readBeforeComplaint
                                ? `Read ${formatDate(ack.acknowledgedAt)}`
                                : `Read after complaint`
                              : policy.acknowledgmentRequired
                                ? 'Not acknowledged'
                                : 'Optional'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <Button size="sm" variant="link" className="px-0 h-auto mt-1" onClick={() => ctx.openProfile(u.id)}>
                    Open full profile &amp; memo history
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3 space-y-2">
          <Label className="text-xs">Policies implicated (analysis)</Label>
          <Textarea
            rows={3}
            placeholder="Which handbook sections or memos apply to this allegation?"
            value={investigation.policyAnalysisNotes ?? ''}
            onChange={(e) => dataStore.updateInvestigationAnalysis(investigation.id, { policyAnalysisNotes: e.target.value })}
          />
        </div>
      </InvestigationSubModule>

      <InvestigationSubModule title="Legal involvement" description="Flag when counsel or an outside investigator should participate.">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(investigation.legalInvolved)}
            onChange={(e) => dataStore.updateInvestigationAnalysis(investigation.id, { legalInvolved: e.target.checked })}
          />
          Legal / outside counsel involved in this matter
        </label>
        <Textarea
          rows={2}
          className="mt-2"
          placeholder="Counsel contact, privilege notes, or escalation reason…"
          value={investigation.legalInvolvementNotes ?? ''}
          onChange={(e) => dataStore.updateInvestigationAnalysis(investigation.id, { legalInvolvementNotes: e.target.value })}
        />
      </InvestigationSubModule>

      <InvestigationSubModule
        title="Evidence collection"
        description="Use guided prompts to collect the right materials — screenshots, communications, policies, and statements."
        badge={`${evidence.length} file(s)`}
      >
        <div className="flex flex-wrap gap-2 mb-3">
          {EVIDENCE_GATHERING_PROMPTS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActivePrompt(p.id)}
              className={`text-xs px-3 py-1.5 border ${activePrompt === p.id ? 'border-[var(--color-primary-900)] bg-blue-50 font-medium' : 'border-[var(--color-border-200)]'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input ref={fileRef} type="file" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const prompt = EVIDENCE_GATHERING_PROMPTS.find((p) => p.id === activePrompt);
          await handleUpload(file, prompt?.type ?? 'DOCUMENT', prompt?.label);
          e.target.value = '';
        }} />
        <Textarea rows={2} placeholder="Optional description for this evidence item…" value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} />
        <Button variant="outline" onClick={() => fileRef.current?.click()}>Upload evidence file</Button>
      </InvestigationSubModule>

      <InvestigationSubModule
        title="Secure and preserve evidence"
        description="Ensure messages, screenshots, emails, logs, and uploaded files are preserved without modification. Deletions require audit logging."
      >
        <ul className="space-y-2 text-sm">
          {evidence.length === 0 ? (
            <p className="text-[var(--color-text-secondary)]">No evidence uploaded yet. Use the collection prompts above.</p>
          ) : (
            evidence.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 border border-[var(--color-border-200)] p-3">
                <div>
                  <p className="font-medium">{e.fileName}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {e.type} · {e.promptLabel ?? e.sourceType} · {formatRelativeTime(e.uploadedAt)}
                  </p>
                </div>
                <Badge className={e.preserved ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}>
                  {e.preserved ? 'Preserved' : 'Pending preservation'}
                </Badge>
              </li>
            ))
          )}
        </ul>
      </InvestigationSubModule>

      <AIGuidancePanel
        items={[
          'Suggest additional documents based on allegation type.',
          'Identify gaps in documentary evidence.',
          'Recommend preservation holds for relevant systems.',
        ]}
      />
    </InvestigationModuleShell>
  );
}

export function InterviewsNotesModule(ctx: WorkflowContext) {
  const { investigation, dataStore, users } = ctx;
  const progress = getModuleProgress(investigation)['interviews-notes'];
  const persons = getInvestigationPersons(investigation, ctx.owner);
  const [noteBody, setNoteBody] = useState('');
  const [noteType, setNoteType] = useState<'INTERVIEW' | 'PRIVATE_HR' | 'LEGAL' | 'SHARED'>('INTERVIEW');
  const [sharedNoteBody, setSharedNoteBody] = useState('');
  const [reqParty, setReqParty] = useState('');
  const [reqMethod, setReqMethod] = useState<ResponseRequestMethod>('IN_APP');
  const [reqMessage, setReqMessage] = useState('');
  const [reqDeadline, setReqDeadline] = useState('');

  const partyOptions = persons.filter((p) => p.userId);

  return (
    <InvestigationModuleShell
      title="Interviews & Notes"
      subtitle="Document interviews automatically with timestamps. Request party responses through a tracked communication workflow — not checkboxes."
      completionPercent={progress.percent}
      status={progress.status}
    >
      <InvestigationSubModule title="Response request workflow" description="Allow each party to respond to allegations through a tracked, deadline-aware process.">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Party</Label>
            <Select value={reqParty} onValueChange={setReqParty}>
              <SelectTrigger><SelectValue placeholder="Select party" /></SelectTrigger>
              <SelectContent>
                {partyOptions.map((p) => {
                  const u = users.find((x) => x.id === p.userId);
                  return u ? (
                    <SelectItem key={p.id} value={p.userId!}>{PERSON_ROLE_LABELS[p.role]} — {u.firstName} {u.lastName}</SelectItem>
                  ) : null;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Response method</Label>
            <Select value={reqMethod} onValueChange={(v) => setReqMethod(v as ResponseRequestMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(RESPONSE_METHOD_LABELS) as ResponseRequestMethod[]).map((k) => (
                  <SelectItem key={k} value={k}>{RESPONSE_METHOD_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Textarea rows={3} className="mt-2" placeholder="Request message / allegations summary for party…" value={reqMessage} onChange={(e) => setReqMessage(e.target.value)} />
        <Input type="date" className="mt-2 max-w-xs" value={reqDeadline} onChange={(e) => setReqDeadline(e.target.value)} />
        <Button
          className="mt-2"
          variant="outline"
          onClick={() => {
            if (!reqParty || !reqMessage.trim()) {
              toast.error('Select a party and enter a request message.');
              return;
            }
            const person = partyOptions.find((p) => p.userId === reqParty);
            dataStore.addInvestigationResponseRequest(investigation.id, {
              partyUserId: reqParty,
              partyRole: person?.role ?? 'WITNESS',
              method: reqMethod,
              message: reqMessage.trim(),
              deadline: reqDeadline ? new Date(reqDeadline) : undefined,
              sentAt: new Date(),
            });
            setReqMessage('');
            toast.success('Response request sent and logged to timeline.');
          }}
        >
          Send response request
        </Button>
        <ul className="mt-4 space-y-2">
          {(investigation.responseRequests ?? []).map((r) => {
            const u = users.find((x) => x.id === r.partyUserId);
            return (
              <li key={r.id} className="border border-[var(--color-border-200)] p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{u ? `${u.firstName} ${u.lastName}` : r.partyUserId} · {RESPONSE_METHOD_LABELS[r.method]}</span>
                  <Badge variant="outline">{r.status}</Badge>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Sent {r.sentAt ? formatRelativeTime(r.sentAt) : '—'}
                  {r.deadline && ` · Due ${formatDate(r.deadline)}`}
                  {r.viewedAt && ` · Viewed ${formatRelativeTime(r.viewedAt)}`}
                  {r.submittedAt && ` · Submitted ${formatRelativeTime(r.submittedAt)}`}
                </p>
                <div className="flex gap-2 mt-2">
                  {r.status === 'SENT' && (
                    <Button size="sm" variant="outline" onClick={() => dataStore.updateInvestigationResponseRequest(investigation.id, r.id, { status: 'VIEWED', viewedAt: new Date() })}>
                      Mark viewed
                    </Button>
                  )}
                  {['SENT', 'VIEWED'].includes(r.status) && (
                    <Button size="sm" variant="outline" onClick={() => dataStore.updateInvestigationResponseRequest(investigation.id, r.id, { status: 'SUBMITTED', submittedAt: new Date() })}>
                      Mark submitted
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </InvestigationSubModule>

      <InvestigationSubModule
        title="Shared note to employee"
        description="Employee-visible updates appear on their report portal. Internal notes never leave this workspace."
      >
        <Textarea
          rows={3}
          placeholder="Message the reporting employee will see in My Reports…"
          value={sharedNoteBody}
          onChange={(e) => setSharedNoteBody(e.target.value)}
        />
        <Button
          className="mt-2"
          variant="outline"
          onClick={() => {
            if (!sharedNoteBody.trim()) return;
            dataStore.addInvestigationNote(investigation.id, {
              visibility: 'EMPLOYEE',
              body: sharedNoteBody.trim(),
              noteType: 'SHARED',
            });
            setSharedNoteBody('');
            toast.success('Shared note sent to employee portal.');
          }}
        >
          Send shared note
        </Button>
      </InvestigationSubModule>

      <InvestigationSubModule title="Investigation notes center" description="Interview notes are auto-timestamped. Tag people and link evidence from other modules.">
        <Select value={noteType} onValueChange={(v) => setNoteType(v as typeof noteType)}>
          <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="INTERVIEW">Interview note</SelectItem>
            <SelectItem value="PRIVATE_HR">Private HR note</SelectItem>
            <SelectItem value="LEGAL">Legal note</SelectItem>
          </SelectContent>
        </Select>
        <Textarea rows={4} className="mt-2" placeholder="Document interview or internal observation…" value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
        <Button
          className="mt-2"
          onClick={() => {
            if (!noteBody.trim()) return;
            dataStore.addInvestigationNote(investigation.id, {
              visibility: 'INTERNAL',
              body: noteBody.trim(),
              noteType: noteType === 'SHARED' ? 'PRIVATE_HR' : noteType,
            });
            setNoteBody('');
            toast.success('Note added with automatic timestamp and author log.');
          }}
        >
          Add internal note
        </Button>
        <ul className="mt-4 space-y-2 max-h-64 overflow-y-auto">
          {(investigation.notes ?? [])
            .filter((n) => n.visibility === 'INTERNAL')
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map((n) => {
              const author = users.find((u) => u.id === n.createdByUserId);
              return (
                <li key={n.id} className={`border p-3 text-sm ${n.pinned ? 'border-[var(--mismo-blue)] bg-blue-50/40' : 'border-[var(--color-border-200)]'}`}>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {n.noteType ?? 'NOTE'} · {author?.firstName} {author?.lastName} · {formatRelativeTime(n.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
                </li>
              );
            })}
        </ul>
      </InvestigationSubModule>
    </InvestigationModuleShell>
  );
}

export function EvidenceAnalysisModule(ctx: WorkflowContext) {
  const { investigation, dataStore } = ctx;
  const progress = getModuleProgress(investigation)['evidence-analysis'];
  const review = getCompletenessReview(investigation);
  const [rationale, setRationale] = useState(investigation.findingsRationale ?? '');
  const [policyNotes, setPolicyNotes] = useState(investigation.policyAnalysisNotes ?? '');
  const policies = dataStore.policies.filter((p) => p.status === 'PUBLISHED').slice(0, 6);

  return (
    <InvestigationModuleShell
      title="Evidence & Analysis"
      subtitle="Review collected materials, compare facts to policy language, and document your findings rationale before outcome determination."
      completionPercent={progress.percent}
      status={progress.status}
    >
      <InvestigationSubModule title="Pre-submission completeness review" badge={review.ready ? 'Ready' : 'Gaps identified'}>
        <ul className="space-y-2 text-sm">
          {review.checks.map((c) => (
            <li key={c.id} className={`flex items-start gap-2 p-2 border ${c.pass ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
              <span className={c.pass ? 'text-emerald-700' : 'text-amber-700'}>{c.pass ? '✓' : '○'}</span>
              <div>
                <p className="font-medium">{c.label}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
        <AIGuidancePanel
          title="AI completeness review (preview)"
          items={review.checks.filter((c) => !c.pass).map((c) => `Resolve: ${c.detail}`).concat(['Summarize timeline contradictions', 'Flag missing witness statements'])}
        />
      </InvestigationSubModule>

      <InvestigationSubModule title="Policy analysis" description="Link relevant policies and document how evidence maps to policy language.">
        <div className="flex flex-wrap gap-2 mb-3">
          {policies.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`text-xs px-2 py-1 border ${investigation.linkedPolicyIds?.includes(p.id) ? 'border-[var(--color-primary-900)] bg-blue-50' : 'border-[var(--color-border-200)]'}`}
              onClick={() => {
                const ids = investigation.linkedPolicyIds ?? [];
                const next = ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id];
                dataStore.updateInvestigationAnalysis(investigation.id, { linkedPolicyIds: next });
              }}
            >
              {p.title}
            </button>
          ))}
        </div>
        <Textarea
          rows={4}
          placeholder="Example: Evidence may support violation of Anti-Harassment Policy Section 4.2…"
          value={policyNotes}
          onChange={(e) => setPolicyNotes(e.target.value)}
          onBlur={() => dataStore.updateInvestigationAnalysis(investigation.id, { policyAnalysisNotes: policyNotes })}
        />
        <AIGuidancePanel items={['Compare allegation facts to linked policy excerpts.', 'Highlight applicable sections automatically.', 'Flag conduct concerns without policy violations.']} />
      </InvestigationSubModule>

      <InvestigationSubModule title="Findings rationale" description="Explain why your conclusion was reached — supporting evidence, credibility assessment, and policy application.">
        <Textarea
          rows={6}
          placeholder="Document reasoning based on evidence reviewed. Avoid speculation — state facts and inferences supported by the record."
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          onBlur={() => {
            dataStore.updateInvestigationAnalysis(investigation.id, { findingsRationale: rationale });
            if (rationale.trim()) dataStore.advanceInvestigationStage(investigation.id, 'FINDINGS_DRAFTED', 'Findings rationale documented');
          }}
        />
      </InvestigationSubModule>
    </InvestigationModuleShell>
  );
}

export function FindingsOutcomeModule(ctx: WorkflowContext) {
  const { investigation, dataStore } = ctx;
  const progress = getModuleProgress(investigation)['findings-outcome'];
  const [classification, setClassification] = useState<OutcomeClassification>(investigation.outcomeClassification ?? 'INCONCLUSIVE');
  const [inconclusiveNotes, setInconclusiveNotes] = useState('');
  const [finalReport, setFinalReport] = useState(investigation.finalFindingsReport ?? '');

  const outcomeOptions: OutcomeClassification[] = [
    'SUBSTANTIATED',
    'PARTIALLY_SUBSTANTIATED',
    'UNSUBSTANTIATED',
    'INCONCLUSIVE',
    'POLICY_VIOLATION_CONFIRMED',
    'CONDUCT_CONCERN',
  ];

  return (
    <InvestigationModuleShell
      title="Page 3 — Outcome & close"
      subtitle="Finalize findings, record resolution, send the outcome letter, and export the investigation file."
      completionPercent={progress.percent}
      status={progress.status}
    >
      <InvestigationSubModule title="Outcome determination">
        <Select
          value={classification}
          onValueChange={(v) => {
            setClassification(v as OutcomeClassification);
            dataStore.setInvestigationOutcomeClassification(investigation.id, v as OutcomeClassification);
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {outcomeOptions.map((k) => (
              <SelectItem key={k} value={k}>{OUTCOME_CLASSIFICATION_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {classification === 'INCONCLUSIVE' && (
          <div className="mt-3 space-y-2">
            <Label className="text-xs">Missing evidence / future recommendations</Label>
            <Textarea rows={3} value={inconclusiveNotes} onChange={(e) => setInconclusiveNotes(e.target.value)} placeholder="Document what evidence was insufficient and recommended next steps…" />
          </div>
        )}
      </InvestigationSubModule>

      <InvestigationSubModule title="Final findings report" description="Auto-draft from interviews, evidence, and rationale — editable before export.">
        <Button
          size="sm"
          variant="outline"
          className="mb-2"
          onClick={() => {
            const draft = [
              `Investigation: ${investigation.referenceNumber ?? investigation.id}`,
              `Outcome: ${OUTCOME_CLASSIFICATION_LABELS[classification]}`,
              '',
              'Findings rationale:',
              investigation.findingsRationale ?? '(Not documented)',
              '',
              'Policy analysis:',
              investigation.policyAnalysisNotes ?? '(Not documented)',
            ].join('\n');
            setFinalReport(draft);
            dataStore.updateInvestigationAnalysis(investigation.id, { finalFindingsReport: draft });
            toast.success('Draft generated from case record.');
          }}
        >
          Generate draft from case record
        </Button>
        <Textarea rows={8} value={finalReport} onChange={(e) => setFinalReport(e.target.value)} onBlur={() => dataStore.updateInvestigationAnalysis(investigation.id, { finalFindingsReport: finalReport })} />
      </InvestigationSubModule>
    </InvestigationModuleShell>
  );
}

export function ResolutionActionsModule(ctx: WorkflowContext) {
  const { investigation, dataStore, users } = ctx;
  const progress = getModuleProgress(investigation)['resolution-actions'];
  const [actionType, setActionType] = useState<CorrectiveActionType>('COACHING');
  const [actionDesc, setActionDesc] = useState('');
  const [actionAssignee, setActionAssignee] = useState(investigation.ownerId);
  const [outcomeSummary, setOutcomeSummary] = useState(investigation.outcomeSummary ?? '');
  const [outcomeRequiresSig, setOutcomeRequiresSig] = useState(true);

  return (
    <InvestigationModuleShell
      title="Resolution & Actions"
      subtitle="Assign corrective actions, communicate outcomes, and generate defensible resolution documentation."
      completionPercent={progress.percent}
      status={progress.status}
    >
      <InvestigationSubModule title="Corrective action module">
        <div className="grid sm:grid-cols-3 gap-3">
          <Select value={actionType} onValueChange={(v) => setActionType(v as CorrectiveActionType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(CORRECTIVE_ACTION_LABELS) as CorrectiveActionType[]).map((k) => (
                <SelectItem key={k} value={k}>{CORRECTIVE_ACTION_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actionAssignee} onValueChange={setActionAssignee}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {users.filter((u) => ['HR', 'ADMIN', 'MANAGER'].includes(u.role)).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => {
              if (!actionDesc.trim()) {
                toast.error('Enter action description.');
                return;
              }
              dataStore.addCorrectiveAction(investigation.id, {
                type: actionType,
                assigneeUserId: actionAssignee,
                description: actionDesc.trim(),
              });
              setActionDesc('');
              toast.success('Corrective action assigned and tracked.');
            }}
          >
            Assign action
          </Button>
        </div>
        <Textarea rows={2} className="mt-2" placeholder="Action details, deadline context…" value={actionDesc} onChange={(e) => setActionDesc(e.target.value)} />
        <ul className="mt-3 space-y-2">
          {(investigation.correctiveActions ?? []).map((a) => {
            const assignee = users.find((u) => u.id === a.assigneeUserId);
            return (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 border border-[var(--color-border-200)] p-3 text-sm">
                <div>
                  <p className="font-medium">{CORRECTIVE_ACTION_LABELS[a.type]}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{assignee?.firstName} {assignee?.lastName} · {a.description}</p>
                </div>
                <Select value={a.status} onValueChange={(v) => dataStore.updateCorrectiveAction(investigation.id, a.id, { status: v as typeof a.status })}>
                  <SelectTrigger className="w-[130px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                    <SelectItem value="COMPLETE">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </li>
            );
          })}
        </ul>
        <AIGuidancePanel items={['Compare corrective action to similar prior cases.', 'Check proportionality against severity and policy.', 'Flag inconsistency with historical outcomes.']} />
      </InvestigationSubModule>

      <InvestigationSubModule title="Communicate outcome to parties">
        <Textarea rows={5} value={outcomeSummary} onChange={(e) => setOutcomeSummary(e.target.value)} placeholder="Final resolution summary for employee portal…" />
        <label className="flex items-center gap-2 text-sm mt-2">
          <input type="checkbox" checked={outcomeRequiresSig} onChange={(e) => setOutcomeRequiresSig(e.target.checked)} />
          Require employee acknowledgment
        </label>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            className="bg-[var(--mismo-blue)]"
            onClick={() => {
              if (!outcomeSummary.trim()) {
                toast.error('Enter outcome summary.');
                return;
              }
              dataStore.sendInvestigationOutcomeToEmployee(investigation.id, {
                summary: outcomeSummary.trim(),
                requiresSignature: outcomeRequiresSig,
              });
              if (!investigation.nonRetaliationSentAt) dataStore.sendNonRetaliationReminder(investigation.id);
              toast.success('Outcome sent. Non-retaliation reminder logged automatically.');
            }}
          >
            Send outcome to employee
          </Button>
        </div>
        {investigation.outcomeSentAt && (
          <div className="mt-3 text-sm border border-[var(--color-border-200)] p-3 bg-[var(--color-surface-100)]">
            <p>Sent: {formatDate(investigation.outcomeSentAt)}</p>
            <p>Signed: {investigation.outcomeEmployeeSignedAt ? formatDate(investigation.outcomeEmployeeSignedAt) : 'Pending'}</p>
            {investigation.nonRetaliationSentAt && <p>Non-retaliation reminder: {formatDate(investigation.nonRetaliationSentAt)}</p>}
          </div>
        )}
      </InvestigationSubModule>
    </InvestigationModuleShell>
  );
}

export function FollowUpMonitoringModule(ctx: WorkflowContext) {
  const { investigation, dataStore, users } = ctx;
  const progress = getModuleProgress(investigation)['follow-up-monitoring'];
  const [fuType, setFuType] = useState<FollowUpType>('RETALIATION_CHECK');
  const [fuDate, setFuDate] = useState('');
  const [fuAssignee, setFuAssignee] = useState(investigation.ownerId);

  return (
    <InvestigationModuleShell
      title="Follow-Up & Monitoring"
      subtitle="Post-resolution monitoring for retaliation, corrective action completion, and employee wellness."
      completionPercent={progress.percent}
      status={progress.status}
    >
      <InvestigationSubModule title="Retaliation monitoring" description="Schedule follow-up reviews and log any concerns — ongoing monitoring, not a one-time checkbox.">
        <div className="grid sm:grid-cols-3 gap-3">
          <Select value={fuType} onValueChange={(v) => setFuType(v as FollowUpType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(FOLLOW_UP_LABELS) as FollowUpType[]).map((k) => (
                <SelectItem key={k} value={k}>{FOLLOW_UP_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={fuDate} onChange={(e) => setFuDate(e.target.value)} />
          <Select value={fuAssignee} onValueChange={setFuAssignee}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {users.filter((u) => ['HR', 'ADMIN', 'MANAGER'].includes(u.role)).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          className="mt-2"
          variant="outline"
          onClick={() => {
            if (!fuDate) {
              toast.error('Select a follow-up date.');
              return;
            }
            dataStore.addFollowUp(investigation.id, {
              type: fuType,
              scheduledFor: new Date(fuDate),
              assigneeUserId: fuAssignee,
            });
            toast.success('Follow-up scheduled.');
          }}
        >
          Schedule follow-up
        </Button>
        <ul className="mt-4 space-y-2">
          {(investigation.followUps ?? []).map((f) => {
            const assignee = users.find((u) => u.id === f.assigneeUserId);
            return (
              <li key={f.id} className="border border-[var(--color-border-200)] p-3 text-sm flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium">{FOLLOW_UP_LABELS[f.type]}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {formatDate(f.scheduledFor)} · {assignee?.firstName} {assignee?.lastName} · {f.status}
                  </p>
                </div>
                {f.status !== 'COMPLETE' && (
                  <Button size="sm" variant="outline" onClick={() => dataStore.completeFollowUp(investigation.id, f.id, 'Follow-up completed — no concerns noted.')}>
                    Mark complete
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </InvestigationSubModule>

      <InvestigationSubModule title="Corrective action tracking" description="Actions assigned in Resolution are tracked here automatically.">
        {(investigation.correctiveActions ?? []).length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">No corrective actions assigned yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(investigation.correctiveActions ?? []).map((a) => (
              <li key={a.id} className="flex justify-between border border-[var(--color-border-200)] p-2">
                <span>{CORRECTIVE_ACTION_LABELS[a.type]} — {a.description}</span>
                <Badge variant="outline">{a.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </InvestigationSubModule>
    </InvestigationModuleShell>
  );
}

export function ClosureAuditModule(ctx: WorkflowContext) {
  const { investigation, dataStore, users } = ctx;
  const progress = getModuleProgress(investigation)['closure-audit'];
  const invAudit = dataStore.auditLogs.filter((a) => a.recordId === investigation.id || a.recordType === 'INVESTIGATION');

  return (
    <InvestigationModuleShell
      title="Closure & Audit Export"
      subtitle="Export an audit-safe case packet and close the investigation. Status updates are logged automatically."
      completionPercent={progress.percent}
      status={progress.status}
      primaryAction={
        investigation.status !== 'CLOSED' ? (
          <Button variant="outline" className="border-red-300 text-red-700" onClick={() => {
            dataStore.closeInvestigation(investigation.id);
            toast.success('Investigation closed. Audit record archived.');
          }}>
            Close investigation
          </Button>
        ) : undefined
      }
    >
      <InvestigationSubModule title="Export audit packet">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              downloadCsv(`investigation-audit-${investigation.id}.csv`, ['Field', 'Value'], [
                ['Investigation ID', investigation.referenceNumber ?? investigation.id],
                ['Status', investigation.status],
                ['Stage', investigation.stage ?? ''],
                ['Outcome', investigation.outcomeClassification ?? ''],
                ['Findings rationale', (investigation.findingsRationale ?? '').slice(0, 500)],
                ['Evidence count', String(getAllInvestigationEvidence(investigation).length)],
                ['Notes count', String(investigation.notes?.length ?? 0)],
                ['Closed', investigation.closedAt ? formatDate(investigation.closedAt) : 'Open'],
              ]);
              toast.success('Audit packet exported (CSV). PDF generation connects to your export service.');
            }}
          >
            Export audit packet (CSV)
          </Button>
        </div>
      </InvestigationSubModule>

      <InvestigationSubModule title="Investigation timeline" description="All actions, communications, uploads, edits, and status changes — chronological and audit-safe.">
        <ul className="space-y-2 max-h-96 overflow-y-auto">
          {(investigation.stageHistory ?? []).map((e, i) => {
            const actor = users.find((u) => u.id === e.enteredByUserId);
            return (
              <li key={`stage-${i}`} className="border border-[var(--color-border-200)] p-3 text-sm">
                <span className="font-medium">Stage: {e.stage.replace(/_/g, ' ')}</span>
                <span className="text-[var(--color-text-secondary)]"> · {actor ? `${actor.firstName} ${actor.lastName}` : 'System'} · {formatRelativeTime(e.enteredAt)}</span>
                {e.note && <p className="text-xs text-[var(--color-text-muted)] mt-1">{e.note}</p>}
              </li>
            );
          })}
          {invAudit.map((a) => (
            <li key={a.id} className="border border-[var(--color-border-200)] p-3 text-sm">
              <span className="font-medium">{a.field ?? 'Update'}</span>
              <span className="text-[var(--color-text-secondary)]"> · {formatRelativeTime(a.createdAt)}</span>
            </li>
          ))}
          {(investigation.notes ?? []).map((n) => (
            <li key={n.id} className="border border-[var(--color-border-200)] p-3 text-sm">
              <span className="font-medium">Note ({n.noteType ?? n.visibility})</span>
              <span className="text-[var(--color-text-secondary)]"> · {formatRelativeTime(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      </InvestigationSubModule>
    </InvestigationModuleShell>
  );
}
