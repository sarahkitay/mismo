/** User-facing infrastructure copy. Never mention vendor names in the product UI. */

export const INFRA_NOT_CONFIGURED =
  'Cloud database and authentication are not configured. Contact your administrator to connect AWS services.';

export const API_NOT_CONFIGURED =
  'Mismo API is not configured. Contact your administrator to set up the AWS-hosted API endpoint.';

export const API_UNREACHABLE =
  'Mismo API is unreachable. Check AWS deployment, database connectivity, and network access.';

export const API_CHECKING = 'Checking API connection…';

export const API_CONNECTED_DATABASE_MISSING =
  'Connected. Database credentials are not configured on the API server.';

export const API_CONNECTED_OPENAI_MISSING =
  'Connected. OpenAI key is missing on the API server. Ask your administrator to configure OPENAI_API_KEY.';

export const API_CONNECTED_READY =
  'Connected. OpenAI research and AWS database storage are ready.';

export const API_ENDPOINT_LABEL = 'Mismo API (AWS-hosted)';

/** Strip vendor-specific names from any message shown to users. Prefer AWS / generic wording. */
export function sanitizeInfraError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes('supabase') ||
    lower.includes('vite_supabase') ||
    lower.includes('postgrest') ||
    lower.includes('gotrue') ||
    /\.supabase\.co/.test(lower)
  ) {
    if (lower.includes('not configured') || lower.includes('missing')) return INFRA_NOT_CONFIGURED;
    if (lower.includes('jwt') || lower.includes('auth') || lower.includes('session')) {
      return 'Authentication failed. Sign in again or contact your administrator.';
    }
    return 'A cloud database or API error occurred. Contact your administrator.';
  }
  if (lower.includes('edge function')) {
    return message.replace(/edge function/gi, 'API server');
  }
  if (lower.includes('vite_api_base_url')) {
    return API_NOT_CONFIGURED;
  }
  return message;
}
