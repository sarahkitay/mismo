import { useEffect, useState } from 'react';
import type { PromptAnswer } from '@/types';
import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { employeeIncidentReportHeadline, formatDate, formatRelativeTime, getStatusColor, isEmployeeReportIntakeComplete } from '@/lib/utils';
import { ReportConcernSection } from '@/components/employee/ReportConcernSection';
import { toast } from 'sonner';

/** EQC-style mandatory incident query copy (shown for prompts with type INCIDENT). */
const EQC_INCIDENT_QUESTION =
  "Have you experienced or witnessed an incident or occurrence which you perceive to be a violation of your or your co-worker's employment rights that you have not reported prior to this question.";

const EQC_RETALIATION_NOTE =
  'You will not be retaliated against for sharing a concern in good faith. Retaliation is against the law and is not tolerated by this company.';

const EQC_CONFIRMATION_BODY =
  'Thank you for letting us know. Your response will be reviewed by the appropriate HR contact. If this was selected by mistake, you can go back and update your answer before submitting.';

/** Shown after the main check-in when the prompt has `includeFinancialQuestion`. */
const FINANCIAL_SCREENING_QUESTION =
  'Are you aware of any issue related to pay, bonuses, reimbursements, benefits, or other compensation that you believe may be incorrect, withheld without proper explanation, or inconsistent with company policy or applicable law?';

