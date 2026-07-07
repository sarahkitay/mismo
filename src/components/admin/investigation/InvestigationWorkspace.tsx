import { useMemo, useState, type ReactNode } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { InvestigationPerson, InvestigationPersonRole, User } from '@/types';
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
 getEffectiveStage,
 getInvestigationAgeDays,
 getInvestigationDisplayId,
 getInvestigationPersons,
 getInvestigationTypeLabel,
 getModuleProgress,
 getSlaStatus,
 INVESTIGATION_STAGE_LABELS,
 INVESTIGATION_PAGES,
 PERSON_ROLE_LABELS,
 REPORT_SOURCE_LABELS,
 type InvestigationTab,
} from '@/lib/investigationWorkflow';
import { formatCaseReference } from '@/lib/caseTypes';
import { RelatedRecordsNav } from '@/components/admin/RelatedRecordsNav';
import { relatedNavForInvestigation } from '@/lib/recordLinks';
import { toast } from 'sonner';
import { InvestigationPersonDrawer } from '@/components/admin/investigation/InvestigationPersonDrawer';
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
 if (!user) return <span className="text-[var(--color-text-muted)]"> - </span>;
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
 const { users, reports, setInvestigationPersons } = dataStore;

 const [personSearch, setPersonSearch] = useState('');
 const [personRoleFilter, setPersonRoleFilter] = useState<InvestigationPersonRole | 'ALL'>('ALL');
 const [reportSearch, setReportSearch] = useState('');
 const [drawerUserId, setDrawerUserId] = useState<string | null>(null);
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

 const pageProgress = INVESTIGATION_PAGES.map((p) => ({
 ...p,
 percent: moduleProgress[p.id]?.percent ?? 0,
 complete: investigation.workflowPagesCompleted?.[p.id === 'page-1' ? 'intake' : p.id === 'page-2' ? 'gathering' : 'outcome'],
 }));

 const unifiedCaseId = investigation.referenceNumber ?? (primaryReport ? formatCaseReference(primaryReport) : getInvestigationDisplayId(investigation));

 const openProfile = (userId: string) => setDrawerUserId(userId);

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
 {u ? <EmployeeLink user={u} onClick={() => openProfile(u.id)} /> : p.externalName ?? '-'}
 </td>
 <td className="px-3 py-2">{PERSON_ROLE_LABELS[p.role]}</td>
 <td className="px-3 py-2">{formatDate(p.addedAt)}</td>
 <td className="px-3 py-2 text-right">
 {u ? <Button size="sm" variant="outline" onClick={() => setDrawerUserId(u.id)}>Quick view</Button> : '-'}
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
 <th className="px-3 py-2 text-left">Check-in</th>
 <th className="px-3 py-2 text-left">Status</th>
 <th className="px-3 py-2 text-left">Created</th>
 <th className="px-3 py-2 text-right">Action</th>
 </tr>
 </thead>
 <tbody>
 {filteredLinkedReports.map((r) => {
 const sourceResponse = r.sourcePromptResponseId
 ? dataStore.responses.find((x) => x.id === r.sourcePromptResponseId)
 : undefined;
 return (
 <tr
 key={r.id}
 className="border-t border-[var(--color-border-200)] hover:bg-[var(--color-surface-100)] cursor-pointer"
 onClick={() => onNavigate('report-detail', { id: r.id, fromInvestigation: investigation.id })}
 >
 <td className="px-3 py-2 font-medium font-mono">{formatCaseReference(r)}</td>
 <td className="px-3 py-2">{getCategoryLabel(r.category)}</td>
 <td className="px-3 py-2">{REPORT_SOURCE_LABELS[r.reportSourceType ?? 'SELF_REPORTED']}</td>
 <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
 {sourceResponse ? (
 <button
 type="button"
 className="text-[var(--mismo-blue)] hover:underline text-xs"
 onClick={() => onNavigate('prompt-response-detail', { id: sourceResponse.id, type: sourceResponse.answer })}
 >
 {sourceResponse.answer === 'HAS_ISSUE' ? 'Yes' : 'No'}
 </button>
 ) : (
 '-'
 )}
 </td>
 <td className="px-3 py-2"><Badge className={getStatusColor(r.status)}>{r.status}</Badge></td>
 <td className="px-3 py-2">{formatDate(r.createdAt)}</td>
 <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
 <Button size="sm" variant="outline" onClick={() => onNavigate('report-detail', { id: r.id, fromInvestigation: investigation.id })}>Open</Button>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </CardContent>
 </Card>
 );

 const renderPage1 = () => (
 <div className="space-y-4">
 <IntakeTriageModule {...workflowCtx} />
 {renderLinkedReports()}
 </div>
 );

 const renderPage2 = () => (
 <div className="space-y-4">
 {renderPersons()}
 <InformationGatheringModule {...workflowCtx} />
 <InterviewsNotesModule {...workflowCtx} />
 <EvidenceAnalysisModule {...workflowCtx} />
 </div>
 );

 const renderPage3 = () => (
 <div className="space-y-4">
 <FindingsOutcomeModule {...workflowCtx} />
 <ResolutionActionsModule {...workflowCtx} />
 <FollowUpMonitoringModule {...workflowCtx} />
 <ClosureAuditModule {...workflowCtx} />
 </div>
 );

 const sectionMap: Record<InvestigationTab, () => ReactNode> = {
 'page-1': renderPage1,
 'page-2': renderPage2,
 'page-3': renderPage3,
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
 <button
 type="button"
 className="font-medium text-[var(--mismo-blue)] hover:underline"
 onClick={() => onNavigate('employee-detail', { id: reporter.id })}
 >
 {reporter.firstName} {reporter.lastName}
 </button>
 </>
 )}
 </nav>

 <RelatedRecordsNav links={relatedNavForInvestigation(dataStore, investigation)} onNavigate={onNavigate} compact />

 <Card className="mismo-card border border-[var(--color-border-200)] mb-4">
 <CardContent className="p-5">
 <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
 <div>
 <p className="text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Case file ID (report &amp; investigation)</p>
 <h1 className="text-2xl font-bold text-[var(--color-primary-900)] mt-1 font-mono">{unifiedCaseId}</h1>
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
 <div><p className="text-xs text-[var(--color-text-muted)]">Reported from</p><p>{REPORT_SOURCE_LABELS[investigation.reportSourceType ?? primaryReport?.reportSourceType ?? 'SELF_REPORTED']}</p></div>
 <div><p className="text-xs text-[var(--color-text-muted)]">EI form</p><p>{primaryReport ? (primaryReport.incidentIntakeCompletedAt || primaryReport.wageHourIntakeCompletedAt ? 'Complete' : 'Pending') : '-'}</p></div>
 <div><p className="text-xs text-[var(--color-text-muted)]">Preferred contact</p><p>{investigation.employeePreferredContact ? CONTACT_METHOD_LABELS[investigation.employeePreferredContact] : '-'}</p></div>
 <div><p className="text-xs text-[var(--color-text-muted)]">Risk</p><p>{investigation.riskLevel ?? '-'}</p></div>
 </div>
 <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
 {pageProgress.map((p) => (
 <button
 key={p.id}
 type="button"
 onClick={() => onTabChange(p.id)}
 className={`text-left border p-3 transition-colors ${activeTab === p.id ? 'border-[var(--color-primary-900)] bg-blue-50' : 'border-[var(--color-border-200)] hover:border-[var(--color-primary-700)]'}`}
 >
 <p className="text-xs font-semibold text-[var(--color-text-muted)]">Page {p.step}</p>
 <p className="font-medium text-sm mt-0.5">{p.label}</p>
 <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 line-clamp-2">{p.description}</p>
 <div className="mt-2 h-1 bg-[var(--color-surface-200)]">
 <div className="h-full bg-[var(--color-primary-900)]" style={{ width: `${p.percent}%` }} />
 </div>
 </button>
 ))}
 </div>
 </CardContent>
 </Card>

 <div className="flex flex-col lg:flex-row gap-6">
 <nav className="lg:w-56 shrink-0 lg:sticky lg:top-20 lg:self-start border border-[var(--color-border-200)] bg-[var(--color-surface-100)] p-2 h-fit max-h-[calc(100vh-6rem)] overflow-y-auto">
 <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)] px-2 py-1">Investigation pages</p>
 {INVESTIGATION_PAGES.map((t) => {
 const prog = moduleProgress[t.id];
 const done =
 investigation.workflowPagesCompleted?.[t.id === 'page-1' ? 'intake' : t.id === 'page-2' ? 'gathering' : 'outcome'];
 return (
 <button
 key={t.id}
 type="button"
 onClick={() => onTabChange(t.id)}
 className={`w-full text-left px-3 py-2 text-sm rounded-none border-l-2 mb-0.5 ${activeTab === t.id ? 'border-[var(--color-primary-900)] bg-white font-medium text-[var(--color-primary-900)]' : 'border-transparent text-[var(--color-text-secondary)] hover:bg-white/80'}`}
 >
 <span className="flex items-center justify-between gap-2">
 <span>{t.step}. {t.label}</span>
 <span className="text-[10px] text-[var(--color-text-muted)]">{done ? 'Done' : `${prog?.percent ?? 0}%`}</span>
 </span>
 </button>
 );
 })}
        <div className="px-2 pt-3 pb-2 mt-2 border-t border-[var(--color-border-200)]">
          <Button
            size="sm"
            variant="outline"
            className="w-full h-auto min-h-9 whitespace-normal text-center leading-snug py-2.5 px-2"
            onClick={() => {
 const idx = INVESTIGATION_PAGES.findIndex((p) => p.id === activeTab);
 if (idx < INVESTIGATION_PAGES.length - 1) {
 const pageKey = activeTab === 'page-1' ? 'intake' : activeTab === 'page-2' ? 'gathering' : 'outcome';
 dataStore.markInvestigationPageComplete(investigation.id, pageKey);
 onTabChange(INVESTIGATION_PAGES[idx + 1].id);
 toast.success(`Page ${INVESTIGATION_PAGES[idx].step} marked complete.`);
 }
 }}
 disabled={activeTab === 'page-3'}
 >
 Mark page complete &amp; continue
 </Button>
 </div>
 </nav>
 <div className="flex-1 min-w-0 pb-8">{sectionMap[activeTab]()}</div>
 </div>

 <InvestigationPersonDrawer open={Boolean(drawerUserId)} onOpenChange={(o) => !o && setDrawerUserId(null)} user={drawerUser} dataStore={dataStore} onNavigate={onNavigate} />
 </div>
 );
}
