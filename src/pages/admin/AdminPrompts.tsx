import { useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  formatDate, 
  getPromptTypeLabel,
  truncateText 
} from '@/lib/utils';
import type { PromptType, PromptCadence, PromptAudience, ReportSeverity, Prompt } from '@/types';
import {
 CORE_FINANCIAL_DESCRIPTION,
 CORE_FINANCIAL_LABEL,
 isLockedCorePrompt,
 isOptionalPrompt,
} from '@/lib/corePrompts';
import { toast } from 'sonner';

interface AdminPromptsProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  initialFilters?: Record<string, string>;
}

const promptTypes: { value: PromptType; label: string }[] = [
  { value: 'TEAM_DYNAMIC', label: 'Team Dynamic Check-In' },
  { value: 'MONTHLY_CHECKIN', label: 'Monthly Health Check' },
  { value: 'CUSTOM', label: 'Company-made' },
];

const cadenceOptions: { value: PromptCadence; label: string }[] = [
  { value: 'ONCE', label: 'One-time' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
];

const audienceOptions: { value: PromptAudience; label: string }[] = [
  { value: 'ALL', label: 'All Employees' },
  { value: 'DEPARTMENT', label: 'Specific Departments' },
  { value: 'USER_LIST', label: 'Specific Users' },
];

const severityOptions: { value: ReportSeverity; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

export function AdminPrompts({ dataStore, onNavigate, initialFilters }: AdminPromptsProps) {
  const { prompts, deliveries, createPrompt, updatePrompt, departments } = dataStore;
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [viewPromptId, setViewPromptId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'SCHEDULED' | 'DRAFT'>(
    (initialFilters?.filter?.toUpperCase() as 'ALL' | 'ACTIVE' | 'INACTIVE' | 'SCHEDULED' | 'DRAFT') ?? 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [newPrompt, setNewPrompt] = useState({
    type: 'CUSTOM' as PromptType,
    title: '',
    description: '',
    cadence: 'ONCE' as PromptCadence,
    audience: 'ALL' as PromptAudience,
    departmentIds: [] as string[],
    severityOnHasIssue: 'MEDIUM' as ReportSeverity,
    allowAnonymousReports: true,
    includeFinancialQuestion: false,
    startAt: '',
    endAt: '',
  });
  
  const coreIncidentPrompt = prompts.find((p) => p.type === 'INCIDENT');
  const optionalPrompts = prompts.filter((p) => isOptionalPrompt(p));

  const matchesPromptFilter = (prompt: Prompt) => {
    const matchesFilter =
      filter === 'ALL' ||
      (filter === 'ACTIVE' && (prompt.status === 'ACTIVE' || prompt.status === 'SCHEDULED')) ||
      (filter === 'INACTIVE' && prompt.status === 'ARCHIVED') ||
      (filter === 'SCHEDULED' && prompt.status === 'SCHEDULED') ||
      (filter === 'DRAFT' && prompt.status === 'DRAFT');

    const matchesSearch =
      searchQuery === '' ||
      prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  };

  const filteredOptionalPrompts = optionalPrompts.filter(matchesPromptFilter);
  const showCoreSection =
    coreIncidentPrompt &&
    (filter === 'ALL' || filter === 'ACTIVE' || filter === 'SCHEDULED') &&
    (!searchQuery || matchesPromptFilter(coreIncidentPrompt));
  const coreTemplateCount = 2;
  const customTemplateCount = optionalPrompts.length;

  const setPromptActive = (prompt: Prompt, active: boolean) => {
    if (isLockedCorePrompt(prompt)) {
      toast.message('Incident Query and financial follow-up stay on for daily compliance.');
      return;
    }
    updatePrompt(prompt.id, { status: active ? 'ACTIVE' : 'ARCHIVED' });
    toast.success(active ? 'Prompt activated' : 'Prompt set to inactive');
  };

  const renderPromptCard = (prompt: Prompt, options?: { locked?: boolean; subtitle?: string }) => {
    const stats = getPromptStats(prompt.id);
    const locked = options?.locked ?? isLockedCorePrompt(prompt);
    const isActive = prompt.status === 'ACTIVE' || prompt.status === 'SCHEDULED';

    return (
      <Card key={prompt.id} className="prompt-card mismo-card relative overflow-hidden">
        {isActive && (
          <div className="absolute top-3 left-4 z-10 pointer-events-none">
            <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[var(--color-emerald-600)] [text-shadow:0_1px_2px_rgba(15,27,42,0.22)]">
              Active
            </p>
          </div>
        )}
        <CardContent className="p-5">
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--mismo-blue-light)] flex items-center justify-center flex-shrink-0">
              <Icons.message className="h-6 w-6 text-[var(--mismo-blue)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {locked ? (
                  <Badge variant="outline" className="border-[var(--color-primary-700)]">Core</Badge>
                ) : prompt.type === 'CUSTOM' ? (
                  <Badge variant="outline">Company-made</Badge>
                ) : (
                  <Badge variant="outline">{getPromptTypeLabel(prompt.type)}</Badge>
                )}
                {!isActive && !locked && <Badge className="status-chip status-chip--neutral">Inactive</Badge>}
                {prompt.type === 'INCIDENT' ? (
                  <Badge variant="outline">{getPromptTypeLabel(prompt.type)}</Badge>
                ) : null}
                {prompt.includeFinancialQuestion ? (
                  <Badge variant="outline" className="border-[var(--color-primary-700)] text-[var(--color-primary-800)]">
                    Financial follow-up
                  </Badge>
                ) : null}
              </div>
              <h3 className="font-semibold text-[var(--mismo-text)] text-lg">{prompt.title}</h3>
              {options?.subtitle ? (
                <p className="text-sm text-[var(--color-primary-800)] mt-1 font-medium">{options.subtitle}</p>
              ) : null}
              <p className="text-[var(--mismo-text-secondary)] mt-1">{truncateText(prompt.description, 120)}</p>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                <span className="text-[var(--mismo-text-secondary)]">
                  <span className="font-medium text-[var(--mismo-text)]">{stats.total}</span> recipients
                </span>
                <span className="text-[var(--mismo-text-secondary)]">
                  <span className="font-medium text-green-600">{stats.completed}</span> completed
                </span>
                <span className="text-[var(--mismo-text-secondary)]">
                  <span className="font-medium text-amber-600">{stats.pending}</span> pending
                </span>
                <span className="text-[var(--mismo-text-secondary)]">
                  <span className="font-medium text-[var(--mismo-blue)]">{Math.round(stats.completionRate)}%</span> completion
                </span>
              </div>
              <div className="mt-3">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--mismo-blue)] rounded-full transition-all" style={{ width: `${stats.completionRate}%` }} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-[var(--mismo-text-secondary)]">
                <span className="flex items-center gap-1.5">
                  <Icons.calendar className="h-4 w-4" />
                  Daily · started {formatDate(prompt.schedule.startAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Icons.employees className="h-4 w-4" />
                  {audienceOptions.find((a) => a.value === prompt.targeting.audience)?.label ?? prompt.targeting.audience}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Label htmlFor={`active-${prompt.id}`} className="text-sm text-[var(--mismo-text-secondary)]">
                  {locked ? 'Always on' : isActive ? 'Active' : 'Inactive'}
                </Label>
                <Switch
                  id={`active-${prompt.id}`}
                  checked={locked ? true : isActive}
                  disabled={locked}
                  onCheckedChange={(checked) => setPromptActive(prompt, checked)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setViewPromptId(prompt.id)}>
                  <Icons.eye className="h-4 w-4 mr-1.5" />
                  View
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };
  
  // Get prompt stats
  const getPromptStats = (promptId: string) => {
    const promptDeliveries = deliveries.filter(d => d.promptId === promptId);
    const total = promptDeliveries.length;
    const completed = promptDeliveries.filter(d => d.status === 'COMPLETED').length;
    const pending = promptDeliveries.filter(d => d.status === 'PENDING').length;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;
    
    return { total, completed, pending, completionRate };
  };
  
  // Handle create prompt
  const handleCreatePrompt = () => {
    if (!newPrompt.title.trim() || !newPrompt.description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    createPrompt({
      type: newPrompt.type,
      title: newPrompt.title,
      description: newPrompt.description,
      schedule: {
        cadence: newPrompt.cadence,
        startAt: newPrompt.startAt ? new Date(newPrompt.startAt) : new Date(),
        endAt: newPrompt.endAt ? new Date(newPrompt.endAt) : undefined,
      },
      targeting: {
        audience: newPrompt.audience,
        departmentIds: newPrompt.audience === 'DEPARTMENT' ? newPrompt.departmentIds : undefined,
      },
      severityOnHasIssue: newPrompt.severityOnHasIssue,
      allowAnonymousReports: newPrompt.allowAnonymousReports,
      includeFinancialQuestion: newPrompt.includeFinancialQuestion,
      status: 'ACTIVE',
    });
    
    toast.success('Prompt created successfully');
    setIsCreateDialogOpen(false);
    setNewPrompt({
      type: 'CUSTOM',
      title: '',
      description: '',
      cadence: 'ONCE',
      audience: 'ALL',
      departmentIds: [],
      severityOnHasIssue: 'MEDIUM',
      allowAnonymousReports: true,
      includeFinancialQuestion: false,
      startAt: '',
      endAt: '',
    });
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="prompts-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--mismo-text)]">Prompts</h1>
          <p className="text-[var(--mismo-text-secondary)] mt-1">
            Create and manage employee check-in prompts
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[var(--mismo-blue)] hover:bg-blue-600">
              <Icons.add className="h-4 w-4 mr-2" />
              Create Prompt
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Prompt</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Prompt Type</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {promptTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setNewPrompt((prev) => ({ ...prev, type: type.value }))}
                      className={`px-3 py-2 text-sm text-left border enterprise-interactive ${
                        newPrompt.type === type.value
                          ? 'bg-[var(--color-primary-900)] text-white border-[var(--color-primary-900)]'
                          : 'bg-[var(--color-surface-100)] text-[var(--color-text-primary)] border-[var(--color-border-200)]'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={newPrompt.title}
                  onChange={(e) => setNewPrompt(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Monthly Safety Check-In"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newPrompt.description}
                  onChange={(e) => setNewPrompt(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this prompt is about..."
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Schedule</Label>
                  <Select 
                    value={newPrompt.cadence} 
                    onValueChange={(v) => setNewPrompt(prev => ({ ...prev, cadence: v as PromptCadence }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {cadenceOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Select 
                    value={newPrompt.audience} 
                    onValueChange={(v) => setNewPrompt(prev => ({ ...prev, audience: v as PromptAudience }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {audienceOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {newPrompt.audience === 'DEPARTMENT' && (
                <div className="space-y-2">
                  <Label>Select Departments</Label>
                  <div className="flex flex-wrap gap-2">
                    {departments.map(dept => (
                      <button
                        key={dept.id}
                        onClick={() => {
                          setNewPrompt(prev => ({
                            ...prev,
                            departmentIds: prev.departmentIds.includes(dept.id)
                              ? prev.departmentIds.filter(id => id !== dept.id)
                              : [...prev.departmentIds, dept.id]
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          newPrompt.departmentIds.includes(dept.id)
                            ? 'bg-[var(--mismo-blue)] text-white'
                            : 'bg-gray-100 text-[var(--mismo-text-secondary)] hover:bg-gray-200'
                        }`}
                      >
                        {dept.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Severity if Issue Reported</Label>
                <Select 
                  value={newPrompt.severityOnHasIssue} 
                  onValueChange={(v) => setNewPrompt(prev => ({ ...prev, severityOnHasIssue: v as ReportSeverity }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {severityOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Anonymous Reports</Label>
                  <p className="text-sm text-[var(--mismo-text-secondary)]">
                    Employees can submit reports anonymously
                  </p>
                </div>
                <Switch
                  checked={newPrompt.allowAnonymousReports}
                  onCheckedChange={(v) => setNewPrompt(prev => ({ ...prev, allowAnonymousReports: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Financial screening question</Label>
                  <p className="text-sm text-[var(--mismo-text-secondary)]">
                    After the main check-in answer, employees see one follow-up about pay, bonuses, reimbursements, and benefits before the
                    response is saved.
                  </p>
                </div>
                <Switch
                  checked={newPrompt.includeFinancialQuestion}
                  onCheckedChange={(v) => setNewPrompt((prev) => ({ ...prev, includeFinancialQuestion: v }))}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={newPrompt.startAt}
                    onChange={(e) => setNewPrompt(prev => ({ ...prev, startAt: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date (Optional)</Label>
                  <Input
                    type="date"
                    value={newPrompt.endAt}
                    onChange={(e) => setNewPrompt(prev => ({ ...prev, endAt: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-[var(--mismo-blue)] hover:bg-blue-600"
                  onClick={handleCreatePrompt}
                >
                  Create Prompt
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Status Filter */}
        <div className="flex gap-2">
          {(['ALL', 'ACTIVE', 'INACTIVE', 'SCHEDULED', 'DRAFT'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-[var(--mismo-blue)] text-white'
                  : 'bg-white text-[var(--mismo-text-secondary)] hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      
      {/* Prompts List */}
      <div className="space-y-4">
        <Card className="mismo-card">
          <CardContent className="p-4 flex flex-wrap gap-3">
            <span className="text-sm px-3 py-2 border">Core (built-in) prompts: {coreTemplateCount}</span>
            <span className="text-sm px-3 py-2 border">Company-made prompts: {customTemplateCount}</span>
          </CardContent>
        </Card>

        {showCoreSection && coreIncidentPrompt && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              Core daily check-in (always on)
            </h2>
            {renderPromptCard(coreIncidentPrompt, { locked: true })}
            <Card className="mismo-card border border-[var(--color-primary-700)]/30">
              <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant="outline" className="border-[var(--color-primary-700)]">Core</Badge>
                    <Badge variant="outline" className="border-[var(--color-primary-700)] text-[var(--color-primary-800)]">
                      Financial follow-up
                    </Badge>
                    <Badge variant="outline">Money</Badge>
                  </div>
                  <h3 className="font-semibold text-lg">{CORE_FINANCIAL_LABEL}</h3>
                  <p className="text-sm text-[var(--mismo-text-secondary)] mt-2">{CORE_FINANCIAL_DESCRIPTION}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-2">
                    Bundled with Incident Query. Runs as question 2 of 2 before the check-in is saved.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Label className="text-sm text-[var(--mismo-text-secondary)]">Always on</Label>
                  <Switch checked disabled />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Optional prompts
          </h2>
          {filteredOptionalPrompts.map((prompt) => renderPromptCard(prompt))}
        </div>

        {filteredOptionalPrompts.length === 0 && !showCoreSection && filter !== 'ALL' && (
          <Card className="mismo-card">
            <CardContent className="p-12 text-center">
              <Icons.message className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[var(--mismo-text)] mb-2">
                No prompts found
              </h3>
              <p className="text-[var(--mismo-text-secondary)] mb-4">
                Create your first prompt to start collecting employee feedback
              </p>
              <Button 
                className="bg-[var(--mismo-blue)] hover:bg-blue-600"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Icons.add className="h-4 w-4 mr-2" />
                Create Prompt
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* View prompt detail dialog */}
      <Dialog open={!!viewPromptId} onOpenChange={(open) => !open && setViewPromptId(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {viewPromptId && (() => {
            const prompt = prompts.find((p) => p.id === viewPromptId);
            if (!prompt) return null;
            const stats = getPromptStats(prompt.id);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="pr-8">{prompt.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {prompt.type === 'CUSTOM' ? (
                      <Badge variant="outline">Company-made</Badge>
                    ) : (
                      <>
                        <Badge variant="outline">Core</Badge>
                        <Badge variant="outline">{getPromptTypeLabel(prompt.type)}</Badge>
                      </>
                    )}
                    <Badge className={
                      prompt.status === 'ACTIVE' ? 'status-chip status-chip--success' :
                      prompt.status === 'SCHEDULED' ? 'status-chip status-chip--info' :
                      prompt.status === 'DRAFT' ? 'status-chip status-chip--neutral' :
                      'status-chip status-chip--neutral'
                    }>
                      {prompt.status}
                    </Badge>
                    {prompt.includeFinancialQuestion ? (
                      <Badge variant="outline" className="border-[var(--color-primary-700)] text-[var(--color-primary-800)]">
                        Financial follow-up
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-[var(--mismo-text-secondary)]">{prompt.description}</p>
                  <p className="text-sm text-[var(--mismo-text-secondary)]">
                    <span className="font-medium text-[var(--mismo-text)]">Pay and compensation screening: </span>
                    {prompt.includeFinancialQuestion
                      ? 'Employees answer this after their main check-in response, before the check-in is saved.'
                      : 'Not enabled for this prompt.'}
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[var(--mismo-text-muted)]">Cadence</p>
                      <p className="font-medium">{cadenceOptions.find((c) => c.value === prompt.schedule.cadence)?.label ?? prompt.schedule.cadence}</p>
                    </div>
                    <div>
                      <p className="text-[var(--mismo-text-muted)]">Audience</p>
                      <p className="font-medium">{audienceOptions.find((a) => a.value === prompt.targeting.audience)?.label ?? prompt.targeting.audience}</p>
                    </div>
                    <div>
                      <p className="text-[var(--mismo-text-muted)]">Started</p>
                      <p className="font-medium">{formatDate(prompt.schedule.startAt)}</p>
                    </div>
                    {prompt.schedule.endAt && (
                      <div>
                        <p className="text-[var(--mismo-text-muted)]">Ends</p>
                        <p className="font-medium">{formatDate(prompt.schedule.endAt)}</p>
                      </div>
                    )}
                  </div>
                  <div className="border-t pt-3">
                    <p className="text-xs text-[var(--mismo-text-muted)] mb-2">Delivery stats</p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span><span className="font-medium text-[var(--mismo-text)]">{stats.total}</span> recipients</span>
                      <span><span className="font-medium text-green-600">{stats.completed}</span> completed</span>
                      <span><span className="font-medium text-amber-600">{stats.pending}</span> pending</span>
                      <span><span className="font-medium text-[var(--mismo-blue)]">{Math.round(stats.completionRate)}%</span> completion</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-[var(--mismo-blue)] rounded-full" style={{ width: `${stats.completionRate}%` }} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => { setViewPromptId(null); onNavigate('prompt-responses'); }}>
                      View responses
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setViewPromptId(null)}>Close</Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
