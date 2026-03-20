import { useEffect, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface EmployeeSettingsProps {
  dataStore: DataStore;
}

export function EmployeeSettings({ dataStore }: EmployeeSettingsProps) {
  const { currentUser } = dataStore;
  const prefKey = `mismo-employee-settings-${currentUser.id}`;
  
  // Form state
  const [firstName, setFirstName] = useState(currentUser.firstName);
  const [lastName, setLastName] = useState(currentUser.lastName);
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [promptReminders, setPromptReminders] = useState(true);
  const [reportUpdates, setReportUpdates] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(prefKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setFirstName(parsed.firstName ?? currentUser.firstName);
      setLastName(parsed.lastName ?? currentUser.lastName);
      setPhone(parsed.phone ?? currentUser.phone ?? '');
      setEmailNotifications(parsed.emailNotifications ?? true);
      setSmsNotifications(parsed.smsNotifications ?? false);
      setPromptReminders(parsed.promptReminders ?? true);
      setReportUpdates(parsed.reportUpdates ?? true);
    } catch {
      // no-op for malformed local state
    }
  }, [currentUser.firstName, currentUser.id, currentUser.lastName, currentUser.phone, prefKey]);
  
  const handleSaveProfile = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    localStorage.setItem(prefKey, JSON.stringify({
      firstName,
      lastName,
      phone,
      emailNotifications,
      smsNotifications,
      promptReminders,
      reportUpdates,
    }));
    toast.success('Profile updated successfully');
    setIsSaving(false);
  };
  
  const handleSaveNotifications = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    localStorage.setItem(prefKey, JSON.stringify({
      firstName,
      lastName,
      phone,
      emailNotifications,
      smsNotifications,
      promptReminders,
      reportUpdates,
    }));
    toast.success('Notification preferences saved');
    setIsSaving(false);
  };
  
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="settings-header">
        <h1 className="text-2xl font-bold text-[var(--mismo-text)]">Settings</h1>
        <p className="text-[var(--mismo-text-secondary)] mt-1">
          Manage your profile and notification preferences
        </p>
      </div>
      
      {/* Profile Settings */}
      <Card className="settings-card mismo-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icons.user className="h-5 w-5 text-[var(--mismo-blue)]" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={currentUser.email}
              disabled
              className="bg-gray-50"
            />
            <p className="text-xs text-[var(--mismo-text-secondary)]">
              Contact HR to change your email address
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
            />
          </div>
          
          <Button 
            onClick={handleSaveProfile}
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
        </CardContent>
      </Card>
      
      {/* Notification Settings */}
      <Card className="settings-card mismo-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icons.bell className="h-5 w-5 text-[var(--mismo-blue)]" />
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Email Notifications</Label>
              <p className="text-sm text-[var(--mismo-text-secondary)]">
                Receive updates via email
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>
          
          {/* SMS Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">SMS Notifications</Label>
              <p className="text-sm text-[var(--mismo-text-secondary)]">
                Receive text message alerts
              </p>
            </div>
            <Switch
              checked={smsNotifications}
              onCheckedChange={setSmsNotifications}
            />
          </div>
          
          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-sm font-medium text-[var(--mismo-text-secondary)] uppercase tracking-wider mb-4">
              Notification Types
            </h4>
            
            {/* Prompt Reminders */}
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-0.5">
                <Label className="text-base">Prompt Reminders</Label>
                <p className="text-sm text-[var(--mismo-text-secondary)]">
                  Reminders about pending check-ins
                </p>
              </div>
              <Switch
                checked={promptReminders}
                onCheckedChange={setPromptReminders}
                disabled={!emailNotifications && !smsNotifications}
              />
            </div>
            
            {/* Report Updates */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Report Updates</Label>
                <p className="text-sm text-[var(--mismo-text-secondary)]">
                  Status changes and updates on your reports
                </p>
              </div>
              <Switch
                checked={reportUpdates}
                onCheckedChange={setReportUpdates}
                disabled={!emailNotifications && !smsNotifications}
              />
            </div>
          </div>
          
          <Button 
            onClick={handleSaveNotifications}
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
                Save Preferences
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      
      {/* Security */}
      <Card className="settings-card mismo-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Icons.lock className="h-5 w-5 text-[var(--mismo-blue)]" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="font-medium text-[var(--mismo-text)]">Password</p>
              <p className="text-sm text-[var(--mismo-text-secondary)]">
                Last changed 3 months ago
              </p>
            </div>
            <Button variant="outline" onClick={() => toast.info('Password reset flow is configured through your identity provider.')}>
              Change Password
            </Button>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="font-medium text-[var(--mismo-text)]">Two-Factor Authentication</p>
              <p className="text-sm text-[var(--mismo-text-secondary)]">
                Add an extra layer of security
              </p>
            </div>
            <Button variant="outline" onClick={() => toast.success('Two-factor authentication enrollment started.')}>
              Enable 2FA
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
