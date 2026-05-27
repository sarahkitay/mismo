import { useMemo, useState, type ReactNode } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type {
  InvestigationEmployeeContactPreference,
  InvestigationPerson,
  InvestigationPersonRole,
  User,
} from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Icons } from '@/lib/icons';
import { formatDate, getCategoryLabel, getStatusColor } from '@/lib/utils';
import {
  CONTACT_METHOD_LABELS,
  formatReportReference,
  getEffectiveStage,
  getInvestigationAgeDays,
  getInvestigationDisplayId,
  getInvestigationPersons,
  getInvestigationTypeLabel,
  getModuleProgress,
  getNextStageAction,
  getSlaStatus,
  getStageProgressPercent,
  INVESTIGATION_STAGE_LABELS,
  INVESTIGATION_STAGES,
  INVESTIGATION_TABS,
  PERSON_ROLE_LABELS,
  REPORT_SOURCE_LABELS,
  type InvestigationTab,
} from '@/lib/investigationWorkflow';
import { InvestigationPersonDrawer } from '@/components/admin/investigation/InvestigationPersonDrawer';
import { AIGuidancePanel } from '@/components/admin/investigation/InvestigationModuleShell';
import {
  ClosureAuditModule,
  EvidenceAnalysisModule,
  FindingsOutcomeModule,
  FollowUpMonitoringModule,
  InformationGatheringModule,
  IntakeTriageModule,
  InterviewsNotesModule,
  ResolutionActionsModule,
  type WorkflowContext,
} from '@/components/admin/investigation/InvestigationWorkflowPages';

interface InvestigationWorkspaceProps {
  dataStore: DataStore;
  investigationId: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  activeTab: InvestigationTab;
  onTabChange: (tab: InvestigationTab) => void;
}

function EmployeeLink({ user, onClick }: { user?: User; onClick: () => void }) {
  if (!user) return <span className="text-[var(--color-text-muted)]">—</span>;
  return (
    <button type="button" className="text-[var(--mismo-blue)] hover:underline font-medium" onClick={onClick}>
      {user.firstName} {user.lastName}
    </button>
  );
}

