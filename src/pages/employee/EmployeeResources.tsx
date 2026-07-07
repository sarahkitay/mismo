import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MemoSignatureAcknowledgement } from '@/components/MemoSignatureAcknowledgement';
import type { DataStore } from '@/hooks/useDataStore';
import type { Policy, PolicyAcknowledgement } from '@/types';
import { Icons } from '@/lib/icons';
import { EMPLOYEE_RESOURCE_CATEGORIES, getEmployeeResourceCategoryLabel } from '@/lib/employeeResourceCategories';
import { formatDate, getMemoCategoryDisplay } from '@/lib/utils';
import { toast } from 'sonner';

type MemoStatusFilter = 'ALL' | 'REQUIRED' | 'ACKNOWLEDGED' | 'CLARIFICATION' | 'UNREAD';
type SortOption = 'NEWEST' | 'DUE_SOON' | 'CATEGORY' | 'TITLE';

const PAGE_SIZE = 10;

interface EmployeeResourcesProps {
 dataStore: DataStore;
}

function getMemoStatus(policy: Policy, ack: PolicyAcknowledgement | undefined): {
 label: string;
 tone: 'success' | 'warn' | 'muted' | 'info';
} {
 if (!ack) {
 return policy.acknowledgmentRequired
 ? { label: 'Unanswered', tone: 'warn' }
 : { label: 'Unread', tone: 'muted' };
 }
 if (ack.outcome === 'REQUEST_CLARIFICATION') return { label: 'Needs clarification', tone: 'info' };
 if (ack.signatureDataUrl || ack.outcome === 'READ_UNDERSTOOD') return { label: 'Acknowledged', tone: 'success' };
 return { label: 'Acknowledged', tone: 'success' };
}

