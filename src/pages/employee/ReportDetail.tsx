import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  employeeIncidentReportHeadline,
  formatDate,
  formatRelativeTime,
  getStatusColor,
  isIncidentIntakeComplete,
  getEffectiveInvestigationPhase,
  investigationWorkflowLabel,
} from '@/lib/utils';

interface ReportDetailProps {
  dataStore: DataStore;
  reportId: string;
  onNavigate: (page: string) => void;
}

export function ReportDetail({ dataStore, reportId, onNavigate }: ReportDetailProps) {
  const { employeeReports, users, reportStatusEvents, investigations, employeeAcknowledgeInvestigationOutcome } = dataStore;
  
  const report = employeeReports.find(r => r.id === reportId);
  
  if (!report) {
    return (
      <div className="text-center py-12">
        <Icons.searchX className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-[var(--mismo-text)]">Incident report not found</h2>
        <p className="text-[var(--mismo-text-secondary)] mt-2">
          The incident report you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <button 
          onClick={() => onNavigate('reports')}
          className="text-[var(--mismo-blue)] mt-4 hover:underline"
        >
          Back to my incident reports
        </button>
      </div>
    );
  }
  
  const assignedAdmin = report.assignedTo ? users.find(u => u.id === report.assignedTo) : null;
  const investigation = report.investigationId ? investigations.find((i) => i.id === report.investigationId) : undefined;
  const invPhase = investigation ? getEffectiveInvestigationPhase(investigation) : null;
  const awaitingOutcome =
    investigation &&
    investigation.workflowPhase === 'AWAITING_OUTCOME_ACK' &&
    investigation.outcomeSummary &&
    investigation.outcomeEmployeeSignedAt == null;
  
  const timelineEvents: Array<{
    id: string;
    title: string;
    description: string;
    timestamp: Date;
    icon: keyof typeof Icons;
    color: string;
  }> = [
    {
      id: 'event-1',
      title: 'Incident report submitted',
      description: 'Your incident report has been received and is being reviewed.',
      timestamp: report.createdAt,
      icon: 'send',
      color: 'blue',
    },
  ];

  const statusTimeline = reportStatusEvents
    .filter((event) => event.reportId === report.id)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((event) => ({
      id: event.id,
      title: `Status changed to ${event.toStatus}`,
      description: event.note ?? `Updated from ${event.fromStatus} to ${event.toStatus}`,
      timestamp: event.createdAt,
      icon: event.toStatus === 'ASSIGNED' ? ('userPlus' as const) : ('refresh' as const),
      color: event.toStatus === 'ASSIGNED' ? 'purple' : 'amber',
    }));
  timelineEvents.push(...statusTimeline);
  
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="detail-header">
        <button 
          onClick={() => onNavigate('reports')}
          className="flex items-center gap-2 text-sm text-[var(--mismo-text-secondary)] hover:text-[var(--mismo-text)] mb-4"
        >
          <Icons.arrowLeft className="h-4 w-4" />
          Back to my incident reports
        </button>
        
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge className={getStatusColor(report.status)}>{report.status}</Badge>
        </div>

        <h1 className="text-2xl font-bold text-[var(--mismo-text)]">{employeeIncidentReportHeadline(report)}</h1>
        <p className="text-xs text-[var(--mismo-text-secondary)] mt-1">Reference #{report.id.replace(/^report-/, '').toUpperCase()}</p>
      </div>

      {!isIncidentIntakeComplete(report) && (
        <Card className="mismo-card border-2 border-amber-400/60 bg-amber-50/80">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-semibold text-[var(--mismo-text)]">Incident documentation required</p>
              <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">
                HR sent a receipt with a link to this portal. Complete the questionnaire so your incident report can move
                forward.
              </p>
            </div>
            <Button className="shrink-0 bg-[var(--mismo-blue)] hover:bg-blue-600" onClick={() => onNavigate(`incident-intake/${report.id}`)}>
              Open incident form
            </Button>
          </CardContent>
        </Card>
      )}

      {investigation && invPhase && invPhase !== 'CLOSED' && (
        <Card className="mismo-card border border-[var(--color-border-200)]">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Investigation</p>
            <p className="font-medium text-[var(--mismo-text)] mt-1">
              {investigationWorkflowLabel(invPhase)}
              {investigation.employeePreferredContact === 'PHONE_CALL' && ' · HR may call you'}
              {investigation.employeePreferredContact === 'IN_APP_MESSAGE' && ' · HR may message you in Mismo'}
            </p>
          </CardContent>
        </Card>
      )}

      {investigation &&
        (investigation.notes ?? []).filter((n) => n.visibility === 'EMPLOYEE').length > 0 && (
          <Card className="mismo-card border border-[var(--color-border-200)]">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-[var(--mismo-text)]">Updates from your investigator</h3>
              {(investigation.notes ?? [])
                .filter((n) => n.visibility === 'EMPLOYEE')
                .map((n) => (
                  <div key={n.id} className="border border-[var(--color-border-200)] rounded-md p-4 text-sm">
                    <p className="text-xs text-[var(--mismo-text-secondary)]">{formatRelativeTime(n.createdAt)}</p>
                    <p className="mt-2 whitespace-pre-wrap text-[var(--mismo-text)]">{n.body}</p>
                    {n.requiresEmployeeSignature && !n.employeeSignedAt && (
                      <p className="text-xs text-amber-700 mt-2">Signature requested; confirm with HR in your next touchpoint.</p>
                    )}
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

      {awaitingOutcome && (
        <Card className="mismo-card border-2 border-[var(--color-primary-700)]/35">
          <CardContent className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-[var(--mismo-text)]">Outcome of your case</h3>
            <p className="text-sm text-[var(--mismo-text-secondary)]">
              Please read the information below.{' '}
              {investigation.outcomeRequiresSignature ? 'Confirm whether you agree with this resolution.' : ''}
            </p>
            <div className="rounded-md bg-[var(--color-surface-200)] p-4 text-sm whitespace-pre-wrap text-[var(--mismo-text)]">
              {investigation.outcomeSummary}
            </div>
            {investigation.outcomeAttachment && (
              <a
                href={investigation.outcomeAttachment.dataUrl}
                download={investigation.outcomeAttachment.fileName}
                className="text-sm text-[var(--mismo-blue)] hover:underline"
              >
                Download attachment: {investigation.outcomeAttachment.fileName}
              </a>
            )}
            {investigation.outcomeRequiresSignature ? (
              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    employeeAcknowledgeInvestigationOutcome(investigation.id, true);
                    toast.success('Thank you. Your confirmation is recorded.');
                  }}
                >
                  I agree with this resolution
                </Button>
                <Button
                  variant="outline"
                  className="border-[var(--color-alert-600)] text-[var(--color-alert-700)]"
                  onClick={() => {
                    employeeAcknowledgeInvestigationOutcome(investigation.id, false);
                    toast.success('Your response has been recorded. HR may follow up with you.');
                  }}
                >
                  I do not agree
                </Button>
              </div>
            ) : (
              <div className="pt-2">
                <p className="text-xs text-[var(--mismo-text-secondary)] mb-2">No signature is required for this letter.</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    employeeAcknowledgeInvestigationOutcome(investigation.id, true);
                    toast.success('Acknowledged. Your review is on file.');
                  }}
                >
                  I&apos;ve read the outcome
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {investigation?.outcomeEmployeeSignedAt != null && (
        <Card className="mismo-card border border-[var(--color-border-200)]">
          <CardContent className="p-5 text-sm">
            <p className="font-medium text-[var(--mismo-text)]">Your response to the outcome</p>
            <p className="text-[var(--mismo-text-secondary)] mt-1">
              Signed {formatDate(investigation.outcomeEmployeeSignedAt)}.{' '}
              {investigation.outcomeEmployeeAgreed === true
                ? 'You agreed with the resolution.'
                : investigation.outcomeEmployeeAgreed === false
                  ? 'You indicated you do not agree. HR will follow up as needed.'
                  : ''}
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Report Details */}
      <Card className="detail-card mismo-card">
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Description */}
            <div>
              <h3 className="text-sm font-medium text-[var(--mismo-text-secondary)] uppercase tracking-wider mb-2">
                Description
              </h3>
              {report.description?.trim() ? (
                <p className="text-[var(--mismo-text)] leading-relaxed whitespace-pre-wrap">{report.description}</p>
              ) : (
                <p className="text-sm text-[var(--mismo-text-secondary)] italic">No description on file. HR may reach out if they need more detail.</p>
              )}
            </div>
            
            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              {report.peopleInvolved && (
                <div>
                  <h4 className="text-sm font-medium text-[var(--mismo-text-secondary)] mb-1">
                    People Involved
                  </h4>
                  <p className="text-[var(--mismo-text)]">{report.peopleInvolved}</p>
                </div>
              )}
              
              {report.location && (
                <div>
                  <h4 className="text-sm font-medium text-[var(--mismo-text-secondary)] mb-1">
                    Location
                  </h4>
                  <p className="text-[var(--mismo-text)]">{report.location}</p>
                </div>
              )}
              
              {report.incidentAt && (
                <div>
                  <h4 className="text-sm font-medium text-[var(--mismo-text-secondary)] mb-1">
                    Date of Incident
                  </h4>
                  <p className="text-[var(--mismo-text)]">{formatDate(report.incidentAt)}</p>
                </div>
              )}
              
              <div>
                <h4 className="text-sm font-medium text-[var(--mismo-text-secondary)] mb-1">
                  Submitted
                </h4>
                <p className="text-[var(--mismo-text)] flex items-center gap-2">
                  <Icons.calendar className="h-4 w-4 shrink-0 text-[var(--mismo-text-secondary)]" />
                  {formatDateTime(report.createdAt)}
                </p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-[var(--mismo-text-secondary)] mb-1">
                  Last Updated
                </h4>
                <p className="text-[var(--mismo-text)] flex items-center gap-2">
                  <Icons.clock className="h-4 w-4 shrink-0 text-[var(--mismo-text-secondary)]" />
                  {formatRelativeTime(report.updatedAt)}
                </p>
              </div>
              
              {report.isAnonymous && (
                <div>
                  <h4 className="text-sm font-medium text-[var(--mismo-text-secondary)] mb-1">
                    Anonymous
                  </h4>
                  <p className="text-[var(--mismo-text)] flex items-center gap-1.5">
                    <Icons.lock className="h-4 w-4" />
                    Yes
                  </p>
                </div>
              )}
              
              {report.preferredContactMethod && (
                <div>
                  <h4 className="text-sm font-medium text-[var(--mismo-text-secondary)] mb-1">
                    Preferred Contact
                  </h4>
                  <p className="text-[var(--mismo-text)]">{report.preferredContactMethod}</p>
                </div>
              )}
            </div>
            
            {/* Assignment Info */}
            {assignedAdmin && (
              <div className="pt-4 border-t border-gray-100">
                <h3 className="text-sm font-medium text-[var(--mismo-text-secondary)] uppercase tracking-wider mb-3">
                  Assignment
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--mismo-blue-light)] flex items-center justify-center">
                    <span className="text-sm font-semibold text-[var(--mismo-blue)]">
                      {assignedAdmin.firstName[0]}{assignedAdmin.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-[var(--mismo-text)]">
                      {assignedAdmin.firstName} {assignedAdmin.lastName}
                    </p>
                    <p className="text-sm text-[var(--mismo-text-secondary)]">
                      Investigator
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-gray-100 space-y-2">
              <h3 className="text-sm font-medium text-[var(--mismo-text-secondary)] uppercase tracking-wider">
                Procedural Progress
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="border border-[var(--color-border-200)] p-3">
                  <p className="text-[var(--mismo-text-secondary)]">Planned Response</p>
                  <p className="mt-1 text-[var(--mismo-text)]">{report.responsePlan || 'HR planning in progress'}</p>
                </div>
                <div className="border border-[var(--color-border-200)] p-3">
                  <p className="text-[var(--mismo-text-secondary)]">Action Taken</p>
                  <p className="mt-1 text-[var(--mismo-text)]">{report.responseActionTaken || 'No action logged yet'}</p>
                </div>
                <div className="border border-[var(--color-border-200)] p-3">
                  <p className="text-[var(--mismo-text-secondary)]">Your Response Outcome</p>
                  <p className="mt-1 text-[var(--mismo-text)]">{report.employeeResponseOutcome || 'Awaiting follow-up'}</p>
                </div>
              </div>
              <p className="text-xs text-[var(--mismo-text-secondary)]">
                Compliance checklist completion: {(report.responseChecklist ?? []).filter((item) => item.completed).length}/
                {(report.responseChecklist ?? []).length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Timeline */}
      <Card className="timeline-card mismo-card">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-[var(--mismo-text)] mb-4">
            Activity Timeline
          </h3>
          
          <div className="space-y-4">
            {timelineEvents.map((event, index) => {
              const Icon = Icons[event.icon];
              return (
                <div key={event.id} className="flex gap-4 items-start">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      event.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                      event.color === 'amber' ? 'bg-amber-100 text-amber-600' :
                      event.color === 'purple' ? 'bg-purple-100 text-purple-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {index < timelineEvents.length - 1 && (
                      <div className="w-0.5 flex-1 bg-gray-200 my-2" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium text-[var(--mismo-text)]">{event.title}</p>
                    <p className="text-sm text-[var(--mismo-text-secondary)] mt-0.5">
                      {event.description}
                    </p>
                    <p className="text-xs text-[var(--mismo-text-secondary)] mt-1">
                      {formatRelativeTime(event.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <Card className="mismo-card">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-[var(--mismo-text)] mb-4">Messages</h3>
          <div className="space-y-2">
            {(report.messages ?? []).map((message) => (
              <div key={message.id} className="border p-3">
                <p className="text-sm">{message.body}</p>
                <p className="text-xs text-[var(--mismo-text-secondary)] mt-1">{formatRelativeTime(message.createdAt)}</p>
              </div>
            ))}
            {(report.messages ?? []).length === 0 && (
              <p className="text-sm text-[var(--mismo-text-secondary)]">No messages yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function for formatting date with time
function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
