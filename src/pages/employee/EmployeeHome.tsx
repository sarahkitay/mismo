import { useEffect, useRef, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { employeeIncidentReportHeadline, formatDate, formatRelativeTime, getStatusColor, isIncidentIntakeComplete } from '@/lib/utils';
import { toast } from 'sonner';

/** EQC-style mandatory incident query copy (shown for prompts with type INCIDENT). */
const EQC_INCIDENT_QUESTION =
  "Have you experienced or witnessed an incident or occurrence which you perceive to be a violation of your or your co-worker's employment rights that you have not reported prior to this question.";

const EQC_RETALIATION_NOTE =
  'You will not be retaliated against for reporting an actual or potential violation of your employment rights. Retaliation is against the law and will not be tolerated by this company.';

const EQC_CONFIRMATION_BODY =
  'We are prepared to fully investigate any and all acts and circumstances surrounding your response. However, if you selected "YES" by mistake, please go back to the prior screen and submit your intended response. If your intended response is "YES" please submit now.';

function formatEqcHeaderDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}.${dd}.${yyyy}`;
}

interface EmployeeHomeProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function EmployeeHome({ dataStore, onNavigate }: EmployeeHomeProps) {
  const {
    currentUser,
    pendingPromptsForEmployee,
    employeeReports,
    submitPromptResponse,
    policies,
    policyAcknowledgements,
    organizationName,
  } = dataStore;
  const unreadPolicies = policies.filter(
    (p) =>
      p.status === 'PUBLISHED' &&
      p.acknowledgmentRequired &&
      !policyAcknowledgements.some((a) => a.policyId === p.id && a.userId === currentUser.id)
  );
  const nowRef = useRef(new Date());
  const heroPrompt = pendingPromptsForEmployee[0];
  const showCheckInGate = Boolean(heroPrompt);
  const isIncidentGate = Boolean(heroPrompt?.prompt.type === 'INCIDENT');
  const [incidentStep, setIncidentStep] = useState<'question' | 'yes_confirm'>('question');
  useEffect(() => {
    setIncidentStep('question');
  }, [heroPrompt?.id]);

  const isFullyCaughtUp = pendingPromptsForEmployee.length === 0 && unreadPolicies.length === 0;
  const eqcHeaderDate = formatEqcHeaderDate(new Date());

  const handleNoIssues = (deliveryId: string) => {
    submitPromptResponse(deliveryId, 'NO_ISSUE');
    toast.success(
      isIncidentGate
        ? 'Your “No” response has been recorded. No further action is required for this check-in.'
        : 'Response recorded in compliance log.'
    );
  };

  /** Non–incident prompts: log issue and open optional detailed report flow. */
  const handleHaveIssueWithReport = (deliveryId: string, promptId: string) => {
    submitPromptResponse(deliveryId, 'HAS_ISSUE');
    toast.info(
      'HR is alerted on the admin dashboard and by email (simulated). You will receive a receipt with next steps and a link to your incident portal to complete documentation.',
      { duration: 7000 }
    );
    onNavigate('report-new', { promptId, deliveryId });
  };

  const handleIncidentYesContinue = () => {
    setIncidentStep('yes_confirm');
  };

  const handleIncidentYesSubmit = (deliveryId: string) => {
    submitPromptResponse(deliveryId, 'HAS_ISSUE');
    setIncidentStep('question');
    toast.success('Your “Yes” response has been recorded for today. You are not required to add details for this check-in.');
  };
  
  const pendingIntakes = employeeReports.filter((r) => !isIncidentIntakeComplete(r));
  const pendingCount = pendingPromptsForEmployee.length;
  const openReportsCount = employeeReports.filter(r => !['RESOLVED', 'CLOSED'].includes(r.status)).length;
  const recentUpdatesCount = employeeReports.filter(r => {
    const daysSinceUpdate = (nowRef.current.getTime() - r.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate < 7;
  }).length;
  
  return (
    <div className="space-y-6 relative z-[1]">
      {pendingIntakes.length > 0 && (
        <Card className="mismo-card border-2 border-amber-400/60 bg-amber-50/90">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-semibold text-[var(--mismo-text)]">Incident form needed</p>
              <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">
                {pendingIntakes.length === 1
                  ? 'Complete your incident questionnaire from the link in your receipt email, or open it here.'
                  : `You have ${pendingIntakes.length} incident reports waiting on your incident questionnaire.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {pendingIntakes.slice(0, 2).map((r) => {
                const label = employeeIncidentReportHeadline(r);
                const short = label.length > 28 ? `${label.slice(0, 28)}…` : label;
                return (
                <Button key={r.id} variant="default" className="bg-[var(--mismo-blue)] hover:bg-blue-600" onClick={() => onNavigate(`incident-intake/${r.id}`)}>
                  Open form — {short}
                </Button>
                );
              })}
              {pendingIntakes.length > 2 && (
                <Button variant="outline" onClick={() => onNavigate('reports')}>
                  View all
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {showCheckInGate && (
        <Card className="mismo-card border-2 border-[var(--color-primary-700)] shadow-[var(--shadow-2)]">
          <CardContent className="p-8 md:p-10">
            <div className="max-w-3xl">
              <p className="text-xs tracking-[0.08em] uppercase text-[var(--color-text-secondary)]">
                {isIncidentGate ? 'Check-in required before you continue' : 'Compliance Check-In Required'}
              </p>

              {isIncidentGate ? (
                <>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-2 tabular-nums">
                    {eqcHeaderDate}
                    <span className="mx-2 text-[var(--color-border-200)]">·</span>
                    {organizationName}
                  </p>
                  <h2 className="mismo-heading text-2xl md:text-3xl mt-3 text-[var(--color-primary-900)]">Incident Query</h2>

                  {incidentStep === 'question' ? (
                    <>
                      <p className="text-base md:text-lg text-[var(--color-text-primary)] mt-5 leading-relaxed">{EQC_INCIDENT_QUESTION}</p>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-4 leading-relaxed border-l-2 border-[var(--color-primary-500)] pl-4">
                        <span className="font-medium text-[var(--color-text-primary)]">Note: </span>
                        {EQC_RETALIATION_NOTE}
                      </p>
                      {heroPrompt.dueAt && (
                        <p className="text-sm text-[var(--color-text-secondary)] mt-4 flex items-center gap-1.5">
                          <Icons.clock className="h-4 w-4 shrink-0" />
                          Due by {formatDate(heroPrompt.dueAt)}
                        </p>
                      )}
                      <p className="text-sm font-medium text-[var(--color-text-primary)] mt-6">
                        A response is required to continue using the application.
                      </p>
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Button
                          variant="outline"
                          className="h-14 text-base border-[var(--color-emerald-600)] text-[var(--color-emerald-600)] shadow-[var(--shadow-1)] enterprise-interactive"
                          onClick={() => handleNoIssues(heroPrompt.id)}
                        >
                          NO
                        </Button>
                        <Button
                          className="h-14 text-base bg-[var(--color-primary-900)] hover:bg-[var(--color-primary-700)] shadow-[var(--shadow-2)] enterprise-interactive"
                          onClick={handleIncidentYesContinue}
                        >
                          YES
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-base md:text-lg text-[var(--color-text-primary)] mt-5 leading-relaxed">{EQC_CONFIRMATION_BODY}</p>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-4 leading-relaxed border-l-2 border-[var(--color-primary-500)] pl-4">
                        <span className="font-medium text-[var(--color-text-primary)]">Note: </span>
                        {EQC_RETALIATION_NOTE}
                      </p>
                      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Button
                          variant="outline"
                          className="h-14 text-base enterprise-interactive"
                          onClick={() => setIncidentStep('question')}
                        >
                          Go back to previous screen
                        </Button>
                        <Button
                          className="h-14 text-base bg-[var(--color-primary-900)] hover:bg-[var(--color-primary-700)] shadow-[var(--shadow-2)] enterprise-interactive"
                          onClick={() => handleIncidentYesSubmit(heroPrompt.id)}
                        >
                          Submit
                        </Button>
                      </div>
                    </>
                  )}

                  <div className="mt-8 pt-6 border-t border-[var(--color-border-200)]">
                    <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                      To file a separate detailed report outside this check-in, you may still use Report an incident.
                    </p>
                    <Button
                      variant="outline"
                      className="border-[var(--mismo-blue)] text-[var(--mismo-blue)] hover:bg-[var(--mismo-blue-light)] enterprise-interactive"
                      onClick={() => onNavigate('report-new')}
                    >
                      <Icons.flag className="h-4 w-4 mr-2" />
                      Report an incident
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mismo-heading text-3xl md:text-4xl mt-2 text-[var(--color-primary-900)]">{heroPrompt.prompt.title}</h2>
                  <p className="text-base md:text-lg text-[var(--color-text-secondary)] mt-3 leading-relaxed">{heroPrompt.prompt.description}</p>
                  {heroPrompt.dueAt && (
                    <p className="text-sm text-[var(--color-text-secondary)] mt-3 flex items-center gap-1.5">
                      <Icons.clock className="h-4 w-4" />
                      Due by {formatDate(heroPrompt.dueAt)}
                    </p>
                  )}
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="h-14 text-base border-[var(--color-emerald-600)] text-[var(--color-emerald-600)] shadow-[var(--shadow-1)] enterprise-interactive"
                      onClick={() => handleNoIssues(heroPrompt.id)}
                    >
                      No issues to report
                    </Button>
                    <Button
                      className="h-14 text-base bg-[var(--color-primary-900)] hover:bg-[var(--color-primary-700)] shadow-[var(--shadow-2)] enterprise-interactive"
                      onClick={() => handleHaveIssueWithReport(heroPrompt.id, heroPrompt.prompt.id)}
                    >
                      I have an issue
                      <Icons.arrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                  <div className="mt-8 pt-6 border-t border-[var(--color-border-200)]">
                    <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                      Something else happened outside this check-in? You can inform your company at any time.
                    </p>
                    <Button
                      variant="outline"
                      className="border-[var(--mismo-blue)] text-[var(--mismo-blue)] hover:bg-[var(--mismo-blue-light)] enterprise-interactive"
                      onClick={() => onNavigate('report-new')}
                    >
                      <Icons.flag className="h-4 w-4 mr-2" />
                      Report an incident
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!showCheckInGate && (
        <>
          {isFullyCaughtUp ? (
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
                      <p className="text-xs tracking-[0.1em] uppercase text-[var(--color-text-secondary)]">Dashboard</p>
                      <h1 className="mismo-heading text-2xl md:text-3xl mt-1 text-[var(--color-primary-900)]">
                        You&apos;re all caught up, {currentUser.firstName}
                      </h1>
                      <p className="text-base text-[var(--color-text-secondary)] mt-3 leading-relaxed max-w-2xl mx-auto md:mx-0">
                        Your check-ins are complete and no company memos need your acknowledgement right now. That helps keep everyone
                        safer—thank you for staying on top of it.
                      </p>
                      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center md:justify-start flex-wrap">
                        <Button
                          className="h-12 bg-[var(--mismo-blue)] hover:bg-blue-600 shadow-[var(--shadow-1)] enterprise-interactive"
                          onClick={() => onNavigate('report-new')}
                        >
                          <Icons.flag className="h-4 w-4 mr-2" />
                          Report an incident
                        </Button>
                        <Button variant="outline" className="h-12 enterprise-interactive" onClick={() => onNavigate('resources')}>
                          <Icons.bookOpen className="h-4 w-4 mr-2" />
                          Open library
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div>
                <h2 className="text-lg font-semibold text-[var(--mismo-text)] mb-3">Shortcuts</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                              <p className="text-sm text-[var(--mismo-text-secondary)]">Submitted {formatRelativeTime(report.createdAt)}</p>
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
                          If something happens, use <span className="font-medium text-[var(--mismo-text)]">Report an incident</span> above—
                          your team is notified right away.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <>
              <div className="header-block">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-[var(--mismo-text)]">Employee Compliance Workspace</h1>
                    <p className="text-[var(--mismo-text-secondary)] mt-1">
                      {currentUser.firstName}, no check-ins are due right now. Finish the items below when you can.
                    </p>
                  </div>
                  <Button
                    className="shrink-0 bg-[var(--mismo-blue)] hover:bg-blue-600 enterprise-interactive"
                    onClick={() => onNavigate('report-new')}
                  >
                    <Icons.flag className="h-4 w-4 mr-2" />
                    Report an incident
                  </Button>
                </div>
              </div>

              {unreadPolicies.length > 0 && (
                <Card className="mismo-card border border-[var(--color-border-200)]">
                  <CardContent className="p-5">
            <h2 className="text-lg font-semibold text-[var(--mismo-text)]">Company memos needing your acknowledgement</h2>
            <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">Review and sign off in your library when you&apos;re ready.</p>
                    <div className="mt-3 space-y-2">
                      {unreadPolicies.slice(0, 3).map((policy) => (
                        <Button
                          key={policy.id}
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => onNavigate('resources')}
                        >
                          <Icons.bookOpen className="h-4 w-4 mr-2" />
                          {policy.title}
                          <span className="ml-2 text-xs text-[var(--mismo-amber)]">Action needed</span>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="stat-tile mismo-card tile-border-blue border border-[var(--color-border-200)]">
                  <CardContent className="p-5">
                    <div>
                      <p className="text-sm text-[var(--mismo-text-secondary)]">Pending check-ins</p>
                      <p className="text-3xl font-bold text-[var(--mismo-text)] mt-1">{pendingCount}</p>
                    </div>
                    <button type="button" onClick={() => onNavigate('home')} className="text-sm text-[var(--mismo-blue)] mt-3 hover:underline">
                      Dashboard
                    </button>
                  </CardContent>
                </Card>
                <Card className="stat-tile mismo-card tile-border-amber border border-[var(--color-border-200)]">
                  <CardContent className="p-5">
                    <div>
                      <p className="text-sm text-[var(--mismo-text-secondary)]">Open incident reports</p>
                      <p className="text-3xl font-bold text-[var(--mismo-text)] mt-1">{openReportsCount}</p>
                    </div>
                    <button type="button" onClick={() => onNavigate('reports')} className="text-sm text-[var(--mismo-blue)] mt-3 hover:underline">
                      View all
                    </button>
                  </CardContent>
                </Card>
                <Card className="stat-tile mismo-card tile-border-green border border-[var(--color-border-200)]">
                  <CardContent className="p-5">
                    <div>
                      <p className="text-sm text-[var(--mismo-text-secondary)]">Updates (7 days)</p>
                      <p className="text-3xl font-bold text-[var(--mismo-text)] mt-1">{recentUpdatesCount}</p>
                    </div>
                    <button type="button" onClick={() => onNavigate('reports')} className="text-sm text-[var(--mismo-blue)] mt-3 hover:underline">
                      View all
                    </button>
                  </CardContent>
                </Card>
              </div>

              <div className="reports-section">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-[var(--mismo-text)]">My incident reports</h2>
                  <button type="button" onClick={() => onNavigate('reports')} className="text-sm text-[var(--mismo-blue)] hover:underline">
                    View all incident reports
                  </button>
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
                          >
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-[var(--mismo-blue)]" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-[var(--mismo-text)] truncate">{employeeIncidentReportHeadline(report)}</p>
                              <p className="text-sm text-[var(--mismo-text-secondary)]">Submitted {formatRelativeTime(report.createdAt)}</p>
                            </div>
                            <span className={`text-xs font-medium ${getStatusColor(report.status)}`}>{report.status}</span>
                            <Icons.chevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <Icons.inbox className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-[var(--mismo-text-secondary)]">No incident reports submitted yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="resources-section">
                <h2 className="text-lg font-semibold text-[var(--mismo-text)] mb-4">Resources</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card className="mismo-card mismo-card-hover cursor-pointer border border-[var(--color-border-200)]" onClick={() => onNavigate('resources')}>
                    <CardContent className="p-5">
                      <div className="w-10 h-10 rounded-lg bg-[var(--mismo-blue-light)] flex items-center justify-center mb-3">
                        <Icons.resources className="h-5 w-5 text-[var(--mismo-blue)]" />
                      </div>
                      <h3 className="font-semibold text-[var(--mismo-text)]">Employee handbook</h3>
                      <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">Memos and procedures</p>
                    </CardContent>
                  </Card>
                  <Card className="mismo-card mismo-card-hover cursor-pointer border border-[var(--color-border-200)]" onClick={() => onNavigate('resources')}>
                    <CardContent className="p-5">
                      <div className="w-10 h-10 rounded-lg bg-[var(--mismo-green-light)] flex items-center justify-center mb-3">
                        <Icons.heartPulse className="h-5 w-5 text-[var(--mismo-green)]" />
                      </div>
                      <h3 className="font-semibold text-[var(--mismo-text)]">Wellness resources</h3>
                      <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">Support and assistance</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
