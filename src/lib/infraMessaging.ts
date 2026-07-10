/** User-facing infrastructure copy — never mention vendor names in the product UI. */

export const INFRA_NOT_CONFIGURED =
  'Cloud database and authentication are not configured. Contact your administrator to connect AWS services.';

export const API_NOT_CONFIGURED =
  'Mismo API is not configured. Contact your administrator to set up the AWS-hosted API endpoint.';

export const API_UNREACHABLE =
  'Mismo API is unreachable. Check AWS deployment, database connectivity, and network access.';

export const API_CHECKING = 'Checking API connection…';

export const API_CONNECTED_DATABASE_MISSING =
  'Connected — database credentials are not configured on the API server.';

export const API_CONNECTED_OPENAI_MISSING =
  'Connected — OpenAI key is missing on the API server. Ask your administrator to configure OPENAI_API_KEY.';

export const API_CONNECTED_READY =
  'Connected — OpenAI research and AWS database storage are ready.';

export const API_ENDPOINT_LABEL = 'Mismo API (AWS-hosted)';

export function sanitizeInfraError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('supabase') || lower.includes('vite_supabase')) {
    if (lower.includes('not configured')) return INFRA_NOT_CONFIGURED;
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
