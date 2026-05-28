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
  {
    id: 'prompt-responses',
    label: 'Prompt responses',
    icon: 'reports',
    badgeKey: 'yesResponsesNeedingReview',
  },
  {
    id: 'investigations',
    label: 'Investigations',
    icon: 'investigations',
    badgeKey: 'activeInvestigations',
  },
  {
    id: 'policies',
    label: "Memos & announcements",
    icon: 'bookOpen',
    badgeKey: 'memoAcknowledgementsPending',
  },
  {
    id: 'case-register',
    label: 'Case register',
    icon: 'reports',
    badgeKey: 'openCaseRegisterCount',
  },
  { id: 'prompts', label: 'Manage prompts', icon: 'message' },
  { id: 'users', label: 'Manage employees', icon: 'employees', badgeKey: 'atRiskEmployees' },
  { id: 'analytics', label: 'Analytics', icon: 'analytics' },
  { id: 'compliance', label: 'Compliance', icon: 'shield' },
  { id: 'system-health', label: 'System Health', icon: 'systemHealth', badgeKey: 'criticalReports' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
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
    currentRole === 'EMPLOYEE' ? employeeNavItems : currentRole === 'CLIENT' ? clientNavItems : adminNavItems;

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
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold transition-colors border',
                activePage === 'report-new'
                  ? 'bg-[var(--color-alert-600)] text-white border-white/20'
                  : 'bg-[var(--color-primary-700)] text-white border-white/10 hover:bg-[var(--color-alert-600)]'
              )}
            >
              <Icons.shield className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1 text-left">Workplace concern</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('wage-hour-report')}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold transition-colors border',
                activePage === 'wage-hour-report' || activePage.startsWith('wage-hour-intake/')
                  ? 'bg-emerald-700 text-white border-white/20'
                  : 'bg-emerald-900/80 text-white border-white/10 hover:bg-emerald-700'
              )}
            >
              <Icons.reports className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1 text-left">Wage &amp; hour</span>
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
              (activePage === 'prompt-response-detail')) ||
            (item.id === 'case-register' &&
              (activePage === 'report-detail' || activePage === 'case-register')) ||
            (currentRole === 'EMPLOYEE' && item.id === 'home' && (activePage === 'report-new' || activePage === 'wage-hour-report' || activePage.startsWith('wage-hour-intake/')));

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => goNav(item)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm font-medium transition-colors border border-transparent',
                isActive
                  ? 'bg-[var(--color-primary-500)] text-white border-white/20'
                  : 'text-white/70 hover:bg-[var(--color-primary-700)] hover:text-white'
              )}
            >
              <Icon className={cn('h-4.5 w-4.5 flex-shrink-0', isActive ? 'text-white' : 'text-white/55')} />
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
        <SheetContent side="left" className="w-64 p-0">
          <div className="pt-16">
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