export function EmployeeResources({ dataStore }: EmployeeResourcesProps) {
 const { policies, policyAcknowledgements, currentUser, acknowledgePolicy, companyResources, emergencyHotlines } =
 dataStore;

 const [searchQuery, setSearchQuery] = useState('');
 const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
 const [statusFilter, setStatusFilter] = useState<MemoStatusFilter>('ALL');
 const [sortBy, setSortBy] = useState<SortOption>('DUE_SOON');
 const [page, setPage] = useState(1);
 const [openMemoId, setOpenMemoId] = useState<string | null>(null);

 const publishedPolicies = policies.filter((p) => p.status === 'PUBLISHED');
 const myAcks = policyAcknowledgements.filter((ack) => ack.userId === currentUser.id);
 const ackByPolicyId = new Map(myAcks.map((a) => [a.policyId, a]));

 const requiredMemos = useMemo(
 () =>
 publishedPolicies.filter((p) => {
 if (!p.acknowledgmentRequired) return false;
 const ack = ackByPolicyId.get(p.id);
 return !ack || ack.outcome === 'REQUEST_CLARIFICATION';
 }),
 [publishedPolicies, myAcks]
 );

 const filteredLibrary = useMemo(() => {
 const q = searchQuery.trim().toLowerCase();
 return publishedPolicies
 .filter((memo) => {
 const ack = ackByPolicyId.get(memo.id);
 const status = getMemoStatus(memo, ack);
 const cat = getMemoCategoryDisplay(memo);
 const matchesSearch =
 !q ||
 `${memo.title} ${memo.content} ${cat}`.toLowerCase().includes(q) ||
 companyResources.some(
 (r) =>
 r.category === categoryFilter &&
 `${r.title} ${r.description ?? ''}`.toLowerCase().includes(q)
 );
 const matchesCategory = categoryFilter === 'ALL' || cat === categoryFilter;
 const matchesStatus =
 statusFilter === 'ALL' ||
 (statusFilter === 'REQUIRED' && memo.acknowledgmentRequired && status.label === 'Unanswered') ||
 (statusFilter === 'ACKNOWLEDGED' && status.label === 'Acknowledged') ||
 (statusFilter === 'CLARIFICATION' && status.label === 'Needs clarification') ||
 (statusFilter === 'UNREAD' && (status.label === 'Unread' || status.label === 'Unanswered'));
 return matchesSearch && matchesCategory && matchesStatus;
 })
 .sort((a, b) => {
 if (sortBy === 'TITLE') return a.title.localeCompare(b.title);
 if (sortBy === 'CATEGORY') return getMemoCategoryDisplay(a).localeCompare(getMemoCategoryDisplay(b));
 if (sortBy === 'DUE_SOON') {
 const aDue = a.completionDueDate?.getTime() ?? Infinity;
 const bDue = b.completionDueDate?.getTime() ?? Infinity;
 return aDue - bDue;
 }
 return b.createdAt.getTime() - a.createdAt.getTime();
 });
 }, [publishedPolicies, searchQuery, categoryFilter, statusFilter, sortBy, companyResources, myAcks]);

 const filteredResources = useMemo(() => {
 const q = searchQuery.trim().toLowerCase();
 return companyResources
 .filter((r) => r.status === 'PUBLISHED')
 .filter((r) => {
 const matchesCategory =
 categoryFilter === 'ALL' || getEmployeeResourceCategoryLabel(r.category) === categoryFilter;
 const matchesSearch =
 !q || `${r.title} ${r.description ?? ''} ${getEmployeeResourceCategoryLabel(r.category)}`.toLowerCase().includes(q);
 return matchesCategory && matchesSearch;
 })
 .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
 }, [companyResources, searchQuery, categoryFilter]);

 const categoryOptions = useMemo(() => {
 const memoCats = new Set(publishedPolicies.map((p) => getMemoCategoryDisplay(p)));
 const resourceCats = EMPLOYEE_RESOURCE_CATEGORIES.map((c) => c.label);
 return Array.from(new Set([...memoCats, ...resourceCats])).sort();
 }, [publishedPolicies]);

 const pagedLibrary = filteredLibrary.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
 const totalPages = Math.max(1, Math.ceil(filteredLibrary.length / PAGE_SIZE));
 const openMemo = openMemoId ? publishedPolicies.find((p) => p.id === openMemoId) : null;

 const statusBadgeClass = (tone: 'success' | 'warn' | 'muted' | 'info') => {
 if (tone === 'success') return 'bg-[var(--mismo-green-light)] text-[var(--mismo-green)]';
 if (tone === 'warn') return 'bg-amber-100 text-amber-800';
 if (tone === 'info') return 'bg-blue-100 text-blue-800';
 return 'bg-[var(--color-surface-200)] text-[var(--mismo-text-secondary)]';
 };

 return (
 <div className="space-y-6">
 <div>
 <h1 className="text-2xl font-bold text-[var(--mismo-text)]">Resources</h1>
 <p className="text-[var(--mismo-text-secondary)] mt-1">
 Company memos, handbooks, and support materials managed by HR. You can search, filter, and request clarification if anything is unclear.
 </p>
 <p className="text-xs text-[var(--mismo-text-secondary)] mt-2">
 HR admins publish content under Memos &amp; Announcements and the Company Library in the admin portal.
 </p>
 </div>

 {/* Required acknowledgements */}
 <Card className="mismo-card border border-[var(--color-border-200)]">
 <CardContent className="p-5">
 <h2 className="text-lg font-semibold text-[var(--mismo-text)]">Required acknowledgements</h2>
 <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">
 Memos that need your review or signature. HR may follow up if more information is needed.
 </p>
 {requiredMemos.length === 0 ? (
 <p className="text-sm text-[var(--mismo-text-secondary)] mt-4">
 You&apos;re caught up - no memos need your acknowledgement right now.
 </p>
 ) : (
 <ul className="mt-4 space-y-3">
 {requiredMemos.map((memo, idx) => {
 const ack = ackByPolicyId.get(memo.id);
 const status = getMemoStatus(memo, ack);
 return (
 <li
 key={memo.id}
 className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-[var(--color-border-200)] p-3 rounded-[var(--radius-medium)]"
 >
 <div className="min-w-0">
 <p className="font-medium text-[var(--mismo-text)]">
 {idx + 1}. {memo.title}
 </p>
 <p className="text-xs text-[var(--mismo-text-secondary)] mt-0.5">
 {getMemoCategoryDisplay(memo)} · Published {formatDate(memo.effectiveDate)}
 {memo.completionDueDate && ` · Due ${formatDate(memo.completionDueDate)}`}
 </p>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 <span className={`text-xs px-2 py-0.5 rounded ${statusBadgeClass(status.tone)}`}>{status.label}</span>
 <Button size="sm" variant="outline" onClick={() => setOpenMemoId(memo.id)}>
 View memo
 </Button>
 </div>
 </li>
 );
 })}
 </ul>
 )}
 </CardContent>
 </Card>

 {/* Open memo detail */}
 {openMemo && (
 <Card className="mismo-card border-2 border-[var(--mismo-blue)]/30">
 <CardContent className="p-5 space-y-4">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div>
 <h2 className="text-xl font-semibold text-[var(--mismo-text)]">{openMemo.title}</h2>
 <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">
 {getMemoCategoryDisplay(openMemo)} · Published {formatDate(openMemo.effectiveDate)}
 {openMemo.completionDueDate && ` · Due ${formatDate(openMemo.completionDueDate)}`}
 </p>
 </div>
 <Button variant="ghost" size="sm" onClick={() => setOpenMemoId(null)}>
 Close
 </Button>
 </div>
 <div className="prose prose-sm max-w-none text-[var(--mismo-text)] whitespace-pre-wrap border border-[var(--color-border-200)] p-4 bg-[var(--color-surface-100)] rounded-md">
 {openMemo.content}
 </div>
 {openMemo.bodySourceUrl && (
 <a href={openMemo.bodySourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--mismo-blue)] hover:underline">
 Open linked document
 </a>
 )}
 {openMemo.bodyAttachmentFileName && (
 <p className="text-sm text-[var(--mismo-text-secondary)]">
 Attachment: {openMemo.bodyAttachmentFileName}
 </p>
 )}
 {openMemo.acknowledgmentRequired && (() => {
 const ack = ackByPolicyId.get(openMemo.id);
 const needsAck =
 !ack ||
 ack.outcome === 'REQUEST_CLARIFICATION' ||
 (ack.outcome === 'READ_UNDERSTOOD' && !ack.signatureDataUrl);
 return needsAck ? (
 <MemoSignatureAcknowledgement
 policyId={openMemo.id}
 policyTitle={openMemo.title}
 onSubmit={(signatureDataUrl) => {
 acknowledgePolicy(openMemo.id, currentUser.id, { outcome: 'READ_UNDERSTOOD', signatureDataUrl });
 toast.success('Thank you. Your acknowledgement has been recorded.');
 setOpenMemoId(null);
 }}
 onRequestClarification={(note) => {
 acknowledgePolicy(openMemo.id, currentUser.id, { outcome: 'REQUEST_CLARIFICATION', clarificationNote: note });
 toast.success('Your clarification request has been sent to HR.');
 setOpenMemoId(null);
 }}
 />
 ) : null;
 })()}
 {ackByPolicyId.get(openMemo.id)?.outcome === 'REQUEST_CLARIFICATION' && (
 <p className="text-sm text-blue-800 bg-blue-50 border border-blue-200 p-3 rounded-md">
 Needs clarification - HR has been notified and may follow up with you.
 </p>
 )}
 </CardContent>
 </Card>
 )}

 {/* Filters */}
 <Card className="mismo-card border border-[var(--color-border-200)]">
 <CardContent className="p-4 space-y-4">
 <div className="relative">
 <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
 <Input
 className="pl-10"
 placeholder="Search memos and resources…"
 value={searchQuery}
 onChange={(e) => {
 setSearchQuery(e.target.value);
 setPage(1);
 }}
 />
 </div>
 <div className="flex flex-wrap gap-2">
 <select
 className="h-9 rounded-md border border-[var(--color-border-200)] bg-white px-3 text-sm"
 value={categoryFilter}
 onChange={(e) => {
 setCategoryFilter(e.target.value);
 setPage(1);
 }}
 >
 <option value="ALL">All categories</option>
 {categoryOptions.map((c) => (
 <option key={c} value={c}>
 {c}
 </option>
 ))}
 </select>
 {(['ALL', 'REQUIRED', 'ACKNOWLEDGED', 'CLARIFICATION', 'UNREAD'] as MemoStatusFilter[]).map((s) => (
 <Button
 key={s}
 type="button"
 size="sm"
 variant={statusFilter === s ? 'default' : 'outline'}
 onClick={() => {
 setStatusFilter(s);
 setPage(1);
 }}
 >
 {s === 'ALL' ? 'All statuses' : s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ')}
 </Button>
 ))}
 {(['DUE_SOON', 'NEWEST', 'CATEGORY', 'TITLE'] as SortOption[]).map((s) => (
 <Button
 key={s}
 type="button"
 size="sm"
 variant={sortBy === s ? 'default' : 'outline'}
 onClick={() => setSortBy(s)}
 >
 {s === 'DUE_SOON' ? 'Due soon' : s.charAt(0) + s.slice(1).toLowerCase()}
 </Button>
 ))}
 <Button
 type="button"
 size="sm"
 variant="ghost"
 onClick={() => {
 setSearchQuery('');
 setCategoryFilter('ALL');
 setStatusFilter('ALL');
 setSortBy('DUE_SOON');
 setPage(1);
 }}
 >
 Clear filters
 </Button>
 </div>
 </CardContent>
 </Card>

 {/* Company library - memos */}
 <Card className="mismo-card border border-[var(--color-border-200)]">
 <CardContent className="p-0">
 <div className="px-5 py-4 border-b border-[var(--color-border-200)]">
 <h2 className="text-lg font-semibold text-[var(--mismo-text)]">Company library</h2>
 <p className="text-sm text-[var(--mismo-text-secondary)]">Published memos and reference materials</p>
 </div>
 {filteredLibrary.length === 0 ? (
 <p className="p-6 text-sm text-[var(--mismo-text-secondary)]">No memos match your filters.</p>
 ) : (
 <ul>
 {pagedLibrary.map((memo, idx) => {
 const ack = ackByPolicyId.get(memo.id);
 const status = getMemoStatus(memo, ack);
 const rowNum = (page - 1) * PAGE_SIZE + idx + 1;
 return (
 <li
 key={memo.id}
 className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-[var(--color-border-200)] last:border-0 hover:bg-[var(--color-surface-100)]"
 >
 <div className="min-w-0">
 <p className="font-medium text-[var(--mismo-text)]">
 {rowNum}. {memo.title}
 </p>
 <p className="text-xs text-[var(--mismo-text-secondary)] mt-0.5">
 {getMemoCategoryDisplay(memo)} · Published {formatDate(memo.effectiveDate)}
 {memo.completionDueDate && ` · Due ${formatDate(memo.completionDueDate)}`}
 </p>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 <Badge className={statusBadgeClass(status.tone)}>{status.label}</Badge>
 <Button size="sm" variant="outline" onClick={() => setOpenMemoId(memo.id)}>
 View memo
 </Button>
 </div>
 </li>
 );
 })}
 </ul>
 )}
 {filteredLibrary.length > PAGE_SIZE && (
 <div className="px-4 py-3 flex items-center justify-between border-t border-[var(--color-border-200)]">
 <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
 Prev
 </Button>
 <span className="text-sm text-[var(--mismo-text-secondary)]">
 Page {page} of {totalPages}
 </span>
 <Button
 type="button"
 variant="outline"
 size="sm"
 disabled={page >= totalPages}
 onClick={() => setPage((p) => p + 1)}
 >
 Next
 </Button>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Admin-managed resources by category */}
 {EMPLOYEE_RESOURCE_CATEGORIES.filter((c) => c.id !== 'REQUIRED_MEMO' && c.id !== 'EMERGENCY_HOTLINE').map((cat) => {
 const items = filteredResources.filter((r) => r.category === cat.id);
 if (items.length === 0) return null;
 return (
 <Card key={cat.id} className="mismo-card border border-[var(--color-border-200)]">
 <CardContent className="p-5">
 <h3 className="font-semibold text-[var(--mismo-text)]">{cat.label}</h3>
 <ul className="mt-3 space-y-2">
 {items.map((item) => (
 <li key={item.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[var(--color-border-200)] last:border-0 pb-2 last:pb-0">
 <div>
 <p className="font-medium text-[var(--mismo-text)]">{item.title}</p>
 {item.description && <p className="text-sm text-[var(--mismo-text-secondary)]">{item.description}</p>}
 </div>
 {item.url && (
 <a
 href={item.url}
 target="_blank"
 rel="noopener noreferrer"
 className="text-sm text-[var(--mismo-blue)] hover:underline shrink-0"
 >
 Open resource
 </a>
 )}
 </li>
 ))}
 </ul>
 </CardContent>
 </Card>
 );
 })}

 {/* Emergency hotlines */}
 {emergencyHotlines.filter((h) => h.status === 'PUBLISHED').length > 0 && (
 <Card className="mismo-card border-red-200">
 <CardContent className="p-6">
 <h3 className="font-semibold text-[var(--mismo-text)] text-lg">Emergency support hotlines</h3>
 <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">Available when you need immediate assistance</p>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
 {emergencyHotlines
 .filter((h) => h.status === 'PUBLISHED')
 .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
 .map((hotline) => (
 <a
 key={hotline.id}
 className="p-4 bg-red-50 border border-red-100 rounded-md hover:bg-red-100/80 transition-colors"
 href={hotline.phone === '988' ? 'tel:988' : `tel:${hotline.phone.replace(/\D/g, '')}`}
 >
 <p className="font-medium text-[var(--mismo-text)]">{hotline.name}</p>
 <p className="text-lg font-bold text-red-600 mt-1">{hotline.phone}</p>
 {hotline.description && (
 <p className="text-xs text-[var(--mismo-text-secondary)] mt-1">{hotline.description}</p>
 )}
 </a>
 ))}
 </div>
 </CardContent>
 </Card>
 )}
 </div>
 );
}
