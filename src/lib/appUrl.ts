/** Build browser URL for in-app navigation (pathname + optional query). */

export type AppRole = 'EMPLOYEE' | 'HR' | 'MANAGER' | 'ADMIN' | 'SUPER_ADMIN' | 'CLIENT';

function searchTail(routeParams: Record<string, string>, skipKeys: Set<string>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(routeParams)) {
    if (skipKeys.has(k)) continue;
    if (v === undefined || v === '') continue;
    q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function buildAppUrl(page: string, role: AppRole, routeParams: Record<string, string> = {}): string {
  const id = routeParams.id ?? '';
  const tail = searchTail(routeParams, new Set(['id', 'previewEmployee']));

  const employeeMap: Record<string, string> = {
    home: '/employee/dashboard',
    reports: '/employee/my-reports',
    resources: '/employee/resources',
    settings: '/employee/settings',
    'report-new': '/employee/report/new',
    'wage-hour-report': '/employee/report/wage-hour',
    help: '/employee/help',
  };

  const adminMap: Record<string, string> = {
    dashboard: '/admin/dashboard',
    help: '/admin/help',
    analytics: '/admin/analytics',
    policies: '/admin/policy-manager',
    announcements: '/admin/announcements',
    users: '/admin/users',
    employees: '/admin/users',
    prompts: '/admin/prompts',
    'prompt-responses': '/admin/employee-prompt-responses',
    'case-register': '/admin/case-register',
    compliance: '/admin/compliance',
    investigations: '/admin/investigations',
    activity: '/admin/activity',
    settings: '/admin/settings',
    'system-health': '/admin/system-health',
    'manager-dashboard': '/admin/human-resources-dashboard',
    'client-dashboard': '/admin/client-dashboard',
    'scheduled-memos': '/admin/prompts/scheduled',
  };

  if (role === 'EMPLOYEE') {
    if (page.startsWith('wage-hour-intake/')) {
      const rid = page.slice('wage-hour-intake/'.length);
      return `/employee/my-reports/${rid}/wage-hour${tail}`;
    }
    if (page.startsWith('incident-intake/')) {
      const rid = page.slice('incident-intake/'.length);
      return `/employee/my-reports/${rid}/intake${tail}`;
    }
    if (page.startsWith('report-detail/')) {
      const rid = page.slice('report-detail/'.length);
      return `/employee/my-reports/${rid}${tail}`;
    }
    return `${employeeMap[page] ?? '/employee/dashboard'}${tail}`;
  }

  if (page.startsWith('incident-intake/') || page.startsWith('report-detail/')) {
    return `${employeeMap.home}${tail}`;
  }

  if (page === 'report-detail') return `/admin/all-reports/${id}${tail}`;
  if (page === 'employee-detail') return `/admin/users/${id}${tail}`;
  if (page === 'investigation-detail') return `/admin/investigations/${id}${tail}`;
  if (page === 'policy-detail') return `/admin/policy-manager/${id}${tail}`;
  if (page === 'announcement-detail') return `/admin/announcements/${id}${tail}`;
  if (page === 'prompt-response-detail') return `/admin/employee-prompt-responses/${id}${tail}`;

  if (role === 'CLIENT') return `${adminMap[page] ?? '/admin/client-dashboard'}${tail}`;
  return `${adminMap[page] ?? '/admin/dashboard'}${tail}`;
}

export function parseAppLocation(
  pathnameRaw: string,
  searchRaw: string,
  currentRole: AppRole
): { role: AppRole; page: string; params: Record<string, string> } {
  const pathname = pathnameRaw.split('?')[0];
  const query: Record<string, string> = {};
  const sp = searchRaw.startsWith('?') ? searchRaw.slice(1) : searchRaw;
  if (sp) new URLSearchParams(sp).forEach((v, k) => { query[k] = v; });

  const merge = (inner: { role: AppRole; page: string; params: Record<string, string> }) => ({
    role: inner.role,
    page: inner.page,
    params: { ...query, ...inner.params },
  });

  if (pathname === '/employee/dashboard') return merge({ role: 'EMPLOYEE', page: 'home', params: {} });
  if (pathname === '/employee/my-reports') return merge({ role: 'EMPLOYEE', page: 'reports', params: {} });
  if (pathname === '/employee/resources') return merge({ role: 'EMPLOYEE', page: 'resources', params: {} });
  if (pathname === '/employee/settings') return merge({ role: 'EMPLOYEE', page: 'settings', params: {} });
  if (pathname === '/employee/report/new') return merge({ role: 'EMPLOYEE', page: 'report-new', params: {} });
  if (pathname === '/employee/help') return merge({ role: 'EMPLOYEE', page: 'help', params: {} });
  if (pathname === '/employee/report/wage-hour') return merge({ role: 'EMPLOYEE', page: 'wage-hour-report', params: {} });
  const wageHourIntakeMatch = pathname.match(/^\/employee\/my-reports\/([^/]+)\/wage-hour$/);
  if (wageHourIntakeMatch) {
    return merge({ role: 'EMPLOYEE', page: `wage-hour-intake/${wageHourIntakeMatch[1]}`, params: {} });
  }
  const intakeMatch = pathname.match(/^\/employee\/my-reports\/([^/]+)\/intake$/);
  if (intakeMatch) return merge({ role: 'EMPLOYEE', page: `incident-intake/${intakeMatch[1]}`, params: {} });
  if (pathname.startsWith('/employee/my-reports/')) {
    return merge({ role: 'EMPLOYEE', page: `report-detail/${pathname.split('/employee/my-reports/')[1]}`, params: {} });
  }

  if (pathname === '/admin/dashboard') return merge({ role: 'HR', page: 'dashboard', params: {} });
  if (pathname === '/admin/help') return merge({ role: currentRole === 'CLIENT' ? 'CLIENT' : 'HR', page: 'help', params: {} });
  if (pathname === '/admin/all-reports') return merge({ role: 'HR', page: 'prompt-responses', params: {} });
  if (pathname.startsWith('/admin/all-reports/')) {
    const rid = pathname.split('/admin/all-reports/')[1]?.split('?')[0] ?? '';
    return merge({ role: 'HR', page: 'report-detail', params: { id: rid } });
  }
  if (pathname === '/admin/analytics') return merge({ role: 'HR', page: 'analytics', params: {} });
  if (pathname === '/admin/policy-manager') return merge({ role: 'HR', page: 'policies', params: {} });
  if (pathname.startsWith('/admin/policy-manager/')) {
    const rid = pathname.split('/admin/policy-manager/')[1]?.split('?')[0] ?? '';
    return merge({ role: 'HR', page: 'policy-detail', params: { id: rid } });
  }
  if (pathname === '/admin/announcements') return merge({ role: 'HR', page: 'announcements', params: {} });
  if (pathname.startsWith('/admin/announcements/')) {
    const rid = pathname.split('/admin/announcements/')[1]?.split('?')[0] ?? '';
    return merge({ role: 'HR', page: 'announcement-detail', params: { id: rid } });
  }
  if (pathname === '/admin/users') return merge({ role: 'HR', page: 'users', params: {} });
  if (pathname.startsWith('/admin/users/')) {
    const rid = pathname.split('/admin/users/')[1]?.split('?')[0] ?? '';
    return merge({ role: 'HR', page: 'employee-detail', params: { id: rid } });
  }
  if (pathname === '/admin/prompts') return merge({ role: 'HR', page: 'prompts', params: {} });
  if (pathname === '/admin/prompts/scheduled') return merge({ role: 'HR', page: 'scheduled-memos', params: {} });
  if (pathname === '/admin/employee-prompt-responses') return merge({ role: 'HR', page: 'prompt-responses', params: {} });
  if (pathname === '/admin/case-register') return merge({ role: 'HR', page: 'case-register', params: {} });
  if (pathname.startsWith('/admin/employee-prompt-responses/')) {
    const rid = pathname.split('/admin/employee-prompt-responses/')[1]?.split('?')[0] ?? '';
    return merge({
      role: 'HR',
      page: 'prompt-response-detail',
      params: { id: rid },
    });
  }
  if (pathname === '/admin/compliance') return merge({ role: 'HR', page: 'compliance', params: {} });
  if (pathname === '/admin/investigations') return merge({ role: 'HR', page: 'investigations', params: {} });
  if (pathname.startsWith('/admin/investigations/')) {
    const rid = pathname.split('/admin/investigations/')[1]?.split('?')[0] ?? '';
    return merge({ role: 'HR', page: 'investigation-detail', params: { id: rid } });
  }
  if (pathname === '/admin/campaigns') return merge({ role: 'HR', page: 'prompts', params: {} });
  if (pathname === '/admin/activity') return merge({ role: 'HR', page: 'activity', params: {} });
  if (pathname === '/admin/settings') return merge({ role: 'HR', page: 'settings', params: {} });
  if (pathname === '/admin/system-health') return merge({ role: 'HR', page: 'system-health', params: {} });
  if (pathname === '/admin/human-resources-dashboard' || pathname === '/admin/manager-dashboard') {
    return merge({ role: 'HR', page: 'dashboard', params: {} });
  }
  if (pathname === '/admin/client-dashboard') return merge({ role: 'CLIENT', page: 'client-dashboard', params: {} });

  return merge({
    role: currentRole === 'EMPLOYEE' ? 'EMPLOYEE' : currentRole === 'CLIENT' ? 'CLIENT' : 'HR',
    page: currentRole === 'EMPLOYEE' ? 'home' : currentRole === 'CLIENT' ? 'client-dashboard' : 'dashboard',
    params: {},
  });
}
