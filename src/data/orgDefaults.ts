import type { Organization } from '@/types';

export const DEFAULT_ORG_ID = (import.meta.env.VITE_ORG_ID as string | undefined)?.trim() || 'org-mismo-1';

export const DEFAULT_ORG_SETTINGS: Organization['settings'] = {
  allowAnonymousReports: true,
  enableSMS: false,
  enableEmail: true,
  showRecentActivityOnDashboard: true,
  showReportsRequiringAttentionOnDashboard: true,
  thresholds: {
    atRiskNoResponseDays: 14,
    atRiskMinResponseRate: 0.7,
    criticalSLAHours: 24,
  },
};

export const DEFAULT_ORG_NAME = (import.meta.env.VITE_ORG_NAME as string | undefined)?.trim() || 'Organization';

export function isSupabaseAppConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL?.trim() && import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  );
}
