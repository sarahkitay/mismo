import { useEffect, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface AdminSettingsProps {
  dataStore: DataStore;
}

export function AdminSettings({ dataStore }: AdminSettingsProps) {
  const {
    orgSettings,
    departments,
    users,
    createDepartment,
    updateDepartment,
    deleteDepartment,
  } = dataStore;
  const aiPrefKey = 'mismo-admin-ai-options';

  const [settings, setSettings] = useState({
    allowAnonymousReports: orgSettings.allowAnonymousReports,
    enableSMS: orgSettings.enableSMS,
    enableEmail: orgSettings.enableEmail,
    showRecentActivityOnDashboard: orgSettings.showRecentActivityOnDashboard,
    showReportsRequiringAttentionOnDashboard: orgSettings.showReportsRequiringAttentionOnDashboard,
    atRiskNoResponseDays: orgSettings.thresholds.atRiskNoResponseDays,
    atRiskMinResponseRate: Math.round(orgSettings.thresholds.atRiskMinResponseRate * 100),
    criticalSLAHours: orgSettings.thresholds.criticalSLAHours,
    lcmToneBackup: true,
    enableAiAfterDeploy: false,
    showAiGuideOption: true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [editingDepartmentName, setEditingDepartmentName] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(aiPrefKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setSettings((prev) => ({
        ...prev,
        lcmToneBackup: parsed.lcmToneBackup ?? prev.lcmToneBackup,
        enableAiAfterDeploy: parsed.enableAiAfterDeploy ?? prev.enableAiAfterDeploy,
        showAiGuideOption: parsed.showAiGuideOption ?? prev.showAiGuideOption,
      }));
    } catch {
      // ignore malformed stored preferences
    }
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    localStorage.setItem(
      aiPrefKey,
      JSON.stringify({
        lcmToneBackup: settings.lcmToneBackup,
        enableAiAfterDeploy: settings.enableAiAfterDeploy,
        showAiGuideOption: settings.showAiGuideOption,
      })
    );
    toast.success('Settings saved successfully');
    setIsSaving(false);
  };

  const sortedDepartments = [...departments].sort((a, b) => a.name.localeCompare(b.name));

  const employeeCountByDepartment = (departmentId: string) =>
    users.filter((u) => u.departmentId === departmentId).length;

  const handleAddDepartment = () => {
    const result = createDepartment(newDepartmentName);
    if ('error' in result) {
      setDepartmentError(result.error);
      return;
    }
    setNewDepartmentName('');
    setDepartmentError(null);
    toast.success(`Department "${result.name}" added.`);
  };

  const startEditDepartment = (id: string, name: string) => {
    setEditingDepartmentId(id);
    setEditingDepartmentName(name);
    setDepartmentError(null);
  };

  const cancelEditDepartment = () => {
    setEditingDepartmentId(null);
    setEditingDepartmentName('');
    setDepartmentError(null);
  };

  const handleSaveDepartment = () => {
    if (!editingDepartmentId) return;
    const result = updateDepartment(editingDepartmentId, editingDepartmentName);
    if (!result) return;
    if ('error' in result) {
      setDepartmentError(result.error);
      return;
    }
    toast.success(`Department renamed to "${result.name}".`);
    cancelEditDepartment();
  };

  const handleDeleteDepartment = (id: string, name: string) => {
    const assigned = employeeCountByDepartment(id);
    const confirmed = window.confirm(
      assigned > 0
        ? `Remove "${name}"? ${assigned} employee${assigned === 1 ? '' : 's'} will be moved to Unassigned.`
        : `Remove department "${name}"?`
    );
    if (!confirmed) return;
    deleteDepartment(id);
    if (editingDepartmentId === id) cancelEditDepartment();
    toast.success(`Department "${name}" removed.`);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="settings-header">
        <h1 className="text-2xl font-bold text-[var(--mismo-text)]">Settings</h1>
        <p className="text-[var(--mismo-text-secondary)] mt-1">
          Configure organization settings and preferences
        </p>
      </div>

      <Card className="settings-card mismo-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icons.building className="h-5 w-5 text-[var(--mismo-blue)]" />
            Departments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[var(--mismo-text-secondary)]">
            Departments appear in employee add/edit and directory filters. Keep names unique.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={newDepartmentName}
              onChange={(e) => {
                setNewDepartmentName(e.target.value);
                setDepartmentError(null);
              }}
              placeholder="New department name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddDepartment();
                }
              }}
            />
            <Button type="button" onClick={handleAddDepartment} className="shrink-0">
              <Icons.add className="h-4 w-4 mr-2" />
              Add department
            </Button>
          </div>
          {departmentError && (
            <p className="text-xs text-[var(--color-alert-600)]">{departmentError}</p>
          )}

          {sortedDepartments.length === 0 ? (
            <p className="text-sm text-[var(--mismo-text-secondary)] py-2">
              No departments yet. Add your first one above.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-border-200)] border border-[var(--color-border-200)] rounded-md">
              {sortedDepartments.map((dept) => {
                const count = employeeCountByDepartment(dept.id);
                const isEditing = editingDepartmentId === dept.id;
                return (
                  <li key={dept.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3">
                    {isEditing ? (
                      <>
                        <Input
                          value={editingDepartmentName}
                          onChange={(e) => {
                            setEditingDepartmentName(e.target.value);
                            setDepartmentError(null);
                          }}
                          className="flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveDepartment();
                            }
                            if (e.key === 'Escape') cancelEditDepartment();
                          }}
                        />
                        <div className="flex gap-2 shrink-0">
                          <Button type="button" size="sm" onClick={handleSaveDepartment}>
                            Save
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={cancelEditDepartment}>
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--mismo-text)] truncate">{dept.name}</p>
                          <p className="text-xs text-[var(--mismo-text-secondary)]">
                            {count} employee{count === 1 ? '' : 's'}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => startEditDepartment(dept.id, dept.name)}
                          >
                            <Icons.edit className="h-3.5 w-3.5 mr-1.5" />
                            Rename
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                          >
                            <Icons.delete className="h-3.5 w-3.5 mr-1.5" />
                            Remove
                          </Button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="settings-card mismo-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icons.reports className="h-5 w-5 text-[var(--mismo-blue)]" />
            Reporting Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Allow Anonymous Reports</Label>
              <p className="text-sm text-[var(--mismo-text-secondary)]">
                Employees can submit reports without revealing their identity
              </p>
            </div>
            <Switch
              checked={settings.allowAnonymousReports}
              onCheckedChange={(v) => setSettings((prev) => ({ ...prev, allowAnonymousReports: v }))}
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-sm font-medium text-[var(--mismo-text-secondary)] uppercase tracking-wider mb-4">
              Communication Channels
            </h4>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Email Notifications</Label>
                  <p className="text-sm text-[var(--mismo-text-secondary)]">
                    Send notifications via email
                  </p>
                </div>
                <Switch
                  checked={settings.enableEmail}
                  onCheckedChange={(v) => setSettings((prev) => ({ ...prev, enableEmail: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable SMS Notifications</Label>
                  <p className="text-sm text-[var(--mismo-text-secondary)]">
                    Send notifications via text message
                  </p>
                </div>
                <Switch
                  checked={settings.enableSMS}
                  onCheckedChange={(v) => setSettings((prev) => ({ ...prev, enableSMS: v }))}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="settings-card mismo-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icons.info className="h-5 w-5 text-[var(--mismo-blue)]" />
            AI Options
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">LCM Backup for Tone</Label>
              <p className="text-sm text-[var(--mismo-text-secondary)]">
                Use LCM as backup model for tone stability when AI responses degrade.
              </p>
            </div>
            <Switch
              checked={settings.lcmToneBackup}
              onCheckedChange={(v) => setSettings((prev) => ({ ...prev, lcmToneBackup: v }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable AI After Deploy</Label>
              <p className="text-sm text-[var(--mismo-text-secondary)]">
                AI execution remains off in pre-deploy environments.
              </p>
            </div>
            <Switch
              checked={settings.enableAiAfterDeploy}
              onCheckedChange={(v) => setSettings((prev) => ({ ...prev, enableAiAfterDeploy: v }))}
              disabled
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Show AI Guide in Options</Label>
              <p className="text-sm text-[var(--mismo-text-secondary)]">
                Displays AI Guide in options/help areas for operational reference.
              </p>
            </div>
            <Switch
              checked={settings.showAiGuideOption}
              onCheckedChange={(v) => setSettings((prev) => ({ ...prev, showAiGuideOption: v }))}
            />
          </div>

          <div className="pt-2">
            <Button
              variant="outline"
              className="enterprise-interactive"
              onClick={() =>
                toast.info('AI Guide: LCM backup tone is active. AI runtime is enabled after deployment.')
              }
            >
              Open AI Guide
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="settings-card mismo-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icons.alertTriangle className="h-5 w-5 text-[var(--mismo-blue)]" />
            Risk Thresholds
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="atRiskDays">At-Risk: No Response Days</Label>
            <p className="text-sm text-[var(--mismo-text-secondary)]">
              Number of days without response to mark employee as at-risk
            </p>
            <Input
              id="atRiskDays"
              type="number"
              value={settings.atRiskNoResponseDays}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, atRiskNoResponseDays: parseInt(e.target.value) }))
              }
              min={1}
              max={90}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="atRiskRate">At-Risk: Minimum Response Rate (%)</Label>
            <p className="text-sm text-[var(--mismo-text-secondary)]">
              Minimum response rate to avoid at-risk status
            </p>
            <Input
              id="atRiskRate"
              type="number"
              value={settings.atRiskMinResponseRate}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, atRiskMinResponseRate: parseInt(e.target.value) }))
              }
              min={0}
              max={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="criticalSLA">Critical Report SLA (Hours)</Label>
            <p className="text-sm text-[var(--mismo-text-secondary)]">
              Target response time for critical reports
            </p>
            <Input
              id="criticalSLA"
              type="number"
              value={settings.criticalSLAHours}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, criticalSLAHours: parseInt(e.target.value) }))
              }
              min={1}
              max={168}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="settings-card mismo-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icons.dashboard className="h-5 w-5 text-[var(--mismo-blue)]" />
            Dashboard Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Show Recent Activity</Label>
              <p className="text-sm text-[var(--mismo-text-secondary)]">
                Display recent activity feed on dashboard
              </p>
            </div>
            <Switch
              checked={settings.showRecentActivityOnDashboard}
              onCheckedChange={(v) =>
                setSettings((prev) => ({ ...prev, showRecentActivityOnDashboard: v }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Show Reports Requiring Attention</Label>
              <p className="text-sm text-[var(--mismo-text-secondary)]">
                Display reports list on dashboard
              </p>
            </div>
            <Switch
              checked={settings.showReportsRequiringAttentionOnDashboard}
              onCheckedChange={(v) =>
                setSettings((prev) => ({ ...prev, showReportsRequiringAttentionOnDashboard: v }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[var(--mismo-blue)] hover:bg-blue-600"
        >
          {isSaving ? (
            <>
              <Icons.refresh className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Icons.check className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
