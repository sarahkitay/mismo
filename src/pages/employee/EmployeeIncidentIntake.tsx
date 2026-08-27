import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { employeeIncidentReportHeadline, isIncidentIntakeComplete } from '@/lib/utils';
import { formatCaseReference } from '@/lib/caseTypes';
import { toast } from 'sonner';
import { PageMoreInfo } from '@/components/PageMoreInfo';

interface EmployeeIncidentIntakeProps {
  dataStore: DataStore;
  reportId: string;
  onNavigate: (page: string) => void;
}

function draftKey(reportId: string) {
  return `mismo_incident_intake_draft_${reportId}`;
}

export function EmployeeIncidentIntake({ dataStore, reportId, onNavigate }: EmployeeIncidentIntakeProps) {
  const { employeeReports, completeIncidentIntake } = dataStore;
  const report = employeeReports.find((r) => r.id === reportId);

  const [description, setDescription] = useState('');
  const [peopleInvolved, setPeopleInvolved] = useState('');
  const [location, setLocation] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const pendingNavRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!report) return;
    try {
      const raw = localStorage.getItem(draftKey(reportId));
      if (raw) {
        const draft = JSON.parse(raw) as { description?: string; peopleInvolved?: string; location?: string };
        setDescription(draft.description ?? report.description ?? '');
        setPeopleInvolved(draft.peopleInvolved ?? report.peopleInvolved ?? '');
        setLocation(draft.location ?? report.location ?? '');
      } else {
        setDescription(report.description ?? '');
        setPeopleInvolved(report.peopleInvolved ?? '');
        setLocation(report.location ?? '');
      }
    } catch {
      setDescription(report.description ?? '');
      setPeopleInvolved(report.peopleInvolved ?? '');
      setLocation(report.location ?? '');
    } finally {
      setHydrated(true);
    }
  }, [report, reportId]);

  const isDirty = useMemo(() => {
    if (!report || !hydrated) return false;
    return (
      description.trim() !== (report.description ?? '').trim() ||
      peopleInvolved.trim() !== (report.peopleInvolved ?? '').trim() ||
      location.trim() !== (report.location ?? '').trim()
    );
  }, [description, hydrated, location, peopleInvolved, report]);

  useEffect(() => {
    if (!hydrated || !report) return;
    localStorage.setItem(
      draftKey(reportId),
      JSON.stringify({ description, peopleInvolved, location, savedAt: new Date().toISOString() })
    );
  }, [description, hydrated, location, peopleInvolved, report, reportId]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const requestLeave = useCallback(
    (action: () => void) => {
      if (!isDirty) {
        action();
        return;
      }
      pendingNavRef.current = action;
      setUnsavedDialogOpen(true);
    },
    [isDirty]
  );

  if (!report) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--mismo-text-secondary)]">This incident report was not found on your account.</p>
        <Button variant="link" className="mt-2" onClick={() => onNavigate('reports')}>
          Back to My Reports
        </Button>
      </div>
    );
  }

  if (isIncidentIntakeComplete(report)) {
    return (
      <div className="space-y-4 max-w-xl">
        <Button variant="ghost" className="px-0" onClick={() => onNavigate(`report-detail/${report.id}`)}>
          <Icons.arrowLeft className="h-4 w-4 mr-2" />
          Back to report
        </Button>
        <Card className="mismo-card">
          <CardContent className="p-6">
            <p className="font-medium text-[var(--mismo-text)]">You&apos;re all set</p>
            <p className="text-sm text-[var(--mismo-text-secondary)] mt-2">
              Your incident documentation is already on file. HR may follow up by message or phone based on what you
              selected.
            </p>
            <Button className="mt-4" onClick={() => onNavigate(`report-detail/${report.id}`)}>
              View report
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Please describe what happened.');
      return;
    }
    try {
      const updated = await completeIncidentIntake(report.id, {
        description: description.trim(),
        peopleInvolved: peopleInvolved.trim() || undefined,
        location: location.trim() || undefined,
      });
      localStorage.removeItem(draftKey(reportId));
      toast.success(`Incident form submitted (${formatCaseReference(updated)}). HR has been notified.`);
      onNavigate(`report-detail/${report.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit. Please try again.');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Button variant="ghost" className="px-0" onClick={() => requestLeave(() => onNavigate('reports'))}>
        <Icons.arrowLeft className="h-4 w-4 mr-2" />
        Back to My Reports
      </Button>

      <div>
        <h1 className="text-2xl font-bold text-[var(--mismo-text)]">Incident questionnaire</h1>
        <PageMoreInfo>
          This is the secure link referenced in your receipt email. Complete the details below so your organization can
          open or continue the investigation without waiting on a separate form from HR. Your answers are saved on this
          device as you type.
        </PageMoreInfo>
      </div>

      <Card className="mismo-card border border-[var(--color-border-200)]">
        <CardContent className="p-6">
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Incident report reference</p>
          <p className="font-semibold text-[var(--mismo-text)] mt-1">{employeeIncidentReportHeadline(report)}</p>
          <p className="text-xs text-[var(--mismo-text-secondary)] mt-1 font-mono">
            Case reference: {formatCaseReference(report)} - use this ID in all correspondence with HR.
          </p>
          <p className="text-xs text-[var(--mismo-text-secondary)] mt-2">Submitted {report.createdAt.toLocaleString()}</p>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-5 border border-[var(--color-border-200)] bg-[var(--color-surface-100)] p-6 rounded-lg shadow-[var(--shadow-1)]">
        <div className="space-y-2">
          <Label htmlFor="intake-desc">What happened? (required)</Label>
          <Textarea
            id="intake-desc"
            rows={8}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Include dates, witnesses, and any prior conversations."
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="intake-people">People involved (optional)</Label>
          <Input id="intake-people" value={peopleInvolved} onChange={(e) => setPeopleInvolved(e.target.value)} placeholder="Names or roles" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="intake-loc">Location (optional)</Label>
          <Input id="intake-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Building, floor, or remote" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="bg-[var(--mismo-blue)] hover:bg-blue-600">
            Submit incident form
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => toast.success('Draft saved on this device. You can return anytime to finish.')}
          >
            Save progress
          </Button>
        </div>
      </form>

      <UnsavedChangesDialog
        open={unsavedDialogOpen}
        onOpenChange={setUnsavedDialogOpen}
        detail="Your incident form answers are saved on this device, but you have not submitted them to HR yet."
        onSave={() => {
          toast.success('Draft saved on this device.');
          setUnsavedDialogOpen(false);
          pendingNavRef.current?.();
          pendingNavRef.current = null;
        }}
        onDiscard={() => {
          localStorage.removeItem(draftKey(reportId));
          setUnsavedDialogOpen(false);
          pendingNavRef.current?.();
          pendingNavRef.current = null;
        }}
      />
    </div>
  );
}
