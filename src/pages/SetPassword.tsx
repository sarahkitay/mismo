import { useEffect, useState } from 'react';
import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js';
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

function readAuthConfirmParams(): { tokenHash: string; type: EmailOtpType } | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const tokenHash = params.get('token_hash')?.trim();
  const type = params.get('type')?.trim() as EmailOtpType | null;
  if (!tokenHash || !type) return null;
  return { tokenHash, type };
}

/** One verify per token across Strict Mode remounts (invite OTPs are single-use). */
const otpVerifyInflight = new Map<string, Promise<{ ok: boolean; message?: string; email?: string }>>();

/**
 * Always clear any existing session before verifying an invite/recovery token.
 * Otherwise an admin already signed in on this browser would keep their session,
 * skip verifyOtp, and updateUser({ password }) would change the admin password.
 */
function verifyOtpOnce(
  supabase: SupabaseClient,
  tokenHash: string,
  type: EmailOtpType
): Promise<{ ok: boolean; message?: string; email?: string }> {
  const key = `${type}:${tokenHash}`;
  let pending = otpVerifyInflight.get(key);
  if (!pending) {
    pending = (async () => {
      // Local scope only — do not revoke refresh tokens on other devices.
      await supabase.auth.signOut({ scope: 'local' });
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) return { ok: false, message: error.message };
      const email = data.user?.email ?? data.session?.user?.email ?? undefined;
      return { ok: true, email };
    })();
    otpVerifyInflight.set(key, pending);
  }
  return pending;
}

/**
 * Shown when a user arrives via an invite / recovery / branded confirm link.
 * Branded links use /auth/confirm?token_hash=…&type=invite (no vendor host).
 * Hash-based vendor redirects (type=invite|recovery in the URL hash) still work.
 */
export function SetPassword({ onDone }: SetPasswordProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(true);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabaseClient();
        const confirmParams = readAuthConfirmParams();

        // Invite / recovery / magic links must always verify the token.
        // Never reuse a prior browser session (e.g. HR testing the link while logged in).
        if (confirmParams) {
          const result = await verifyOtpOnce(supabase, confirmParams.tokenHash, confirmParams.type);
          if (cancelled) return;

          const after = await supabase.auth.getSession();
          if (cancelled) return;
          if (!result.ok && !after.data.session) {
            setLinkInvalid(true);
            return;
          }

          const email =
            result.email ??
            after.data.session?.user?.email ??
            null;
          if (email) setAccountEmail(email);

          if (confirmParams.type === 'magiclink' || confirmParams.type === 'email') {
            window.history.replaceState(null, '', window.location.pathname);
            toast.success('Signed in. Welcome to Mismo.');
            onDone();
            return;
          }

          setNeedsPassword(true);
          setSessionReady(true);
          window.history.replaceState(null, '', '/auth/confirm');
          return;
        }

        // Remount after URL was cleaned — use the session established by verifyOtp.
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          if (data.session.user?.email) setAccountEmail(data.session.user.email);
          setSessionReady(true);
          return;
        }

        // Give detectSessionInUrl a moment for hash-based vendor redirects.
        setTimeout(() => {
          void supabase.auth.getSession().then(({ data: retry }) => {
            if (cancelled) return;
            if (retry.session) {
              if (retry.session.user?.email) setAccountEmail(retry.session.user.email);
              setSessionReady(true);
            } else setLinkInvalid(true);
          });
        }, 600);
      } catch {
        if (!cancelled) setLinkInvalid(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onDone]);

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
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Your invite session expired. Open the invite link again.');
      }
      // Guard: never set password without a verified invite/recovery session.
      const email = sessionData.session.user?.email;
      if (accountEmail && email && email.toLowerCase() !== accountEmail.toLowerCase()) {
        throw new Error('Signed-in account does not match this invite. Open the invite link in a private window.');
      }
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw new Error(err.message);
      window.history.replaceState(null, '', '/');
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
              {accountEmail && (
                <p className="text-xs text-[var(--color-text-muted)] mt-2">
                  Setting password for <span className="font-medium text-[var(--mismo-text)]">{accountEmail}</span>
                </p>
              )}
            </div>

            {linkInvalid ? (
              <div className="space-y-3 text-center">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  This invite link has expired or was already used. Ask your administrator to send a new
                  invite link.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    window.location.href = window.location.origin;
                  }}
                >
                  Go to sign in
                </Button>
              </div>
            ) : needsPassword ? (
              <form onSubmit={submit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="section-label block text-left">
                    New password
                  </Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    className="w-full h-10 rounded-md border-[var(--color-border-200)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="section-label block text-left">
                    Confirm password
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      setError(null);
                    }}
                    className="w-full h-10 rounded-md border-[var(--color-border-200)]"
                  />
                </div>
                {error && <p className="text-xs text-[var(--color-alert-600)]">{error}</p>}
                <Button type="submit" className="w-full" disabled={submitting || !sessionReady}>
                  {submitting ? 'Saving…' : sessionReady ? 'Set password and continue' : 'Preparing…'}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-center text-[var(--mismo-text-secondary)]">Signing you in…</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
