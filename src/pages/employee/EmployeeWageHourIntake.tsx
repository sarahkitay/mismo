import { useRef, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { WageHourAttachment, WageHourIssueType, WageHourPreferredResolution } from '@/types';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import {
 formatCaseReference,
 WAGE_HOUR_CONFIRMATION_MESSAGE,
 WAGE_HOUR_ISSUE_LABELS,
 WAGE_HOUR_RESOLUTION_LABELS,
} from '@/lib/caseTypes';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

interface EmployeeWageHourIntakeProps {
 dataStore: DataStore;
 reportId: string;
 onNavigate: (page: string) => void;
}

const ISSUE_TYPES = Object.keys(WAGE_HOUR_ISSUE_LABELS) as WageHourIssueType[];

function readAttachment(file: File): Promise<WageHourAttachment | null> {
 return new Promise((resolve) => {
 if (file.size > 5_000_000) {
 toast.error('Each file must be under 5 MB.');
 resolve(null);
 return;
 }
 const reader = new FileReader();
 reader.onload = () => {
 resolve({
 id: `wh-att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
 fileName: file.name,
 mimeType: file.type || 'application/octet-stream',
 dataUrl: typeof reader.result === 'string' ? reader.result : '',
 uploadedAt: new Date(),
 });
 };
 reader.onerror = () => resolve(null);
 reader.readAsDataURL(file);
 });
}

export function EmployeeWageHourIntake({ dataStore, reportId, onNavigate }: EmployeeWageHourIntakeProps) {
 const { employeeReports, completeWageHourIntake } = dataStore;
 const report = employeeReports.find((r) => r.id === reportId);
 const fileRef = useRef<HTMLInputElement>(null);

 const [issueTypes, setIssueTypes] = useState<WageHourIssueType[]>(report?.wageHourIntake?.issueTypes ?? []);
 const [concernDescription, setConcernDescription] = useState(report?.wageHourIntake?.concernDescription ?? '');
 const [payPeriods, setPayPeriods] = useState(report?.wageHourIntake?.payPeriods ?? '');
 const [approximateDates, setApproximateDates] = useState(report?.wageHourIntake?.approximateDates ?? '');
 const [managerInvolved, setManagerInvolved] = useState(report?.wageHourIntake?.managerInvolved ?? '');
 const [departmentLocation, setDepartmentLocation] = useState(report?.wageHourIntake?.departmentLocation ?? '');
 const [amountDisputed, setAmountDisputed] = useState(report?.wageHourIntake?.amountDisputed ?? '');
 const [preferredResolution, setPreferredResolution] = useState<WageHourPreferredResolution | ''>(
 report?.wageHourIntake?.preferredResolution ?? ''
 );
 const [attachments, setAttachments] = useState<WageHourAttachment[]>(report?.wageHourIntake?.attachments ?? []);
 const [submitted, setSubmitted] = useState(Boolean(report?.wageHourIntakeCompletedAt));

 if (!report || report.caseType !== 'WAGE_HOUR') {
 return (
 <div className="text-center py-12">
 <p className="text-[var(--mismo-text-secondary)]">This wage &amp; hour report was not found.</p>
 <Button variant="link" className="mt-2" onClick={() => onNavigate('reports')}>Back to My Reports</Button>
 </div>
 );
 }

 const toggleIssue = (type: WageHourIssueType) => {
 setIssueTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
 };

 const handleFiles = async (files: FileList | null) => {
 if (!files?.length) return;
 const next: WageHourAttachment[] = [];
 for (const file of Array.from(files)) {
 const att = await readAttachment(file);
 if (att) next.push(att);
 }
 if (next.length) setAttachments((prev) => [...prev, ...next]);
 };

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!issueTypes.length) {
 toast.error('Select at least one issue type.');
 return;
 }
 if (!concernDescription.trim()) {
 toast.error('Please describe your concern.');
 return;
 }
 completeWageHourIntake(reportId, {
 issueTypes,
 concernDescription: concernDescription.trim(),
 payPeriods: payPeriods.trim() || undefined,
 approximateDates: approximateDates.trim() || undefined,
 managerInvolved: managerInvolved.trim() || undefined,
 departmentLocation: departmentLocation.trim() || undefined,
 amountDisputed: amountDisputed.trim() || undefined,
 preferredResolution: preferredResolution || undefined,
 attachments,
 });
 setSubmitted(true);
 toast.success('Your wage & hour concern has been securely submitted.');
 };

 if (submitted || report.wageHourIntakeCompletedAt) {
 const ref = formatCaseReference(report);
 return (
 <div className="space-y-6 max-w-2xl">
 <Card className="mismo-card border-2 border-emerald-200 bg-emerald-50/40">
 <CardContent className="p-6 sm:p-8 space-y-4">
 <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
 <Icons.check className="h-6 w-6 text-emerald-800" />
 </div>
 <h1 className="text-xl font-bold text-[var(--mismo-text)]">Submission confirmed</h1>
 <p className="text-sm text-[var(--mismo-text-secondary)] leading-relaxed">{WAGE_HOUR_CONFIRMATION_MESSAGE}</p>
 <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm border border-[var(--color-border-200)] bg-white p-4">
 <div>
 <dt className="text-xs text-[var(--color-text-muted)] uppercase">Case ID</dt>
 <dd className="font-semibold font-mono mt-0.5">{ref}</dd>
 </div>
 <div>
 <dt className="text-xs text-[var(--color-text-muted)] uppercase">Submitted</dt>
 <dd className="font-medium mt-0.5">{formatDate(report.wageHourIntakeCompletedAt ?? new Date())}</dd>
 </div>
 <div>
 <dt className="text-xs text-[var(--color-text-muted)] uppercase">Status</dt>
 <dd className="font-medium mt-0.5">Pending wage &amp; hour review</dd>
 </div>
 <div>
 <dt className="text-xs text-[var(--color-text-muted)] uppercase">Next steps</dt>
 <dd className="mt-0.5 text-[var(--mismo-text-secondary)]">HR/compliance will review and contact you if needed.</dd>
 </div>
 </dl>
 <div className="flex flex-wrap gap-2 pt-2">
 <Button onClick={() => onNavigate(`report-detail/${report.id}`)}>View case status</Button>
 <Button variant="outline" onClick={() => onNavigate('home')}>Return to dashboard</Button>
 </div>
 </CardContent>
 </Card>
 </div>
 );
 }

 return (
 <div className="space-y-6 max-w-3xl pb-10">
 <Button variant="ghost" className="px-0" onClick={() => onNavigate('wage-hour-report')}>
 <Icons.arrowLeft className="h-4 w-4 mr-2" />
 Back to screening
 </Button>

 <div>
 <p className="text-xs font-mono text-[var(--color-text-muted)]">{formatCaseReference(report)}</p>
 <h1 className="text-2xl font-bold text-[var(--mismo-text)] mt-1">Wage &amp; hour intake</h1>
 <p className="text-sm text-[var(--mismo-text-secondary)] mt-2">
 Complete the sections below. You may save progress by submitting when ready - all fields are stored securely for compliance review.
 </p>
 </div>

 <form onSubmit={handleSubmit} className="space-y-6">
 <Card className="mismo-card border border-[var(--color-border-200)]">
 <CardContent className="p-5 sm:p-6 space-y-4">
 <h2 className="font-semibold text-[var(--mismo-text)]">1. Issue type</h2>
 <p className="text-sm text-[var(--mismo-text-secondary)]">Select all that apply.</p>
 <div className="flex flex-wrap gap-2">
 {ISSUE_TYPES.map((type) => (
 <button
 key={type}
 type="button"
 onClick={() => toggleIssue(type)}
 className={`text-sm px-3 py-1.5 border transition-colors ${
 issueTypes.includes(type)
 ? 'border-[var(--color-primary-900)] bg-[var(--color-primary-900)]/5 font-medium'
 : 'border-[var(--color-border-200)] hover:border-[var(--color-primary-700)]'
 }`}
 >
 {WAGE_HOUR_ISSUE_LABELS[type]}
 </button>
 ))}
 </div>
 </CardContent>
 </Card>

 <Card className="mismo-card border border-[var(--color-border-200)]">
 <CardContent className="p-5 sm:p-6 space-y-4">
 <h2 className="font-semibold text-[var(--mismo-text)]">2. Incident details</h2>
 <div className="space-y-2">
 <Label htmlFor="wh-desc">Describe your concern (required)</Label>
 <Textarea id="wh-desc" rows={5} value={concernDescription} onChange={(e) => setConcernDescription(e.target.value)} placeholder="Explain what happened, what you expected, and what differs from your records or policy." required />
 </div>
 <div className="grid sm:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="wh-periods">Relevant pay period(s)</Label>
 <Input id="wh-periods" value={payPeriods} onChange={(e) => setPayPeriods(e.target.value)} placeholder="e.g. Jan 1-15, 2026" />
 </div>
 <div className="space-y-2">
 <Label htmlFor="wh-dates">Approximate date(s)</Label>
 <Input id="wh-dates" value={approximateDates} onChange={(e) => setApproximateDates(e.target.value)} placeholder="When did this occur?" />
 </div>
 <div className="space-y-2">
 <Label htmlFor="wh-manager">Manager involved (if applicable)</Label>
 <Input id="wh-manager" value={managerInvolved} onChange={(e) => setManagerInvolved(e.target.value)} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="wh-dept">Department / location</Label>
 <Input id="wh-dept" value={departmentLocation} onChange={(e) => setDepartmentLocation(e.target.value)} />
 </div>
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="wh-amount">Amount disputed (optional)</Label>
 <Input id="wh-amount" value={amountDisputed} onChange={(e) => setAmountDisputed(e.target.value)} placeholder="Approximate dollar amount, if known" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="mismo-card border border-[var(--color-border-200)]">
 <CardContent className="p-5 sm:p-6 space-y-4">
 <h2 className="font-semibold text-[var(--mismo-text)]">3. Supporting documents</h2>
 <p className="text-sm text-[var(--mismo-text-secondary)]">Paystubs, schedules, timecards, screenshots, emails, or PDFs.</p>
 <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { void handleFiles(e.target.files); e.target.value = ''; }} />
 <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>Upload files</Button>
 {attachments.length > 0 && (
 <ul className="text-sm space-y-1 border border-[var(--color-border-200)] p-3 bg-[var(--color-surface-100)]">
 {attachments.map((a) => (
 <li key={a.id} className="flex justify-between gap-2">
 <span>{a.fileName}</span>
 <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}>Remove</button>
 </li>
 ))}
 </ul>
 )}
 </CardContent>
 </Card>

 <Card className="mismo-card border border-[var(--color-border-200)]">
 <CardContent className="p-5 sm:p-6 space-y-4">
 <h2 className="font-semibold text-[var(--mismo-text)]">4. Your preference (optional)</h2>
 <Label htmlFor="wh-pref">How would you prefer this concern be addressed?</Label>
 <Select value={preferredResolution || undefined} onValueChange={(v) => setPreferredResolution(v as WageHourPreferredResolution)}>
 <SelectTrigger id="wh-pref"><SelectValue placeholder="Select if you have a preference" /></SelectTrigger>
 <SelectContent>
 {(Object.keys(WAGE_HOUR_RESOLUTION_LABELS) as WageHourPreferredResolution[]).map((k) => (
 <SelectItem key={k} value={k}>{WAGE_HOUR_RESOLUTION_LABELS[k]}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </CardContent>
 </Card>

 <div className="flex flex-col sm:flex-row gap-3">
 <Button type="button" variant="outline" className="flex-1" onClick={() => onNavigate('home')}>Cancel (save draft on device)</Button>
 <Button type="submit" className="flex-1 bg-[var(--color-primary-900)] hover:bg-[var(--color-primary-700)]">
 Submit concern securely
 </Button>
 </div>
 </form>
 </div>
 );
}
