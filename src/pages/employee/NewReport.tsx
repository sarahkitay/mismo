import { useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { ContactMethod } from '@/types';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface NewReportProps {
  dataStore: DataStore;
  onNavigate: (page: string) => void;
  initialParams?: Record<string, string>;
}

const contactMethods: { value: ContactMethod; label: string }[] = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'IN_APP', label: 'In-app messaging' },
];

export function NewReport({ dataStore, onNavigate, initialParams }: NewReportProps) {
  const { currentUser, createReport, orgSettings } = dataStore;

  const promptId = initialParams?.promptId;
  const deliveryId = initialParams?.deliveryId;

  const [description, setDescription] = useState('');
  const [peopleInvolved, setPeopleInvolved] = useState('');
  const [location, setLocation] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [contactMethod, setContactMethod] = useState<ContactMethod>('EMAIL');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      createReport({
        createdByUserId: isAnonymous ? undefined : currentUser.id,
        isAnonymous,
        sourcePromptId: promptId || undefined,
        sourcePromptResponseId: deliveryId || undefined,
        category: 'OTHER',
        severity: 'LOW',
        summary: 'Incident report',
        description: description.trim(),
        peopleInvolved: peopleInvolved.trim() || undefined,
        location: location.trim() || undefined,
        incidentAt: incidentDate ? new Date(incidentDate) : undefined,
        preferredContactMethod: isAnonymous ? undefined : contactMethod,
      });
      toast.success('Incident report submitted');
      onNavigate('reports');
    } catch {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 w-full min-h-[calc(100vh-7rem)]">
      <div className="form-header">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 text-sm text-[var(--mismo-text-secondary)] hover:text-[var(--mismo-text)] mb-4"
        >
          <Icons.arrowLeft className="h-4 w-4" />
          Back to Home
        </button>
        <h1 className="text-2xl font-bold text-[var(--mismo-text)]">Incident report</h1>
        <p className="text-[var(--mismo-text-secondary)] mt-1">
          Tell us what you can. HR will review, assign a category, and assess severity. You do not need to classify the issue yourself.
        </p>
      </div>

      <div className="border border-[var(--color-border-200)] bg-[var(--color-surface-100)] shadow-[var(--shadow-1)] p-4">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">Privacy notice: your report is kept as private as possible.</p>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
          Access is restricted to authorized reviewers, and if anonymous reporting is enabled your identity is not disclosed.
        </p>
      </div>

      <Card className="form-card mismo-card w-full">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Anything you share helps HR understand the situation. You can leave this blank and add more later if needed."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
              />
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-100">
              <h3 className="font-medium text-[var(--mismo-text)]">Additional details (optional)</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="people">People involved</Label>
                  <Input
                    id="people"
                    placeholder="Names or descriptions"
                    value={peopleInvolved}
                    onChange={(e) => setPeopleInvolved(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="Where did this occur?"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="incidentDate">Date of incident</Label>
                <Input id="incidentDate" type="date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-100">
              {orgSettings.allowAnonymousReports && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="anonymous" className="text-base">
                      Submit anonymously
                    </Label>
                    <p className="text-sm text-[var(--mismo-text-secondary)]">Your identity will not be revealed to investigators</p>
                  </div>
                  <Switch id="anonymous" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                </div>
              )}

              {!isAnonymous && (
                <div className="space-y-2">
                  <Label htmlFor="contactMethod">Preferred contact method</Label>
                  <Select value={contactMethod} onValueChange={(v) => setContactMethod(v as ContactMethod)}>
                    <SelectTrigger id="contactMethod">
                      <SelectValue placeholder="Select contact method" />
                    </SelectTrigger>
                    <SelectContent>
                      {contactMethods.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onNavigate('home')} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 bg-[var(--mismo-blue)] hover:bg-blue-600" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Icons.refresh className="h-4 w-4 mr-2 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Icons.send className="h-4 w-4 mr-2" />
                    Submit incident report
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
