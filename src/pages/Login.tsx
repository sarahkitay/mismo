import { useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface LoginProps {
  dataStore: DataStore;
}

export function Login({ dataStore }: LoginProps) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    const ok = dataStore.login(email.trim());
    setSubmitting(false);
    if (ok) {
      toast.success('Signed in.');
    } else {
      toast.error('No account found for this email. Use an existing user email or add users via HR → Users → Bulk Import.');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-200)] flex items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        <Card className="mismo-card border border-[var(--color-border-200)] shadow-[var(--shadow-2)]">
          <CardContent className="p-8 space-y-6">
            <div className="text-center pb-2">
              <h1 className="text-2xl font-semibold text-[var(--color-primary-900)] tracking-tight">Mismo</h1>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">Proactive Risk Infrastructure</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="section-label block text-left">Email</Label>
                <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 rounded-md border-[var(--color-border-200)]"
                required
              />
              <p className="text-xs text-[var(--color-text-muted)]">
                Sign in with your work email. Each company has its own data; only your organization’s records are visible.
              </p>
            </div>
            <Button type="submit" className="w-full h-10 font-medium" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p className="text-xs text-center text-[var(--color-text-muted)] border-t border-[var(--color-border-200)] pt-4">
            No account? Ask HR to add you via Users, or use a seed email (e.g. alex.morgan@mismo.com).
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
