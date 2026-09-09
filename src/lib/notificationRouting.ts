import type { AppNotification } from '@/types';

/** Map current app page → notification kinds / action pages that should clear as "seen". */
export function notificationClearedByPage(n: AppNotification, activePage: string): boolean {
  const page = activePage.split('/')[0];
  const action = (n.actionPage ?? '').split('/')[0];

  if (page === 'prompts' || page === 'prompt-responses' || page === 'prompt-response-detail' || page === 'case-register') {
    if (n.kind === 'PROMPT') return true;
    if (action === 'prompts' || action === 'prompt-responses' || action === 'prompt-response-detail') return true;
  }
  if (page === 'policies' || page === 'policy-detail' || page === 'announcements' || page === 'announcement-detail') {
    if (n.kind === 'MEMO') return true;
    if (action === 'policies' || action === 'resources' || action === 'announcements') return true;
  }
  if (page === 'investigations' || page === 'investigation-detail') {
    if (n.kind === 'CASE_UPDATE' && (action === 'investigation-detail' || !n.actionPage)) return true;
    if (action === 'investigation-detail' || action === 'investigations') return true;
  }
  if (page === 'report-detail' || page === 'prompt-responses') {
    if (n.kind === 'CASE_UPDATE') return true;
    if (action === 'report-detail' || action === 'case-register') return true;
  }
  if (page === 'users' || page === 'employees' || page === 'employee-detail') {
    if (n.kind === 'INVITE' || n.kind === 'PASSWORD_RESET') return true;
    if (action === 'users' || action === 'employees' || action === 'employee-detail') return true;
  }
  if (page === 'resources') {
    if (n.kind === 'MEMO') return true;
    if (action === 'resources') return true;
  }
  if (page === 'reports' || page.startsWith('report-detail') || page === 'home') {
    if (n.kind === 'CASE_UPDATE' || n.kind === 'MESSAGE') {
      if (!n.actionPage || action === 'reports' || action === 'report-detail' || action === 'dashboard' || action === 'home') {
        return page === 'reports' || page.startsWith('report-detail');
      }
    }
  }
  return false;
}

export function notificationKindLabel(n: AppNotification): string {
  if (n.title.toLowerCase().includes('note received')) return 'Note received';
  switch (n.kind) {
    case 'INVITE':
      return 'Invite';
    case 'PASSWORD_RESET':
    case 'PASSWORD_CHANGED':
      return 'Password';
    case 'MESSAGE':
      return 'Message';
    case 'MEMO':
      return 'Memo';
    case 'PROMPT':
      return 'Prompt';
    case 'CASE_UPDATE':
      return 'Case';
    default:
      return 'Update';
  }
}
