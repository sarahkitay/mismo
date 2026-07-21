/** Local stub until check-in deferral is persisted in the database. */

function todayKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function deferStorageKey(userId: string, deliveryId: string): string {
  return `mismo_checkin_deferred_${userId}_${deliveryId}_${todayKey()}`;
}

/** Whether today's mandatory check-in should block the home screen.
 * Always show until the delivery is answered (deferral disabled). */
export function shouldShowCheckInGate(_userId: string, _deliveryId: string): boolean {
  return true;
}

/** Skip the full-screen check-in for the rest of today (local stub until DB).
 * Kept for API compatibility; deferral is currently disabled so check-ins stay until answered. */
export function deferCheckInForToday(_userId: string, _deliveryId: string): void {
  /* no-op: check-in must remain until answered */
}

/** Allow the check-in gate to show again today after the user deferred it. */
export function clearCheckInDeferralForToday(userId: string, deliveryId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(deferStorageKey(userId, deliveryId));
  } catch {
    /* ignore */
  }
}

export function isCheckInDeferredForToday(userId: string, deliveryId: string): boolean {
  return !shouldShowCheckInGate(userId, deliveryId);
}
