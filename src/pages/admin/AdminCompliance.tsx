import { useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Card, CardContent } from '@/components/ui/card';
import { formatPercent } from '@/lib/utils';

interface AdminComplianceProps {
  dataStore: DataStore;
}

export function AdminCompliance({ dataStore }: AdminComplianceProps) {
  const [tab, setTab] = useState<'DASHBOARD' | 'STATE_NEXUS'>('DASHBOARD');
  const [priority, setPriority] = useState<'ALL' | 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const policyAckRate = dataStore.policies.length
    ? dataStore.policyAcknowledgements.length / (dataStore.policies.length * dataStore.users.filter((u) => u.role === 'EMPLOYEE').length)
    : 0;
  const openFindings = dataStore.reports.filter((report) => !['RESOLVED', 'CLOSED'].includes(report.status)).length;
  const overduePrompts = dataStore.deliveries.filter((delivery) => delivery.status === 'PENDING' && delivery.dueAt && delivery.dueAt.getTime() < Date.now()).length;

  const actionItems = [
    { id: 'a1', title: 'Unacknowledged memo updates', priority: 'HIGH' as const },
    { id: 'a2', title: 'Open urgent report requires assignment', priority: 'URGENT' as const },
    { id: 'a3', title: 'Overdue prompt reminders pending', priority: 'MEDIUM' as const },
  ].filter((item) => priority === 'ALL' || item.priority === priority);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Compliance</h1>
        <p className="text-[var(--mismo-text-secondary)]">Audit trail and compliance status overview.</p>
      </div>
      <div className="flex gap-2">
        <button className={`interactive-control px-3 py-2 border text-sm ${tab === 'DASHBOARD' ? 'bg-[var(--mismo-blue)] text-white' : ''}`} onClick={() => setTab('DASHBOARD')}>
          Dashboard
        </button>
        <button className={`interactive-control px-3 py-2 border text-sm ${tab === 'STATE_NEXUS' ? 'bg-[var(--mismo-blue)] text-white' : ''}`} onClick={() => setTab('STATE_NEXUS')}>
          State Nexus
        </button>
      </div>
      {tab === 'DASHBOARD' ? (
      <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="mismo-card"><CardContent className="p-4"><p className="text-sm text-[var(--mismo-text-secondary)]">Memo acknowledgement rate</p><p className="text-3xl font-bold">{formatPercent(policyAckRate)}</p></CardContent></Card>
        <Card className="mismo-card"><CardContent className="p-4"><p className="text-sm text-[var(--mismo-text-secondary)]">Open Findings</p><p className="text-3xl font-bold">{openFindings}</p></CardContent></Card>
        <Card className="mismo-card"><CardContent className="p-4"><p className="text-sm text-[var(--mismo-text-secondary)]">Overdue Prompt Responses</p><p className="text-3xl font-bold">{overduePrompts}</p></CardContent></Card>
      </div>
      <Card className="mismo-card">
        <CardContent className="p-4">
          <h2 className="font-semibold mb-3">Audit Trail</h2>
          <div className="space-y-2">
            {dataStore.activities.slice(0, 8).map((activity) => (
              <div key={activity.id} className="flex items-center justify-between border-b pb-2 text-sm">
                <span>{activity.type.replace(/_/g, ' ')}</span>
                <span className="text-[var(--mismo-text-secondary)]">{activity.createdAt.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="mismo-card">
        <CardContent className="p-4">
          <h2 className="font-semibold mb-3">Priority Action Items</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {(['ALL', 'URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const).map((item) => (
              <button key={item} className={`interactive-control px-3 py-2 border text-sm ${priority === item ? 'bg-[var(--mismo-blue)] text-white' : ''}`} onClick={() => setPriority(item)}>
                {item}
              </button>
            ))}
          </div>
          {actionItems.length === 0 ? (
            <p className="text-sm text-[var(--mismo-text-secondary)]">No items for this priority.</p>
          ) : (
            <div className="space-y-2">
              {actionItems.map((item) => (
                <div key={item.id} className="flex justify-between text-sm border-b pb-2">
                  <span>{item.title}</span>
                  <span className="text-[var(--mismo-text-secondary)]">{item.priority}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </>
      ) : (
      <>
      <Card className="mismo-card">
        <CardContent className="p-4">
          <h2 className="font-semibold mb-3">State requirements</h2>
          <p className="text-sm text-[var(--mismo-text-secondary)] mb-3">
            Requirements for HR by state. Select a state or view all.
          </p>
          <select className="border border-[var(--color-border-200)] px-3 py-2 rounded text-sm w-full max-w-xs">
            <option value="ALL">All states</option>
            <option value="CA">California</option>
            <option value="NY">New York</option>
            <option value="TX">Texas</option>
            <option value="FL">Florida</option>
            <option value="IL">Illinois</option>
          </select>
        </CardContent>
      </Card>
      <Card className="mismo-card">
        <CardContent className="p-4">
          <h2 className="font-semibold mb-3">State Nexus</h2>
          <p className="text-sm text-[var(--mismo-text-secondary)]">
            Multi-state compliance nexus view (jurisdiction rules, notice obligations, and filing windows).
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between border-b pb-2"><span>California</span><span>Compliant</span></div>
            <div className="flex justify-between border-b pb-2"><span>New York</span><span>2 actions due</span></div>
            <div className="flex justify-between border-b pb-2"><span>Texas</span><span>Compliant</span></div>
          </div>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}
