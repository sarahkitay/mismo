import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatPercent } from '@/lib/utils';
import { downloadCsv } from '@/lib/exportCsv';
import {
 fetchApiHealth,
 fetchHrLawUpdates,
 fetchHrLaws,
 getApiBaseUrl,
 isAiFeaturesEnabled,
 syncHrLawsForState,
 type ApiHealthStatus,
} from '@/lib/api/aiServices';
import type { HrLawRecord, HrLawUpdate } from '@/types/aiServices';
import { filterStates, findStateByCode, resolveDefaultStateCode, US_STATES } from '@/lib/usStates';
import {
 API_CHECKING,
 API_CONNECTED_DATABASE_MISSING,
 API_CONNECTED_OPENAI_MISSING,
 API_CONNECTED_READY,
 API_ENDPOINT_LABEL,
 API_NOT_CONFIGURED,
 API_UNREACHABLE,
 sanitizeInfraError,
} from '@/lib/infraMessaging';
import { toast } from 'sonner';

interface AdminComplianceProps {
 dataStore: DataStore;
 onNavigate?: (page: string, params?: Record<string, string>) => void;
 initialFilters?: Record<string, string>;
}

export function AdminCompliance({ dataStore, onNavigate, initialFilters }: AdminComplianceProps) {
 const [tab, setTab] = useState<'DASHBOARD' | 'STATE_NEXUS'>(
 initialFilters?.tab === 'STATE_NEXUS' ? 'STATE_NEXUS' : 'DASHBOARD'
 );
 const [priority, setPriority] = useState<'ALL' | 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
 const [selectedState, setSelectedState] = useState(() =>
 resolveDefaultStateCode(dataStore.currentUser.state)
 );
 const [stateQuery, setStateQuery] = useState('');
 const [laws, setLaws] = useState<HrLawRecord[]>([]);
 const [updates, setUpdates] = useState<HrLawUpdate[]>([]);
 const [loadingLaws, setLoadingLaws] = useState(false);
 const [syncing, setSyncing] = useState(false);
 const [syncingAll, setSyncingAll] = useState(false);
 const [apiHealth, setApiHealth] = useState<ApiHealthStatus | null>(null);

 const filteredStates = useMemo(() => filterStates(stateQuery), [stateQuery]);
 const selectedStateInfo = findStateByCode(selectedState);

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
 if (!getApiBaseUrl()) return;
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

 const refreshApiHealth = useCallback(async () => {
 const health = await fetchApiHealth();
 setApiHealth(health);
 }, []);

 useEffect(() => {
 if (tab !== 'STATE_NEXUS') return;
 void refreshApiHealth();
 }, [tab, refreshApiHealth]);

 useEffect(() => {
 if (tab === 'STATE_NEXUS' && getApiBaseUrl()) {
 void loadStateData(selectedState);
 }
 }, [tab, selectedState, loadStateData]);

 const handleSync = async (stateCode = selectedState) => {
 const state = findStateByCode(stateCode);
 if (!state) {
 toast.error('Select a valid US state.');
 return;
 }
 setSyncing(true);
 try {
 const result = await syncHrLawsForState(state.code, state.name, dataStore.currentUser.orgId);
 toast.success(
 `OpenAI research saved ${result.lawCount} laws for ${state.name} (${result.inserted} new, ${result.updated} updated).`
 );
 if (state.code === selectedState) {
 await loadStateData(selectedState);
 }
 await refreshApiHealth();
 } catch (err) {
 toast.error(sanitizeInfraError(err instanceof Error ? err.message : 'Law sync failed'));
 } finally {
 setSyncing(false);
 }
 };

 const handleSyncAll = async () => {
 if (!window.confirm(`Research and sync HR laws for all ${US_STATES.length} states via OpenAI? This may take several minutes.`)) {
 return;
 }
 setSyncingAll(true);
 let success = 0;
 try {
 for (const state of US_STATES) {
 toast.message(`Syncing ${state.name}…`);
 await syncHrLawsForState(state.code, state.name, dataStore.currentUser.orgId);
 success += 1;
 }
 toast.success(`Synced ${success} states to the database.`);
 await loadStateData(selectedState);
 await refreshApiHealth();
 } catch (err) {
 toast.error(sanitizeInfraError(err instanceof Error ? err.message : `Stopped after ${success} states`));
 await loadStateData(selectedState);
 } finally {
 setSyncingAll(false);
 }
 };

 const apiStatusLabel = (() => {
 if (!getApiBaseUrl()) {
 return API_NOT_CONFIGURED;
 }
 if (!apiHealth) return API_CHECKING;
 if (!apiHealth.ok) return API_UNREACHABLE;
 if (!apiHealth.openai) return API_CONNECTED_OPENAI_MISSING;
 if (!apiHealth.database) return API_CONNECTED_DATABASE_MISSING;
 return API_CONNECTED_READY;
 })();

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
 <div>
 <h2 className="font-semibold">State HR law monitor</h2>
 <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">
 Search any US state, then sync to research current employment-law summaries with OpenAI and store them in the AWS database.
 {dataStore.currentUser.state ? (
 <> Your profile state: <strong>{dataStore.currentUser.state}</strong>.</>
 ) : null}
 </p>
 </div>

 <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
 <div className="space-y-2">
 <label htmlFor="state-search" className="text-sm font-medium">Find your state</label>
 <Input
 id="state-search"
 placeholder="Search by name or code (e.g. California, CA, NY)"
 value={stateQuery}
 onChange={(e) => setStateQuery(e.target.value)}
 />
 <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
 {filteredStates.map((state) => (
 <button
 key={state.code}
 type="button"
 className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface-200)] ${selectedState === state.code ? 'bg-[var(--mismo-blue)]/10 font-medium' : ''}`}
 onClick={() => {
 setSelectedState(state.code);
 setStateQuery(state.name);
 }}
 >
 {state.name} ({state.code})
 </button>
 ))}
 </div>
 </div>
 <div className="flex flex-col gap-2">
 <Button
 type="button"
 onClick={() => void handleSync()}
 disabled={syncing || syncingAll || !isAiFeaturesEnabled()}
 >
 {syncing ? 'Researching…' : `Sync ${selectedStateInfo?.name ?? selectedState}`}
 </Button>
 <Button
 type="button"
 variant="outline"
 onClick={() => void handleSyncAll()}
 disabled={syncing || syncingAll || !isAiFeaturesEnabled()}
 >
 {syncingAll ? 'Syncing all states…' : 'Sync all states (OpenAI)'}
 </Button>
 </div>
 </div>

 <p className="text-xs text-[var(--color-text-muted)]">
 API: {apiStatusLabel}
 {apiHealth?.apiBase ? <> · <span>{API_ENDPOINT_LABEL}</span></> : null}
 </p>
 </CardContent>
 </Card>

 <Card className="mismo-card">
 <CardContent className="p-4">
 <h2 className="font-semibold mb-3">
 {selectedStateInfo?.name ?? selectedState} — current laws
 </h2>
 {loadingLaws ? (
 <p className="text-sm text-[var(--mismo-text-secondary)]">Loading from database…</p>
 ) : laws.length === 0 ? (
 <p className="text-sm text-[var(--mismo-text-secondary)]">
 No laws stored yet for {selectedStateInfo?.name ?? selectedState}. Click sync to run OpenAI research and save summaries.
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
 <h2 className="font-semibold mb-3">Recent law changes — {selectedStateInfo?.name ?? selectedState}</h2>
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
 </>
 )}
 </div>
 );
}
