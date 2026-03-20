import { useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { ReportCategory, ReportSeverity, ContactMethod } from '@/types';
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

const categories: { value: ReportCategory; label: string }[] = [
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'THEFT', label: 'Theft' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'DISCRIMINATION', label: 'Discrimination' },
  { value: 'WAGE_HOURS', label: 'Wage/Hours' },
  { value: 'RETALIATION', label: 'Retaliation' },
  { value: 'OTHER', label: 'Other' },
];

const severities: { value: ReportSeverity; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

const contactMethods: { value: ContactMethod; label: string }[] = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'IN_APP', label: 'In-app messaging' },
];

export function NewReport({ dataStore, onNavigate, initialParams }: NewReportProps) {
  const { currentUser, createReport, orgSettings } = dataStore;
  
  // Get query params
  const promptId = initialParams?.promptId;
  const deliveryId = initialParams?.deliveryId;
  
  // Form state
  const [category, setCategory] = useState<ReportCategory>('OTHER');
  const [severity, setSeverity] = useState<ReportSeverity>('MEDIUM');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [peopleInvolved, setPeopleInvolved] = useState('');
  const [location, setLocation] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [contactMethod, setContactMethod] = useState<ContactMethod>('EMAIL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!summary.trim() || !description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      createReport({
        createdByUserId: isAnonymous ? undefined : currentUser.id,
        isAnonymous,
        sourcePromptId: promptId || undefined,
        sourcePromptResponseId: deliveryId || undefined,
        category,
        severity,
        summary: summary.trim(),
        description: description.trim(),
        peopleInvolved: peopleInvolved.trim() || undefined,
        location: location.trim() || undefined,
        incidentAt: incidentDate ? new Date(incidentDate) : undefined,
        preferredContactMethod: isAnonymous ? undefined : contactMethod,
      });
      
      toast.success('Report submitted successfully');
      onNavigate('reports');
    } catch {
      toast.error('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="space-y-6 w-full min-h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="form-header">
        <button 
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 text-sm text-[var(--mismo-text-secondary)] hover:text-[var(--mismo-text)] mb-4"
        >
          <Icons.arrowLeft className="h-4 w-4" />
          Back to Home
        </button>
        <h1 className="text-2xl font-bold text-[var(--mismo-text)]">Open Case File</h1>
        <p className="text-[var(--mismo-text-secondary)] mt-1">
          Provide procedural details for compliance review. Entries are recorded in the audit log.
        </p>
      </div>

      <div className="border border-[var(--color-border-200)] bg-[var(--color-surface-100)] shadow-[var(--shadow-1)] p-4">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          Privacy notice: your report is kept as private as possible.
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
          Access is restricted to authorized reviewers, and if anonymous reporting is enabled your identity is not disclosed.
        </p>
      </div>
      
      {/* Form */}
      <Card className="form-card mismo-card w-full">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category & Severity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as ReportCategory)}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="severity">Severity *</Label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as ReportSeverity)}>
                  <SelectTrigger id="severity">
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    {severities.map((sev) => (
                      <SelectItem key={sev.value} value={sev.value}>
                        {sev.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Summary */}
            <div className="space-y-2">
              <Label htmlFor="summary">Summary *</Label>
              <Input
                id="summary"
                placeholder="Brief summary of the issue"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                maxLength={100}
              />
              <p className="text-xs text-[var(--mismo-text-secondary)]">
                {summary.length}/100 characters
              </p>
            </div>
            
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Provide detailed information about what happened..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
              />
            </div>
            
            {/* Additional Details */}
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <h3 className="font-medium text-[var(--mismo-text)]">Additional Details (Optional)</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="people">People Involved</Label>
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
                <Label htmlFor="incidentDate">Date of Incident</Label>
                <Input
                  id="incidentDate"
                  type="date"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                />
              </div>
            </div>
            
            {/* Anonymous & Contact */}
            <div className="space-y-4 pt-4 border-t border-gray-100">
              {orgSettings.allowAnonymousReports && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="anonymous" className="text-base">Submit Anonymously</Label>
                    <p className="text-sm text-[var(--mismo-text-secondary)]">
                      Your identity will not be revealed to investigators
                    </p>
                  </div>
                  <Switch
                    id="anonymous"
                    checked={isAnonymous}
                    onCheckedChange={setIsAnonymous}
                  />
                </div>
              )}
              
              {!isAnonymous && (
                <div className="space-y-2">
                  <Label htmlFor="contactMethod">Preferred Contact Method</Label>
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
            
            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onNavigate('home')}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[var(--mismo-blue)] hover:bg-blue-600"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Icons.refresh className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Icons.send className="h-4 w-4 mr-2" />
                    Open Case File
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
