import type { DataStore } from '@/hooks/useDataStore';
import type { IconName } from '@/lib/icons';
import { Icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  badgeKey?: keyof DataStore['dashboardCounts'];
}

const employeeNavItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'reports', label: 'My Reports', icon: 'reports' },
  { id: 'resources', label: 'Resources', icon: 'resources' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const adminNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'prompt-responses', label: 'Prompt Responses', icon: 'reports' },
  { id: 'investigations', label: 'Investigations', icon: 'investigations', badgeKey: 'openInvestigationWorkload' },
  { id: 'policies', label: "Memos & Announcements", icon: 'bookOpen' },
  { id: 'analytics', label: 'Analytics', icon: 'analytics' },
  { id: 'compliance', label: 'State Compliance', icon: 'shield' },
  { id: 'users', label: 'Manage Employees', icon: 'employees', badgeKey: 'atRiskEmployees' },
  { id: 'prompts', label: 'Manage Prompts', icon: 'message' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

/** Platform back-office for Mismo leadership (companies + portfolio analytics only). */
const superAdminNavItems: NavItem[] = [
  { id: 'clients', label: 'Clients', icon: 'building' },
  { id: 'analytics', label: 'Analytics', icon: 'analytics' },
];

const clientNavItems: NavItem[] = [{ id: 'client-dashboard', label: 'Overview', icon: 'dashboard' }];

interface SidebarProps {
  dataStore: DataStore;
  activePage: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

function SidebarContent({
  dataStore,
  activePage,
  onNavigate,
}: Omit<SidebarProps, 'isOpen' | 'onClose'>) {
  const { currentRole, dashboardCounts, employeeReports } = dataStore;
  const navItems =
    currentRole === 'EMPLOYEE'
      ? employeeNavItems
      : currentRole === 'CLIENT'
        ? clientNavItems
        : currentRole === 'SUPER_ADMIN'
          ? superAdminNavItems
          : adminNavItems;

  const getBadgeCount = (item: NavItem): number | undefined => {
    if (currentRole === 'CLIENT') return undefined;
    if (currentRole === 'EMPLOYEE') {
      const pendingMemos = dataStore.policies.filter(
        (p) =>
          p.status === 'PUBLISHED' &&
          p.acknowledgmentRequired &&
          !dataStore.policyAcknowledgements.some(
            (a) => a.policyId === p.id && a.userId === dataStore.currentUser.id && a.outcome !== 'REQUEST_CLARIFICATION'
          )
      ).length;
      switch (item.id) {
        case 'home':
          return pendingMemos > 0 ? pendingMemos : dataStore.pendingPromptsForEmployee.length || undefined;
        case 'reports':
          return (employeeReports?.length ?? 0) > 0 ? (employeeReports?.length ?? 0) : undefined;
        default:
          return undefined;
      }
    }
    if (item.id === 'dashboard' && dataStore.pendingPromptsForEmployee.length > 0) {
      return dataStore.pendingPromptsForEmployee.length;
    }
    if (item.id === 'prompt-responses') {
      const n =
        dashboardCounts.yesResponsesNeedingReview +
        dashboardCounts.unansweredPromptDeliveries +
        dashboardCounts.openCaseRegisterCount;
      return n > 0 ? n : undefined;
    }
    if (!item.badgeKey) return undefined;
    const n = dashboardCounts[item.badgeKey];
    return typeof n === 'number' && n > 0 ? n : undefined;
  };

  const goNav = (item: NavItem) => {
    onNavigate(item.id);
  };

  return (
    <nav className="flex flex-col h-full py-4">
      <div className="px-4 mb-4">
        <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
          {currentRole === 'EMPLOYEE'
            ? 'Employee Portal'
            : currentRole === 'CLIENT'
              ? 'Client View'
              : currentRole === 'SUPER_ADMIN'
                ? 'Mismo Internal'
                : 'Human Resources'}
        </p>
      </div>

      <div className="flex-1 px-2 space-y-0.5">
        {currentRole === 'EMPLOYEE' && (
          <div className="mb-2 space-y-1">
            <button
              type="button"
              onClick={() => onNavigate('report-new')}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-3 min-h-[44px] text-sm font-semibold transition-colors border rounded-sm',
                activePage === 'report-new'
                  ? 'bg-[var(--color-alert-600)] text-white border-white/20'
                  : 'bg-[var(--color-primary-700)] text-white border-white/10 hover:bg-[var(--color-alert-600)]'
              )}
            >
              <Icons.shield className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1 text-left">Report workplace concern</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('wage-hour-report')}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-3 min-h-[44px] text-sm font-semibold transition-colors border rounded-sm',
                activePage === 'wage-hour-report' || activePage.startsWith('wage-hour-intake/')
                  ? 'bg-emerald-600 text-white border-white/20'
                  : 'bg-emerald-800 text-white border-white/10 hover:bg-emerald-600'
              )}
            >
              <Icons.reports className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1 text-left">Report wage &amp; hour concern</span>
            </button>
          </div>
        )}
        {navItems.map((item) => {
          const Icon = Icons[item.icon];
          const badgeCount = getBadgeCount(item);
          const isActive =
            activePage === item.id ||
            (item.id === 'policies' && activePage === 'announcements') ||
            (item.id === 'prompt-responses' &&
              (activePage === 'prompt-response-detail' ||
                activePage === 'report-detail' ||
                activePage === 'case-register')) ||
            (currentRole === 'EMPLOYEE' && item.id === 'home' && (activePage === 'report-new' || activePage === 'wage-hour-report' || activePage.startsWith('wage-hour-intake/')));

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => goNav(item)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] text-sm font-medium transition-colors border border-transparent rounded-sm',
                isActive
                  ? 'bg-[var(--color-primary-500)] text-white border-white/20'
                  : 'text-white/90 hover:bg-[var(--color-primary-700)] hover:text-white'
              )}
            >
              <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-white' : 'text-white/70')} />
              <span className="flex-1 text-left">{item.label}</span>
              {badgeCount !== undefined && badgeCount > 0 && (
                <span className="min-w-4 h-4 px-1 rounded-none text-[10px] font-semibold flex items-center justify-center bg-[var(--color-alert-600)] text-white">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-4 pt-4 border-t border-[var(--color-primary-700)]">
        <button
          type="button"
          onClick={() => onNavigate('help')}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm font-medium transition-colors border border-transparent',
            activePage === 'help'
              ? 'bg-[var(--color-primary-500)] text-white border-white/20'
              : 'text-white/70 hover:bg-[var(--color-primary-700)] hover:text-white'
          )}
        >
          <Icons.help className={cn('h-4.5 w-4.5 flex-shrink-0', activePage === 'help' ? 'text-white' : 'text-white/55')} />
          <span className="flex-1 text-left">Help & Support</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className={cn(
            'w-full mt-1 flex items-center gap-2.5 px-3 py-1.5 text-sm font-medium transition-colors border border-transparent',
            activePage === 'settings'
              ? 'bg-[var(--color-primary-500)] text-white border-white/20'
              : 'text-white/70 hover:bg-[var(--color-primary-700)] hover:text-white'
          )}
        >
          <Icons.info className={cn('h-4.5 w-4.5 flex-shrink-0', activePage === 'settings' ? 'text-white' : 'text-white/55')} />
          <span className="flex-1 text-left">Settings</span>
        </button>
      </div>
    </nav>
  );
}

export function Sidebar({ dataStore, activePage, onNavigate, isOpen, onClose }: SidebarProps) {
  return (
    <>
      <aside className="hidden lg:block fixed left-0 top-16 w-64 h-[calc(100vh-64px)] bg-[var(--color-primary-900)] border-r border-[var(--color-primary-700)] overflow-y-auto z-40 pointer-events-auto">
        <SidebarContent dataStore={dataStore} activePage={activePage} onNavigate={onNavigate} />
      </aside>

      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            onClose?.();
          }
        }}
      >
        <SheetContent
          side="left"
          className="w-[min(100vw,18rem)] p-0 border-[var(--color-primary-700)] bg-[var(--color-primary-900)] [&>button]:text-white [&>button]:hover:bg-white/10 [&>button]:opacity-90"
        >
          <div className="h-full overflow-y-auto pt-14 pb-6">
            <SidebarContent
              dataStore={dataStore}
              activePage={activePage}
              onNavigate={(page, params) => {
                onNavigate(page, params);
                onClose?.();
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