const FINANCIAL_SCREENING_NOTE =
  'This question is included because your organization turned on the optional financial screening for this check-in. Your answer is stored with your check-in response.';

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
    submitIncidentPromptYes,
    policies,
    policyAcknowledgements,
    organizationName,
    responses,
  } = dataStore;
  const unreadPolicies = policies.filter(
    (p) =>
      p.status === 'PUBLISHED' &&
      p.acknowledgmentRequired &&
      !policyAcknowledgements.some((a) => a.policyId === p.id && a.userId === currentUser.id)
  );
  const heroPrompt = pendingPromptsForEmployee[0];
  const heroPromptAlreadyAnswered = Boolean(
    heroPrompt &&
      responses.some(
        (r) => r.promptDeliveryId === heroPrompt.id && r.userId === currentUser.id && r.finalizedAt
      )
  );
  const showCheckInGate = Boolean(heroPrompt) && !heroPromptAlreadyAnswered;
  const isIncidentGate = Boolean(heroPrompt?.prompt.type === 'INCIDENT');
  const wantsFinancialFollowUp = Boolean(heroPrompt?.prompt.includeFinancialQuestion);
  const [incidentStep, setIncidentStep] = useState<'question' | 'yes_confirm'>('question');
  type FinancialFollowUp = {
    deliveryId: string;
    answer: PromptAnswer;
    promptIdForReport?: string;
    incidentRestoreStep?: 'question' | 'yes_confirm';
  };
  const [financialFollowUp, setFinancialFollowUp] = useState<FinancialFollowUp | null>(null);
  useEffect(() => {
    setIncidentStep('question');
    setFinancialFollowUp(null);
  }, [heroPrompt?.id]);

  const isFullyCaughtUp = pendingPromptsForEmployee.length === 0 && unreadPolicies.length === 0;
  /** No mandatory check-in card: show the lighter dashboard (with or without memos to sign). */
  const showRelaxedDashboard = !showCheckInGate && pendingPromptsForEmployee.length === 0;
  const eqcHeaderDate = formatEqcHeaderDate(new Date());

  const submitFinancialAndClose = (hasPayConcern: boolean) => {
    if (!financialFollowUp) return;
    const note = hasPayConcern
      ? 'Financial follow-up: employee indicated a pay, compensation, or benefits-related concern.'
      : 'Financial follow-up: no pay, compensation, or benefits-related concern indicated.';
    const { deliveryId, answer, promptIdForReport } = financialFollowUp;
    setFinancialFollowUp(null);
    setIncidentStep('question');

    if (answer === 'HAS_ISSUE' && isIncidentGate) {
      const result = submitIncidentPromptYes(deliveryId, note);
      if (result) {
        toast.success(
          'Thank you. Your response is recorded and a secure case has been opened. Complete the brief intake form next.',
          { duration: 7000 }
        );
        onNavigate(`incident-intake/${result.report.id}`);
      }
      return;
    }

    submitPromptResponse(deliveryId, answer, note);
    if (answer === 'HAS_ISSUE' && promptIdForReport) {
      toast.info(
        'HR is alerted on the admin dashboard and by email (simulated). You will receive a receipt with next steps and a link to your incident portal to complete documentation.',
        { duration: 7000 }
      );
      onNavigate('report-new', { promptId: promptIdForReport, deliveryId });
    } else if (answer === 'NO_ISSUE' && isIncidentGate) {
      toast.success('Your response has been recorded. No further action is needed for this check-in.');
    } else {
      toast.success('Response recorded in compliance log.');
    }
  };

  const cancelFinancialFollowUp = () => {
    if (financialFollowUp?.incidentRestoreStep) {
      setIncidentStep(financialFollowUp.incidentRestoreStep);
    }
    setFinancialFollowUp(null);
  };

  const handleNoIssues = (deliveryId: string) => {
    if (wantsFinancialFollowUp) {
      setFinancialFollowUp({
        deliveryId,
        answer: 'NO_ISSUE',
        incidentRestoreStep: isIncidentGate ? incidentStep : undefined,
      });
      return;
    }
    submitPromptResponse(deliveryId, 'NO_ISSUE');
    toast.success(
      isIncidentGate
        ? 'Your response has been recorded. No further action is needed for this check-in.'
        : 'Your response has been recorded.'
    );
  };

  /** Non–incident prompts: log issue and open optional detailed report flow. */
  const handleHaveIssueWithReport = (deliveryId: string, promptId: string) => {
    if (wantsFinancialFollowUp) {
      setFinancialFollowUp({ deliveryId, answer: 'HAS_ISSUE', promptIdForReport: promptId });
      return;
    }
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
    if (wantsFinancialFollowUp) {
      setFinancialFollowUp({ deliveryId, answer: 'HAS_ISSUE', incidentRestoreStep: 'yes_confirm' });
      return;
    }
    const result = submitIncidentPromptYes(deliveryId);
    setIncidentStep('question');
    if (result) {
      toast.success(
        'Thank you. Your response is recorded and HR has been notified. Complete the secure intake form to add details.',
        { duration: 7000 }
      );
      onNavigate(`incident-intake/${result.report.id}`);
    }
  };
  
  const pendingIntakes = employeeReports.filter((r) => !isEmployeeReportIntakeComplete(r));
  
  return (
    <div className="space-y-6 relative z-[1]">
      <ReportConcernSection onNavigate={onNavigate} />

      {pendingIntakes.length > 0 && (
        <Card className="mismo-card border-2 border-amber-400/60 bg-amber-50/90">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-semibold text-[var(--mismo-text)]">Action needed on your report</p>
              <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">
                {pendingIntakes.length === 1
                  ? 'Complete your pending intake form to finish submitting your concern.'
                  : `You have ${pendingIntakes.length} reports waiting on intake completion.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {pendingIntakes.slice(0, 2).map((r) => {
                const label = employeeIncidentReportHeadline(r);
                const short = label.length > 28 ? `${label.slice(0, 28)}…` : label;
                return (
                <Button key={r.id} variant="default" className="bg-[var(--mismo-blue)] hover:bg-blue-600" onClick={() => onNavigate(r.caseType === 'WAGE_HOUR' ? `wage-hour-intake/${r.id}` : `incident-intake/${r.id}`)}>
                  Open form: {short}
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
              {financialFollowUp ? (
                <>
                  <p className="text-xs tracking-[0.08em] uppercase text-[var(--color-text-secondary)]">
                    {isIncidentGate ? 'Check-in required before you continue' : 'Compliance Check-In Required'}
                  </p>
                  <h2 className="mismo-heading text-2xl md:text-3xl mt-3 text-[var(--color-primary-900)]">Pay and compensation screening</h2>
                  <p className="text-base md:text-lg text-[var(--color-text-primary)] mt-5 leading-relaxed">{FINANCIAL_SCREENING_QUESTION}</p>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-4 leading-relaxed border-l-2 border-[var(--color-primary-500)] pl-4">
                    {FINANCIAL_SCREENING_NOTE}
                  </p>
                  {heroPrompt?.dueAt && (
                    <p className="text-sm text-[var(--color-text-secondary)] mt-4 flex items-center gap-1.5">
                      <Icons.clock className="h-4 w-4 shrink-0" />
                      Due by {formatDate(heroPrompt.dueAt)}
                    </p>
                  )}
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="h-14 text-base border-[var(--color-emerald-600)] text-[var(--color-emerald-600)] shadow-[var(--shadow-1)] enterprise-interactive"
                      onClick={() => submitFinancialAndClose(false)}
                    >
                      No concern
                    </Button>
                    <Button
                      className="h-14 text-base bg-[var(--color-primary-900)] hover:bg-[var(--color-primary-700)] shadow-[var(--shadow-2)] enterprise-interactive"
                      onClick={() => submitFinancialAndClose(true)}
                    >
                      Yes, I have a concern
                    </Button>
                  </div>
                  <div className="mt-6">
                    <Button type="button" variant="ghost" className="text-[var(--mismo-blue)]" onClick={cancelFinancialFollowUp}>
                      Back to previous step
                    </Button>
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}
