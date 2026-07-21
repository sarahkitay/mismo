import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { sanitizeInfraError } from '@/lib/infraMessaging';

interface SetPasswordProps {
  onDone: () => void;
}

/**
 * Shown when a user arrives via an invite or password-reset link (URL hash
 * contains type=invite or type=recovery). The Supabase client establishes a
 * temporary session from the link; here the user sets a password to finish
 * creating their login.
 */
export function SetPassword({ onDone }: SetPasswordProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);

  // Wait for the client to parse the invite/recovery tokens from the URL hash.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          setSessionReady(true);
          return;
        }
        // Give detectSessionInUrl a moment, then re-check once.
        setTimeout(() => {
          void supabase.auth.getSession().then(({ data: retry }) => {
            if (cancelled) return;
            if (retry.session) setSessionReady(true);
            else setLinkInvalid(true);
          });
        }, 600);
      } catch {
        if (!cancelled) setLinkInvalid(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw new Error(err.message);
      // Remove the invite hash so it is not reprocessed on the next render.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      toast.success('Password set. Welcome to Mismo.');
      onDone();
    } catch (err) {
      setError(sanitizeInfraError(err instanceof Error ? err.message : 'Could not set your password.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-200)] flex items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        <Card className="mismo-card border border-[var(--color-border-200)] shadow-[var(--shadow-2)]">
          <CardContent className="p-8 space-y-6">
            <div className="text-center pb-2">
              <h1 className="text-2xl font-semibold text-[var(--color-primary-900)] tracking-tight">Mismo</h1>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">Create your login</p>
            </div>

            {linkInvalid ? (
              <div className="space-y-3 text-center">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  This invite link has expired or was already used. Ask your administrator to send a new
                  invite link.
                </p>
                <Button type="button" variant="outline" onClick={() => { window.location.href = window.location.origin; }}>
                  Go to sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="section-label block text-left">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    className="w-full h-10 rounded-md border-[var(--color-border-200)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="section-label block text-left">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setError(null); }}
                    className="w-full h-10 rounded-md border-[var(--color-border-200)]"
                  />
                </div>
                {error && <p className="text-xs text-[var(--color-alert-600)]">{error}</p>}
                <Button type="submit" className="w-full" disabled={submitting || !sessionReady}>
                  {submitting ? 'Saving…' : sessionReady ? 'Set password and continue' : 'Preparing…'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
