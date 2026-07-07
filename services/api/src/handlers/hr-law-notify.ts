import type { ScheduledHandler } from 'aws-lambda';

/**
 * Daily job: send SES emails + create hr_law_notifications for rows
 * where hr_law_updates.notified_at IS NULL and org watchlist matches.
 */
export const handler: ScheduledHandler = async () => {
  // TODO: query pending hr_law_updates joined to org_hr_law_watchlists
  // TODO: SES send + mark notified_at
  console.log(JSON.stringify({ job: 'HR_LAW_NOTIFY', status: 'stub' }));
};
