import { useCallback, useEffect, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPercent } from '@/lib/utils';
import { downloadCsv } from '@/lib/exportCsv';
import {
 fetchHrLawUpdates,
 fetchHrLaws,
 isAiFeaturesEnabled,
 syncHrLawsForState,
} from '@/lib/api/aiServices';
import type { HrLawRecord, HrLawUpdate } from '@/types/aiServices';
import { toast } from 'sonner';

interface AdminComplianceProps {
 dataStore: DataStore;
 onNavigate?: (page: string, params?: Record<string, string>) => void;
 initialFilters?: Record<string, string>;
}

const WATCHED_STATES = [
 { code: 'CA', name: 'California' },
 { code: 'NY', name: 'New York' },
 { code: 'TX', name: 'Texas' },
];

export function AdminCompliance({ dataStore, onNavigate, initialFilters }: AdminComplianceProps) {
 const [tab, setTab] = useState<'DASHBOARD' | 'STATE_NEXUS'>(
 initialFilters?.tab === 'STATE_NEXUS' ? 'STATE_NEXUS' : 'DASHBOARD'
 );
 const [priority, setPriority] = useState<'ALL' | 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
 const [selectedState, setSelectedState] = useState('CA');
 const [laws, setLaws] = useState<HrLawRecord[]>([]);
 const [updates, setUpdates] = useState<HrLawUpdate[]>([]);
 const [loadingLaws, setLoadingLaws] = useState(false);
 const [syncing, setSyncing] = useState(false);

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

 const loadStateData = useCallback(async (stateCode: string) => {
 setLoadingLaws(true);
 try {
 const [{ laws: nextLaws }, { updates: nextUpdates }] = await Promise.all([
 fetchHrLaws(stateCode),
 fetchHrLawUpdates(dataStore.currentUser.orgId),
 ]);
 setLaws(nextLaws);
 setUpdates(nextUpdates.filter((u) => u.stateCode === stateCode));
 } catch {
 toast.error('Could not load state compliance data from API.');
 } finally {
 setLoadingLaws(false);
 }
 }, [dataStore.currentUser.orgId]);

 useEffect(() => {
 if (tab === 'STATE_NEXUS' && isAiFeaturesEnabled()) {
 void loadStateData(selectedState);
 }
 }, [tab, selectedState, loadStateData]);

 const handleSync = async () => {
 const state = WATCHED_STATES.find((s) => s.code === selectedState);
 if (!state) return;
 setSyncing(true);
 try {
 const result = await syncHrLawsForState(state.code, state.name, dataStore.currentUser.orgId);
 toast.success(`Synced ${result.lawCount} laws (${result.inserted} new, ${result.updated} updated).`);
 await loadStateData(selectedState);
 } catch (err) {
 toast.error(err instanceof Error ? err.message : 'Law sync failed');
 } finally {
 setSyncing(false);
 }
 };

 return (
 <div className="space-y-5">
 <div>
 <h1 className="text-2xl font-bold text-[var(--color-primary-900)]">State compliance</h1>
 <p className="text-[var(--mismo-text-secondary)]">
 Federal and state posting requirements, policy acknowledgements, and exportable compliance posture.{' '}
 {onNavigate && (
 <button type="button" className="text-[var(--mismo-blue)] underline font-medium" onClick={() => onNavigate('policies')}>
 Open memos & announcements
 </button>
 )}
 </p>
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
 <div className="flex flex-wrap gap-2">
 <Button
 type="button"
 variant="outline"
 onClick={() => {
 const headers = ['recordType', 'recordId', 'field', 'oldValue', 'newValue', 'actorUserId', 'createdAt'];
 const rows = dataStore.auditLogs.slice(0, 500).map((a) => [
 a.recordType,
 a.recordId,
 a.field ?? '',
 a.oldValue ?? '',
 a.newValue ?? '',
 a.actorUserId,
 a.createdAt.toISOString(),
 ]);
 downloadCsv(`mismo-compliance-audit-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
 }}
 >
 Export compliance audit CSV
 </Button>
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
 <CardContent className="p-4 space-y-4">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div>
 <h2 className="font-semibold">State HR law monitor</h2>
 <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">
 Laws are stored in your database after sync. Use sync to research and persist current summaries for each state.
 </p>
 </div>
 <div className="flex flex-wrap gap-2">
 {WATCHED_STATES.map((state) => (
 <button
 key={state.code}
 type="button"
 className={`interactive-control px-3 py-2 border text-sm ${selectedState === state.code ? 'bg-[var(--mismo-blue)] text-white' : ''}`}
 onClick={() => setSelectedState(state.code)}
 >
 {state.name}
 </button>
 ))}
 <Button type="button" onClick={() => void handleSync()} disabled={syncing || !isAiFeaturesEnabled()}>
 {syncing ? 'Syncing…' : 'Sync laws to database'}
 </Button>
 </div>
 </div>
 <p className="text-xs text-[var(--color-text-muted)]">
 API status: {isAiFeaturesEnabled() ? 'Connected - laws load from database after sync' : 'Set VITE_API_BASE_URL in .env.local'}
 </p>
 </CardContent>
 </Card>

 <Card className="mismo-card">
 <CardContent className="p-4">
 <h2 className="font-semibold mb-3">
 {WATCHED_STATES.find((s) => s.code === selectedState)?.name ?? selectedState} - current laws
 </h2>
 {loadingLaws ? (
 <p className="text-sm text-[var(--mismo-text-secondary)]">Loading from database…</p>
 ) : laws.length === 0 ? (
 <p className="text-sm text-[var(--mismo-text-secondary)]">
 No laws stored yet for {selectedState}. Click &quot;Sync laws to database&quot; to research and save summaries.
 </p>
 ) : (
 <div className="space-y-3">
 {laws.map((law) => (
 <div key={law.id} className="border-b pb-3 last:border-0">
 <div className="flex flex-wrap items-start justify-between gap-2">
 <p className="font-medium text-[var(--mismo-text)]">{law.title}</p>
 <span className="text-xs uppercase tracking-wide text-[var(--mismo-text-secondary)]">{law.topic.replace(/_/g, ' ')}</span>
 </div>
 <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">{law.summary}</p>
 <p className="text-xs text-[var(--mismo-text-secondary)] mt-2">
 {law.citation}
 {law.sourceUrl ? (
 <>
 {' · '}
 <a href={law.sourceUrl} target="_blank" rel="noreferrer" className="text-[var(--mismo-blue)] underline">
 Source
 </a>
 </>
 ) : null}
 </p>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>

 {updates.length > 0 && (
 <Card className="mismo-card">
 <CardContent className="p-4">
 <h2 className="font-semibold mb-3">Recent law changes</h2>
 <div className="space-y-2">
 {updates.map((update) => (
 <div key={update.id} className="flex justify-between gap-4 text-sm border-b pb-2">
 <div>
 <p className="font-medium">{update.title}</p>
 <p className="text-[var(--mismo-text-secondary)]">{update.summary}</p>
 </div>
 <span className="text-[var(--mismo-text-secondary)] whitespace-nowrap">{update.changeType}</span>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 )}

 <Card className="mismo-card">
 <CardContent className="p-4">
 <h2 className="font-semibold mb-3">State Nexus summary</h2>
 <div className="mt-3 space-y-2 text-sm">
 {WATCHED_STATES.map((state) => {
 const stateLawCount = state.code === selectedState ? laws.length : undefined;
 const pendingUpdates = updates.filter((u) => u.stateCode === state.code).length;
 const status =
 state.code === selectedState && loadingLaws
 ? 'Loading…'
 : pendingUpdates > 0
 ? `${pendingUpdates} update(s) to review`
 : stateLawCount && stateLawCount > 0
 ? `${stateLawCount} laws on file`
 : 'Run sync to populate';
 return (
 <div key={state.code} className="flex justify-between border-b pb-2">
 <button
 type="button"
 className="text-left hover:text-[var(--mismo-blue)]"
 onClick={() => setSelectedState(state.code)}
 >
 {state.name}
 </button>
 <span>{status}</span>
 </div>
 );
 })}
 </div>
 </CardContent>
 </Card>
 </>
 )}
 </div>
 );
}