export function InvestigationWorkspace({
  dataStore,
  investigationId,
  onNavigate,
  activeTab,
  onTabChange,
}: InvestigationWorkspaceProps) {
  const investigation = dataStore.investigations.find((i) => i.id === investigationId);
  const { users, reports, pickUpInvestigation, advanceInvestigationStage, setInvestigationPersons } = dataStore;

  const [personSearch, setPersonSearch] = useState('');
  const [personRoleFilter, setPersonRoleFilter] = useState<InvestigationPersonRole | 'ALL'>('ALL');
  const [reportSearch, setReportSearch] = useState('');
  const [drawerUserId, setDrawerUserId] = useState<string | null>(null);
  const [pickupContact, setPickupContact] = useState<InvestigationEmployeeContactPreference>('IN_APP_MESSAGE');

  const linkedReports = useMemo(
    () => reports.filter((r) => investigation?.linkedReportIds.includes(r.id)),
    [reports, investigation?.linkedReportIds]
  );

  if (!investigation) {
    return <div className="text-sm text-[var(--mismo-text-secondary)]">Investigation not found.</div>;
  }

  const stage = getEffectiveStage(investigation);
  const owner = users.find((u) => u.id === investigation.ownerId);
  const primaryReport = linkedReports[0];
  const reporter = primaryReport?.createdByUserId ? users.find((u) => u.id === primaryReport.createdByUserId) : undefined;
  const ageDays = getInvestigationAgeDays(investigation.openedAt);
  const sla = getSlaStatus(ageDays, investigation.priority);
  const persons = getInvestigationPersons(investigation, owner);
  const moduleProgress = getModuleProgress(investigation);
  const drawerUser = drawerUserId ? users.find((u) => u.id === drawerUserId) ?? null : null;

  const workflowCtx: WorkflowContext = {
    investigation,
    dataStore,
    users,
    primaryReport,
    reporter,
    owner,
    onNavigate,
    onTabChange: (tab) => onTabChange(tab as InvestigationTab),
    openProfile: setDrawerUserId,
    EmployeeLink,
  };

  const addPerson = (userId: string, role: InvestigationPersonRole) => {
    const next: InvestigationPerson[] = [
      ...persons.filter((p) => !(p.userId === userId && p.role === role)),
      { id: `person-${Date.now()}`, role, userId, addedAt: new Date(), addedByUserId: dataStore.currentUser.id },
    ];
    setInvestigationPersons(investigation.id, next);
  };

  const filteredPersons = persons.filter((p) => {
    if (personRoleFilter !== 'ALL' && p.role !== personRoleFilter) return false;
    const q = personSearch.trim().toLowerCase();
    if (!q) return true;
    const u = p.userId ? users.find((x) => x.id === p.userId) : null;
    return `${u?.firstName ?? ''} ${u?.lastName ?? ''} ${p.externalName ?? ''}`.toLowerCase().includes(q);
  });

  const filteredLinkedReports = linkedReports.filter((r) => {
    const q = reportSearch.trim().toLowerCase();
    if (!q) return true;
    const emp = r.createdByUserId ? users.find((u) => u.id === r.createdByUserId) : null;
    return r.summary.toLowerCase().includes(q) || r.id.includes(q) || Boolean(emp && `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q));
  });

  const workflowSteps: { id: InvestigationTab; label: string; percent: number }[] = INVESTIGATION_TABS.filter((t) => t.step).map((t) => ({
    id: t.id,
    label: t.label,
    percent: moduleProgress[t.id]?.percent ?? 0,
  }));

  const renderOverview = () => (
    <div className="space-y-4">
      <Card className="mismo-card border border-[var(--color-border-200)]">
        <CardContent className="p-5">
          <h2 className="text-lg font-semibold text-[var(--color-primary-900)]">Investigation command center</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-2">{getNextStageAction(stage)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(stage === 'PENDING_REVIEW' || stage === 'ASSIGNED') && !investigation.pickedUpAt ? (
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                <Select value={pickupContact} onValueChange={(v) => setPickupContact(v as InvestigationEmployeeContactPreference)}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Contact method" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN_APP_MESSAGE">Direct message</SelectItem>
                    <SelectItem value="PHONE_CALL">Phone call</SelectItem>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="IN_PERSON">In person</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => pickUpInvestigation(investigation.id, pickupContact)} className="bg-[var(--color-primary-900)]">
                  Open case
                </Button>
              </div>
            ) : null}
            {stage !== 'CLOSED' && stage !== 'OUTCOME_PENDING' && investigation.pickedUpAt ? (
              <Button variant="outline" onClick={() => {
                const idx = INVESTIGATION_STAGES.indexOf(stage);
                advanceInvestigationStage(investigation.id, INVESTIGATION_STAGES[Math.min(idx + 1, INVESTIGATION_STAGES.length - 1)]);
              }}>
                Advance workflow stage
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => onTabChange('intake-triage')}>Start intake &amp; triage</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {workflowSteps.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => onTabChange(step.id)}
            className="text-left border border-[var(--color-border-200)] p-4 hover:border-[var(--color-primary-900)] hover:bg-white transition-colors"
          >
            <p className="text-xs uppercase text-[var(--color-text-muted)]">Step {INVESTIGATION_TABS.find((t) => t.id === step.id)?.step}</p>
            <p className="font-medium text-sm mt-1">{step.label}</p>
            <div className="mt-2 h-1.5 bg-[var(--color-surface-200)]">
              <div className="h-full bg-[var(--color-primary-900)]" style={{ width: `${step.percent}%` }} />
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">{step.percent}% complete</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="mismo-card border border-[var(--color-border-200)]">
          <CardContent className="p-4">
            <p className="text-xs uppercase text-[var(--color-text-muted)]">Persons involved</p>
            <p className="text-2xl font-bold mt-1">{persons.length}</p>
            <Button size="sm" variant="link" className="px-0 mt-2" onClick={() => onTabChange('persons')}>Manage</Button>
          </CardContent>
        </Card>
        <Card className="mismo-card border border-[var(--color-border-200)]">
          <CardContent className="p-4">
            <p className="text-xs uppercase text-[var(--color-text-muted)]">Evidence files</p>
            <p className="text-2xl font-bold mt-1">{(investigation.evidenceRecords ?? []).length}</p>
            <Button size="sm" variant="link" className="px-0 mt-2" onClick={() => onTabChange('information-gathering')}>Collect</Button>
          </CardContent>
        </Card>
        <Card className="mismo-card border border-[var(--color-border-200)]">
          <CardContent className="p-4">
            <p className="text-xs uppercase text-[var(--color-text-muted)]">Linked reports</p>
            <p className="text-2xl font-bold mt-1">{linkedReports.length}</p>
            <Button size="sm" variant="link" className="px-0 mt-2" onClick={() => onTabChange('linked-reports')}>View</Button>
          </CardContent>
        </Card>
      </div>

      <AIGuidancePanel
        items={[
          'Recommended next workflow step based on case stage.',
          'Missing documentation and compliance risk flags.',
          'Interview question suggestions and timeline summary.',
        ]}
      />
    </div>
  );

  const renderPersons = () => (
    <Card className="mismo-card border border-[var(--color-border-200)]">
      <CardContent className="p-5 space-y-4">
        <h2 className="text-lg font-semibold">Persons involved</h2>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Search by name…" value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} className="max-w-xs" />
          <Select value={personRoleFilter} onValueChange={(v) => setPersonRoleFilter(v as InvestigationPersonRole | 'ALL')}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All roles</SelectItem>
              {(Object.keys(PERSON_ROLE_LABELS) as InvestigationPersonRole[]).map((r) => (
                <SelectItem key={r} value={r}>{PERSON_ROLE_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto border border-[var(--color-border-200)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-200)]">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Added</th>
                <th className="px-3 py-2 text-right">Profile</th>
              </tr>
            </thead>
            <tbody>
              {filteredPersons.map((p) => {
                const u = p.userId ? users.find((x) => x.id === p.userId) : undefined;
                return (
                  <tr key={p.id} className="border-t border-[var(--color-border-200)]">
                    <td className="px-3 py-2">
                      {u ? <EmployeeLink user={u} onClick={() => openProfile(u.id)} /> : p.externalName ?? '—'}
                    </td>
                    <td className="px-3 py-2">{PERSON_ROLE_LABELS[p.role]}</td>
                    <td className="px-3 py-2">{formatDate(p.addedAt)}</td>
                    <td className="px-3 py-2 text-right">
                      {u ? <Button size="sm" variant="outline" onClick={() => setDrawerUserId(u.id)}>Quick view</Button> : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[var(--color-border-200)] pt-4">
          <p className="text-sm font-medium mb-2">Add employee to case</p>
          <div className="flex flex-wrap gap-2">
            {users.filter((u) => u.role === 'EMPLOYEE').slice(0, 8).map((emp) => (
              <Select key={emp.id} onValueChange={(role) => addPerson(emp.id, role as InvestigationPersonRole)}>
                <SelectTrigger className="w-auto min-w-[160px]"><SelectValue placeholder={`+ ${emp.firstName} ${emp.lastName}`} /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PERSON_ROLE_LABELS) as InvestigationPersonRole[]).map((r) => (
                    <SelectItem key={r} value={r}>{PERSON_ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderLinkedReports = () => (
    <Card className="mismo-card border border-[var(--color-border-200)]">
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap gap-2 justify-between">
          <h2 className="text-lg font-semibold">Linked reports</h2>
          <Input placeholder="Search reports…" value={reportSearch} onChange={(e) => setReportSearch(e.target.value)} className="max-w-xs" />
        </div>
        <div className="overflow-x-auto border border-[var(--color-border-200)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-200)]">
              <tr>
                <th className="px-3 py-2 text-left">Report ID</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLinkedReports.map((r) => (
                <tr key={r.id} className="border-t border-[var(--color-border-200)] hover:bg-[var(--color-surface-100)]">
                  <td className="px-3 py-2 font-medium">{formatReportReference(r.id)}</td>
                  <td className="px-3 py-2">{getCategoryLabel(r.category)}</td>
                  <td className="px-3 py-2">{REPORT_SOURCE_LABELS[r.reportSourceType ?? 'SELF_REPORTED']}</td>
                  <td className="px-3 py-2"><Badge className={getStatusColor(r.status)}>{r.status}</Badge></td>
                  <td className="px-3 py-2">{formatDate(r.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => onNavigate('report-detail', { id: r.id, fromInvestigation: investigation.id })}>Open</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  const openProfile = (userId: string) => setDrawerUserId(userId);

  const sectionMap: Record<InvestigationTab, () => ReactNode> = {
    overview: renderOverview,
    'intake-triage': () => <IntakeTriageModule {...workflowCtx} />,
    'information-gathering': () => <InformationGatheringModule {...workflowCtx} />,
    'interviews-notes': () => <InterviewsNotesModule {...workflowCtx} />,
    'evidence-analysis': () => <EvidenceAnalysisModule {...workflowCtx} />,
    'findings-outcome': () => <FindingsOutcomeModule {...workflowCtx} />,
    'resolution-actions': () => <ResolutionActionsModule {...workflowCtx} />,
    'follow-up-monitoring': () => <FollowUpMonitoringModule {...workflowCtx} />,
    'closure-audit': () => <ClosureAuditModule {...workflowCtx} />,
    persons: renderPersons,
    'linked-reports': renderLinkedReports,
  };

  return (
    <div className="space-y-0">
      <nav className="mb-4 text-sm text-[var(--color-text-secondary)] flex flex-wrap items-center gap-1">
        <button type="button" className="hover:text-[var(--mismo-blue)]" onClick={() => onNavigate('investigations')}>Investigations</button>
        <Icons.chevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-[var(--color-text-primary)]">{getInvestigationDisplayId(investigation)}</span>
        {reporter && (
          <>
            <Icons.chevronRight className="h-3.5 w-3.5" />
            <EmployeeLink user={reporter} onClick={() => openProfile(reporter.id)} />
          </>
        )}
      </nav>

      <Card className="mismo-card border border-[var(--color-border-200)] mb-4">
        <CardContent className="p-5">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Investigation case file</p>
              <h1 className="text-2xl font-bold text-[var(--color-primary-900)] mt-1">{getInvestigationDisplayId(investigation)}</h1>
              <p className="text-base text-[var(--color-text-secondary)] mt-1">{getInvestigationTypeLabel(investigation)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="status-chip status-chip--warn">{INVESTIGATION_STAGE_LABELS[stage]}</Badge>
              <Badge variant="outline">{investigation.priority ?? investigation.severity ?? 'MEDIUM'} priority</Badge>
              <Badge variant="outline" className={sla.tone === 'over' ? 'border-red-400 text-red-700' : ''}>{sla.label} · {ageDays}d aging</Badge>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-sm">
            <div><p className="text-xs text-[var(--color-text-muted)]">Lead investigator</p><p className="font-medium">{owner ? `${owner.firstName} ${owner.lastName}` : 'Unassigned'}</p></div>
            <div><p className="text-xs text-[var(--color-text-muted)]">Opened</p><p>{formatDate(investigation.openedAt)}</p></div>
            <div><p className="text-xs text-[var(--color-text-muted)]">Source</p><p>{REPORT_SOURCE_LABELS[investigation.reportSourceType ?? 'SELF_REPORTED']}</p></div>
            <div><p className="text-xs text-[var(--color-text-muted)]">Linked incident</p><p>{primaryReport ? formatReportReference(primaryReport.id) : '—'}</p></div>
            <div><p className="text-xs text-[var(--color-text-muted)]">Preferred contact</p><p>{investigation.employeePreferredContact ? CONTACT_METHOD_LABELS[investigation.employeePreferredContact] : '—'}</p></div>
            <div><p className="text-xs text-[var(--color-text-muted)]">Risk</p><p>{investigation.riskLevel ?? '—'}</p></div>
          </div>
          <div className="mt-5 overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {INVESTIGATION_STAGES.map((s, i) => {
                const currentIdx = INVESTIGATION_STAGES.indexOf(stage);
                const done = i < currentIdx;
                const active = s === stage;
                return (
                  <div key={s} className={`px-2 py-1 text-[10px] sm:text-xs border ${active ? 'bg-[var(--color-primary-900)] text-white border-[var(--color-primary-900)]' : done ? 'bg-[var(--mismo-green-light)] text-emerald-800 border-emerald-200' : 'bg-[var(--color-surface-100)] text-[var(--color-text-muted)] border-[var(--color-border-200)]'}`}>
                    {INVESTIGATION_STAGE_LABELS[s]}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-2">{getStageProgressPercent(investigation)}% workflow complete</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col lg:flex-row gap-6">
        <nav className="lg:w-56 shrink-0 lg:sticky lg:top-20 lg:self-start border border-[var(--color-border-200)] bg-[var(--color-surface-100)] p-2 h-fit max-h-[calc(100vh-6rem)] overflow-y-auto">
          <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)] px-2 py-1">Investigation workflow</p>
          {INVESTIGATION_TABS.map((t) => {
            const prog = moduleProgress[t.id];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                className={`w-full text-left px-3 py-2 text-sm rounded-none border-l-2 mb-0.5 ${activeTab === t.id ? 'border-[var(--color-primary-900)] bg-white font-medium text-[var(--color-primary-900)]' : 'border-transparent text-[var(--color-text-secondary)] hover:bg-white/80'}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span>{t.step ? `${t.step}. ` : ''}{t.label}</span>
                  {prog && prog.percent > 0 && <span className="text-[10px] text-[var(--color-text-muted)]">{prog.percent}%</span>}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="flex-1 min-w-0 pb-8">{sectionMap[activeTab]()}</div>
      </div>

      <InvestigationPersonDrawer open={Boolean(drawerUserId)} onOpenChange={(o) => !o && setDrawerUserId(null)} user={drawerUser} dataStore={dataStore} onNavigate={onNavigate} />
    </div>
  );
}
