import { useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { DEMO_PASSWORD, PRIMARY_DEMO_LOGINS } from '@/data/demoLogins';

interface LoginProps {
  dataStore: DataStore;
}

export function Login({ dataStore }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    const result = await dataStore.login(email.trim(), password);
    setSubmitting(false);
    if (result.ok) {
      toast.success('Signed in.');
    } else {
      toast.error(result.message ?? 'Sign in failed.');
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
                <Label htmlFor="email" className="section-label block text-left">
                  Email
                </Label>
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="section-label block text-left">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Leave blank for demo accounts"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 rounded-md border-[var(--color-border-200)]"
                />
                <p className="text-xs text-[var(--color-text-muted)]">
                  Demo accounts can sign in with email only. Dashboards start empty until you add real data.
                </p>
              </div>
              <Button type="submit" className="w-full h-10 font-medium" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
            <div className="text-xs text-center text-[var(--color-text-muted)] border-t border-[var(--color-border-200)] pt-4 space-y-1">
              <p>Demo logins (password optional — defaults to {DEMO_PASSWORD}):</p>
              <p>
                {PRIMARY_DEMO_LOGINS.map((account, index) => (
                  <span key={account.email}>
                    {index > 0 ? ' · ' : null}
                    <button
                      type="button"
                      className="text-[var(--color-text-secondary)] underline-offset-2 hover:underline"
                      onClick={() => setEmail(account.email)}
                    >
                      {account.email}
                    </button>{' '}
                    ({account.label})
                  </span>
                ))}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
