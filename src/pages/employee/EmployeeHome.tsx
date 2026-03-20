import { useRef } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate, formatRelativeTime, getStatusColor } from '@/lib/utils';
import { toast } from 'sonner';

interface EmployeeHomeProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function EmployeeHome({ dataStore, onNavigate }: EmployeeHomeProps) {
  const { currentUser, pendingPromptsForEmployee, employeeReports, submitPromptResponse, policies, policyAcknowledgements } = dataStore;
  const unreadPolicies = policies.filter(
    (p) =>
      p.status === 'PUBLISHED' &&
      p.acknowledgmentRequired &&
      !policyAcknowledgements.some((a) => a.policyId === p.id && a.userId === currentUser.id)
  );
  const nowRef = useRef(new Date());
  const heroPrompt = pendingPromptsForEmployee[0];
  const showCheckInGate = Boolean(heroPrompt);
  
  const handleNoIssues = (deliveryId: string) => {
    submitPromptResponse(deliveryId, 'NO_ISSUE');
    toast.success('Response recorded in compliance log.');
  };
  
  const handleHaveIssue = (deliveryId: string, promptId: string) => {
    submitPromptResponse(deliveryId, 'HAS_ISSUE');
    onNavigate('report-new', { promptId, deliveryId });
  };
  
