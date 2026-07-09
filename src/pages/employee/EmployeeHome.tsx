import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { employeeIncidentReportHeadline, formatRelativeTime, getStatusColor, isEmployeeReportIntakeComplete } from '@/lib/utils';
import { DailyCheckInGate, useDailyCheckInViewState } from '@/components/DailyCheckInGate';
import { ReportConcernSection } from '@/components/employee/ReportConcernSection';

interface EmployeeHomeProps {
 dataStore: DataStore;
 onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function EmployeeHome({ dataStore, onNavigate }: EmployeeHomeProps) {
 const { currentUser, pendingPromptsForEmployee, employeeReports, policies, policyAcknowledgements } = dataStore;
 const { showCheckInGate } = useDailyCheckInViewState(dataStore);

 const unreadPolicies = policies.filter(
 (p) =>
 p.status === 'PUBLISHED' &&
 p.acknowledgmentRequired &&
 !policyAcknowledgements.some((a) => a.policyId === p.id && a.userId === currentUser.id)
 );

 const isFullyCaughtUp = pendingPromptsForEmployee.length === 0 && unreadPolicies.length === 0;
 const showRelaxedDashboard = !showCheckInGate && pendingPromptsForEmployee.length === 0;
 const pendingIntakes = employeeReports.filter((r) => !isEmployeeReportIntakeComplete(r));

 return (
 <div className="space-y-6 relative z-[1]">
 <DailyCheckInGate dataStore={dataStore} onNavigate={onNavigate} portal="employee" />

 {!showCheckInGate && showRelaxedDashboard && (
 <>
 <Card className="mismo-card border border-[var(--color-emerald-600)]/35 bg-gradient-to-br from-[var(--mismo-green-light)]/40 to-[var(--color-surface-100)] shadow-[var(--shadow-1)] dashboard-header">
 <CardContent className="p-8 md:p-10">
 <div className="flex flex-col md:flex-row md:items-start gap-6 md:gap-8">
 <div className="flex justify-center md:justify-start">
 <div className="w-16 h-16 rounded-full bg-[var(--mismo-green-light)] flex items-center justify-center ring-4 ring-[var(--color-emerald-600)]/15">
 <Icons.checkCircle className="h-9 w-9 text-[var(--color-emerald-600)]" />
 </div>
 </div>
 <div className="flex-1 text-center md:text-left min-w-0">
 <p className="text-xs tracking-[0.1em] uppercase text-[var(--color-text-secondary)]">Your dashboard</p>
 <h1 className="mismo-heading text-2xl md:text-3xl mt-1 text-[var(--color-primary-900)]">
 {isFullyCaughtUp ? (
 <>You&apos;re all caught up, {currentUser.firstName}</>
 ) : (
 <>Nice work, {currentUser.firstName}</>
 )}
 </h1>
 {isFullyCaughtUp ? (
 <p className="text-base text-[var(--color-text-secondary)] mt-3 leading-relaxed max-w-2xl mx-auto md:mx-0">
 Your check-ins are done and your memo sign-offs are up to date. That kind of follow-through keeps everyone safer
 and makes compliance feel a little lighter. Take a moment to feel good about being on top of it.
 </p>
 ) : pendingPromptsForEmployee.length > 0 ? (
 <p className="text-base text-[var(--color-text-secondary)] mt-3 leading-relaxed max-w-2xl mx-auto md:mx-0">
 Complete today&apos;s check-in above to unlock your dashboard. My Reports, Resources, and Settings stay available in the sidebar.
 </p>
 ) : (
 <p className="text-base text-[var(--color-text-secondary)] mt-3 leading-relaxed max-w-2xl mx-auto md:mx-0">
 Your check-ins are complete. When you have a minute, finish signing the company memos below in your library so
 everything stays on record. You&apos;re almost there.
 </p>
 )}
 <ul className="mt-4 text-sm text-[var(--color-text-secondary)] space-y-1.5 max-w-2xl mx-auto md:mx-0 list-none">
 <li className="flex items-center gap-2 justify-center md:justify-start">
 <Icons.checkCircle className="h-4 w-4 text-[var(--color-emerald-600)] shrink-0" />
 <span>No check-ins waiting on you right now</span>
 </li>
 <li className="flex items-center gap-2 justify-center md:justify-start">
 {isFullyCaughtUp ? (
 <>
 <Icons.checkCircle className="h-4 w-4 text-[var(--color-emerald-600)] shrink-0" />
 <span>Memos that need your signature are cleared</span>
 </>
 ) : (
 <>
 <Icons.bookOpen className="h-4 w-4 text-[var(--mismo-blue)] shrink-0" />
 <span>
 {unreadPolicies.length} memo{unreadPolicies.length === 1 ? '' : 's'} waiting in your library
 </span>
 </>
 )}
 </li>
 </ul>
 <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center md:justify-start flex-wrap">
 <Button variant="outline" className="h-12 enterprise-interactive" onClick={() => onNavigate('resources')}>
 <Icons.bookOpen className="h-4 w-4 mr-2" />
 Open library
 </Button>
 <Button variant="outline" className="h-12 enterprise-interactive" onClick={() => onNavigate('reports')}>
 <Icons.reports className="h-4 w-4 mr-2" />
 My incident reports
 </Button>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>

 {!isFullyCaughtUp && unreadPolicies.length > 0 && (
 <Card className="mismo-card border border-[var(--color-border-200)]">
 <CardContent className="p-5">
 <h2 className="text-lg font-semibold text-[var(--mismo-text)]">Company memos needing your acknowledgement</h2>
 <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">
 Open your library to read and sign. Your dashboard will feel even lighter when these are done.
 </p>
 <div className="mt-3 space-y-2">
 {unreadPolicies.slice(0, 5).map((policy) => (
 <Card
 key={policy.id}
 className="mismo-card border border-[var(--color-border-200)] cursor-pointer hover:border-[var(--mismo-blue)] transition-colors"
 onClick={() => onNavigate('resources')}
 role="button"
 tabIndex={0}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 onNavigate('resources');
 }
 }}
 >
 <CardContent className="p-3 flex items-center gap-2">
 <Icons.bookOpen className="h-4 w-4 text-[var(--mismo-blue)] shrink-0" />
 <span className="flex-1 text-left text-sm font-medium">{policy.title}</span>
 <span className="text-xs text-[var(--mismo-amber)]">Action needed</span>
 </CardContent>
 </Card>
 ))}
 </div>
 </CardContent>
 </Card>
 )}

 <div>
 <h2 className="text-lg font-semibold text-[var(--mismo-text)] mb-1">Quick links</h2>
 <p className="text-sm text-[var(--mismo-text-secondary)] mb-3">
 Jump back to something useful so this page never feels empty.
 </p>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 <Card
 className="mismo-card mismo-card-hover cursor-pointer border border-[var(--color-border-200)]"
 onClick={() => onNavigate('resources')}
 >
 <CardContent className="p-5">
 <div className="w-10 h-10 rounded-lg bg-[var(--mismo-blue-light)] flex items-center justify-center mb-3">
 <Icons.resources className="h-5 w-5 text-[var(--mismo-blue)]" />
 </div>
 <h3 className="font-semibold text-[var(--mismo-text)]">Company library</h3>
 <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">Published memos, handbooks, and resources</p>
 </CardContent>
 </Card>
 <Card
 className="mismo-card mismo-card-hover cursor-pointer border border-[var(--color-border-200)]"
 onClick={() => onNavigate('reports')}
 >
 <CardContent className="p-5">
 <div className="w-10 h-10 rounded-lg bg-[var(--mismo-blue-light)] flex items-center justify-center mb-3">
 <Icons.reports className="h-5 w-5 text-[var(--mismo-blue)]" />
 </div>
 <h3 className="font-semibold text-[var(--mismo-text)]">My incident reports</h3>
 <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">Track what you&apos;ve submitted</p>
 </CardContent>
 </Card>
 <Card
 className="mismo-card mismo-card-hover cursor-pointer border border-[var(--color-border-200)]"
 onClick={() => onNavigate('settings')}
 >
 <CardContent className="p-5">
 <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-200)] flex items-center justify-center mb-3">
 <Icons.settings className="h-5 w-5 text-[var(--mismo-text-secondary)]" />
 </div>
 <h3 className="font-semibold text-[var(--mismo-text)]">Settings</h3>
 <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">Profile and notifications</p>
 </CardContent>
 </Card>
 <Card
 className="mismo-card mismo-card-hover cursor-pointer border border-[var(--color-border-200)]"
 onClick={() => onNavigate('help')}
 >
 <CardContent className="p-5">
 <div className="w-10 h-10 rounded-lg bg-[var(--mismo-green-light)] flex items-center justify-center mb-3">
 <Icons.help className="h-5 w-5 text-[var(--mismo-green)]" />
 </div>
 <h3 className="font-semibold text-[var(--mismo-text)]">Help &amp; support</h3>
 <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">How Mismo works for you</p>
 </CardContent>
 </Card>
 </div>
 </div>

 <div className="reports-section">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-semibold text-[var(--mismo-text)]">Recent incident reports</h2>
 {employeeReports.length > 0 && (
 <button type="button" onClick={() => onNavigate('reports')} className="text-sm text-[var(--mismo-blue)] hover:underline">
 View all
 </button>
 )}
 </div>
 <Card className="mismo-card border border-[var(--color-border-200)]">
 <CardContent className="p-0">
 {employeeReports.length > 0 ? (
 <div className="divide-y divide-gray-100">
 {employeeReports.slice(0, 3).map((report) => (
 <div
 key={report.id}
 className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer"
 onClick={() => onNavigate(`report-detail/${report.id}`)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 onNavigate(`report-detail/${report.id}`);
 }
 }}
 role="button"
 tabIndex={0}
 >
 <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-[var(--mismo-blue)]" />
 <div className="flex-1 min-w-0">
 <p className="font-medium text-[var(--mismo-text)] truncate">{employeeIncidentReportHeadline(report)}</p>
 <p className="text-sm text-[var(--mismo-text-secondary)]">
 Submitted {formatRelativeTime(report.createdAt)} · Updated {formatRelativeTime(report.updatedAt)}
 </p>
 </div>
 <span className={`text-xs font-medium ${getStatusColor(report.status)}`}>{report.status}</span>
 <Icons.chevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
 </div>
 ))}
 </div>
 ) : (
 <div className="p-8 text-center">
 <Icons.inbox className="h-12 w-12 text-gray-300 mx-auto mb-3" />
 <p className="text-[var(--mismo-text-secondary)]">You haven&apos;t submitted any incident reports yet.</p>
 <p className="text-sm text-[var(--mismo-text-secondary)] mt-2">
 If something happens, you can use <span className="font-medium text-[var(--mismo-text)]">Report an incident</span> in the sidebar whenever you need to.
 </p>
 </div>
 )}
 </CardContent>
 </Card>
 </div>
 </>
 )}

 {pendingIntakes.length > 0 && (
 <Card
 className="mismo-card border-2 border-amber-400/60 bg-amber-50/90 cursor-pointer hover:border-amber-500 transition-colors touch-manipulation"
 role="button"
 tabIndex={0}
 onClick={() => {
 const first = pendingIntakes[0];
 onNavigate(first.caseType === 'WAGE_HOUR' ? `wage-hour-intake/${first.id}` : `incident-intake/${first.id}`);
 }}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 const first = pendingIntakes[0];
 onNavigate(first.caseType === 'WAGE_HOUR' ? `wage-hour-intake/${first.id}` : `incident-intake/${first.id}`);
 }
 }}
 >
 <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
 <div>
 <p className="font-semibold text-[var(--mismo-text)]">Action needed on your report</p>
 <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">
 {pendingIntakes.length === 1
 ? 'Complete your pending intake form to finish submitting your concern.'
 : `You have ${pendingIntakes.length} reports waiting on intake completion.`}
 </p>
 </div>
 <div className="flex flex-wrap gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
 {pendingIntakes.slice(0, 2).map((r) => {
 const label = employeeIncidentReportHeadline(r);
 const short = label.length > 28 ? `${label.slice(0, 28)}…` : label;
 return (
 <Button key={r.id} variant="default" className="bg-[var(--mismo-blue)] hover:bg-blue-600 min-h-[44px]" onClick={() => onNavigate(r.caseType === 'WAGE_HOUR' ? `wage-hour-intake/${r.id}` : `incident-intake/${r.id}`)}>
 Open form: {short}
 </Button>
 );
 })}
 {pendingIntakes.length > 2 && (
 <Button variant="outline" className="min-h-[44px]" onClick={() => onNavigate('reports')}>
 View all
 </Button>
 )}
 </div>
 </CardContent>
 </Card>
 )}

 <ReportConcernSection onNavigate={onNavigate} />
 </div>
 );
}
