import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '@/types';

export type ResolvedAppSession = {
  appUserId: string;
  orgId: string;
  role: UserRole;
};

type JwtClaims = {
  orgId?: string;
  appUserId?: string;
  role?: UserRole;
};

function parseJwtClaims(accessToken: string): JwtClaims {
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1] ?? '')) as Record<string, string>;
    return {
      orgId: payload.org_id,
      appUserId: payload.app_user_id,
      role: payload.user_role as UserRole | undefined,
    };
  } catch {
    return {};
  }
}

type RpcSessionRow = {
  app_user_id: string;
  org_id: string;
  user_role: string;
};

/** Resolve org + app user after Auth sign-in (JWT claims or secure RPC). */
export async function resolveAppSessionFromAuth(
  supabase: SupabaseClient,
  accessToken: string
): Promise<ResolvedAppSession | null> {
  const claims = parseJwtClaims(accessToken);
  if (claims.appUserId && claims.orgId && claims.role) {
    return { appUserId: claims.appUserId, orgId: claims.orgId, role: claims.role };
  }

  const { data, error } = await supabase.rpc('resolve_app_session_for_auth');
  if (error || !data?.length) return null;

  const row = data[0] as RpcSessionRow;
  if (!row?.app_user_id || !row?.org_id || !row?.user_role) return null;

  return {
    appUserId: row.app_user_id,
    orgId: row.org_id,
    role: row.user_role as UserRole,
  };
}