  const pendingCount = pendingPromptsForEmployee.length;
  const openReportsCount = employeeReports.filter(r => !['RESOLVED', 'CLOSED'].includes(r.status)).length;
  const recentUpdatesCount = employeeReports.filter(r => {
    const daysSinceUpdate = (nowRef.current.getTime() - r.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate < 7;
  }).length;
  
  return (
    <div className="space-y-6 relative z-[1]">
      {showCheckInGate && (
        <Card className="mismo-card border-2 border-[var(--color-primary-700)] shadow-[var(--shadow-2)]">
          <CardContent className="p-8 md:p-10">
            <div className="max-w-3xl">
              <p className="text-xs tracking-[0.08em] uppercase text-[var(--color-text-secondary)]">Compliance Check-In Required</p>
              <h2 className="mismo-heading text-3xl md:text-4xl mt-2 text-[var(--color-primary-900)]">
                {heroPrompt.prompt.title}
              </h2>
              <p className="text-base md:text-lg text-[var(--color-text-secondary)] mt-3 leading-relaxed">
                {heroPrompt.prompt.description}
              </p>
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
                  onClick={() => handleHaveIssue(heroPrompt.id, heroPrompt.prompt.id)}
                >
                  I have an issue
                  <Icons.arrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!showCheckInGate && (
        <>
      {/* Header */}
      <div className="header-block">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--mismo-text)]">
              Employee Compliance Workspace
            </h1>
            <p className="text-[var(--mismo-text-secondary)] mt-1">
              {currentUser.firstName}, review required check-ins and case activity.
            </p>
          </div>
          <Button onClick={() => onNavigate('report-new')} className="bg-[var(--mismo-blue)] hover:bg-blue-600">
            <Icons.add className="h-4 w-4 mr-2" />
            Submit New Report
          </Button>
        </div>
      </div>
      
      {/* Action Required - Pending Prompts */}
      {pendingPromptsForEmployee.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[var(--mismo-text)]">Compliance Check-In Required</h2>
          {pendingPromptsForEmployee.map((delivery) => (
            <Card key={delivery.id} className="action-card mismo-card border border-[var(--color-border-200)] shadow-[var(--shadow-1)] relative z-[1]">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                  {/* Icon */}
                  <div className="w-14 h-14 rounded-full bg-[var(--mismo-blue-light)] flex items-center justify-center flex-shrink-0">
                    <Icons.message className="h-6 w-6 text-[var(--mismo-blue)]" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-[var(--mismo-text)]">
                      {delivery.prompt.title}
                    </h3>
                    <p className="text-base text-[var(--mismo-text-secondary)] mt-1 leading-relaxed">
                      {delivery.prompt.description}
                    </p>
                    {delivery.dueAt && (
                      <p className="text-sm text-[var(--mismo-amber)] mt-2 flex items-center gap-1.5">
                        <Icons.clock className="h-4 w-4" />
                        Due by {formatDate(delivery.dueAt)}
                      </p>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                    <Button
                      variant="outline"
                      className="border-[var(--mismo-green)] text-[var(--mismo-green)] hover:bg-[var(--mismo-green-light)]"
                      onClick={() => handleNoIssues(delivery.id)}
                    >
                      <Icons.check className="h-4 w-4 mr-2" />
                      No issues to report
                    </Button>
                    <Button
                      className="bg-[var(--mismo-blue)] hover:bg-blue-600"
                      onClick={() => handleHaveIssue(delivery.id, delivery.prompt.id)}
                    >
                      I have an issue
                      <Icons.arrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Policies to acknowledge */}
      {unreadPolicies.length > 0 && (
        <Card className="mismo-card border border-[var(--color-border-200)]">
          <CardContent className="p-5">
            <h2 className="text-lg font-semibold text-[var(--mismo-text)]">Policies requiring your acknowledgement</h2>
            <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">Review and mark as read or request clarification.</p>
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
                  <span className="ml-2 text-xs text-[var(--mismo-amber)]">Not read</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="stat-tile mismo-card tile-border-blue border border-[var(--color-border-200)]">
          <CardContent className="p-5">
            <div>
              <p className="text-sm text-[var(--mismo-text-secondary)]">Pending Prompts</p>
              <p className="text-3xl font-bold text-[var(--mismo-text)] mt-1">{pendingCount}</p>
            </div>
            <button 
              onClick={() => onNavigate('home')}
              className="text-sm text-[var(--mismo-blue)] mt-3 hover:underline"
            >
              View all
            </button>
          </CardContent>
        </Card>
        
        <Card className="stat-tile mismo-card tile-border-amber border border-[var(--color-border-200)]">
          <CardContent className="p-5">
            <div>
              <p className="text-sm text-[var(--mismo-text-secondary)]">Open Reports</p>
              <p className="text-3xl font-bold text-[var(--mismo-text)] mt-1">{openReportsCount}</p>
            </div>
            <button 
              onClick={() => onNavigate('reports')}
              className="text-sm text-[var(--mismo-blue)] mt-3 hover:underline"
            >
              View all
            </button>
          </CardContent>
        </Card>
        
        <Card className="stat-tile mismo-card tile-border-green border border-[var(--color-border-200)]">
          <CardContent className="p-5">
            <div>
              <p className="text-sm text-[var(--mismo-text-secondary)]">Recent Updates</p>
              <p className="text-3xl font-bold text-[var(--mismo-text)] mt-1">{recentUpdatesCount}</p>
            </div>
            <button 
              onClick={() => onNavigate('reports')}
              className="text-sm text-[var(--mismo-blue)] mt-3 hover:underline"
            >
              View all
            </button>
          </CardContent>
        </Card>
      </div>
      
      {/* My Reports Preview */}
      <div className="reports-section">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--mismo-text)]">My Reports</h2>
          <button 
            onClick={() => onNavigate('reports')}
            className="text-sm text-[var(--mismo-blue)] hover:underline"
          >
            View all reports
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
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      report.severity === 'CRITICAL' ? 'bg-red-500' :
                      report.severity === 'HIGH' ? 'bg-orange-500' :
                      report.severity === 'MEDIUM' ? 'bg-blue-500' :
                      'bg-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--mismo-text)] truncate">
                        {report.summary}
                      </p>
                      <p className="text-sm text-[var(--mismo-text-secondary)]">
                        Submitted {formatRelativeTime(report.createdAt)}
                      </p>
                    </div>
                    <span className={`text-xs font-medium ${getStatusColor(report.status)}`}>
                      {report.status}
                    </span>
                    <Icons.chevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Icons.inbox className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-[var(--mismo-text-secondary)]">No reports submitted yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Resources */}
      <div className="resources-section">
        <h2 className="text-lg font-semibold text-[var(--mismo-text)] mb-4">Resources</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="mismo-card mismo-card-hover cursor-pointer border border-[var(--color-border-200)]" onClick={() => onNavigate('resources')}>
            <CardContent className="p-5">
              <div className="w-10 h-10 rounded-lg bg-[var(--mismo-blue-light)] flex items-center justify-center mb-3">
                <Icons.resources className="h-5 w-5 text-[var(--mismo-blue)]" />
              </div>
              <h3 className="font-semibold text-[var(--mismo-text)]">Employee Handbook</h3>
              <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">
                Policies and procedures
              </p>
            </CardContent>
          </Card>
          
          <Card className="mismo-card mismo-card-hover cursor-pointer border border-[var(--color-border-200)]" onClick={() => onNavigate('resources')}>
            <CardContent className="p-5">
              <div className="w-10 h-10 rounded-lg bg-[var(--mismo-green-light)] flex items-center justify-center mb-3">
                <Icons.heartPulse className="h-5 w-5 text-[var(--mismo-green)]" />
              </div>
              <h3 className="font-semibold text-[var(--mismo-text)]">Wellness Resources</h3>
              <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">
                Support and assistance
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
