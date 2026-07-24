/** Public app URL for sign-in / invite handoff. Override with VITE_APP_URL. */
export const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined)?.trim() || 'https://mismo-app.vercel.app';

/** Invitation / sales contact. Override with VITE_INVITE_EMAIL. */
export const INVITE_EMAIL =
  (import.meta.env.VITE_INVITE_EMAIL as string | undefined)?.trim() || 'hello@mismo.com';

export function inviteMailto(subject = 'Mismo invitation request'): string {
  return `mailto:${INVITE_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
