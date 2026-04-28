import type { DataStore } from '@/hooks/useDataStore';
import type { IconName } from '@/lib/icons';
import { Icons } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  badge?: number;
}

const employeeNavItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'reports', label: 'My Reports', icon: 'reports' },
  { id: 'resources', label: 'Resources', icon: 'resources' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const adminNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'policies', label: 'Memos & announcements', icon: 'bookOpen' },
  { id: 'users', label: 'Users', icon: 'employees' },
  { id: 'investigations', label: 'Investigations', icon: 'investigations' },
  { id: 'prompts', label: 'Prompts', icon: 'prompts' },
  { id: 'prompt-responses', label: 'Case register & check-ins', icon: 'reports' },
  { id: 'campaigns', label: 'Campaigns', icon: 'campaigns' },
  { id: 'analytics', label: 'Analytics', icon: 'analytics' },
  { id: 'compliance', label: 'Compliance', icon: 'shield' },
  { id: 'system-health', label: 'System Health', icon: 'systemHealth' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const clientNavItems: NavItem[] = [
  { id: 'client-dashboard', label: 'Overview', icon: 'dashboard' },
];

interface SidebarProps {
  dataStore: DataStore;
  activePage: string;
  onNavigate: (page: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

function SidebarContent({ 
  dataStore, 
  activePage, 
  onNavigate 
}: Omit<SidebarProps, 'isOpen' | 'onClose'>) {
  const { currentRole, dashboardCounts, employeeReports } = dataStore;
  const navItems =
    currentRole === 'EMPLOYEE'
      ? employeeNavItems
      : currentRole === 'CLIENT'
        ? clientNavItems
        : adminNavItems;
  
  // Get badge count for nav items
  const getBadgeCount = (itemId: string): number | undefined => {
    if (currentRole === 'CLIENT') return undefined;
    if (currentRole === 'EMPLOYEE') {
      switch (itemId) {
        case 'home':
          return dashboardCounts.scheduledMemos > 0 ? dashboardCounts.scheduledMemos : undefined;
        case 'reports':
          return (employeeReports?.length ?? 0) > 0 ? (employeeReports?.length ?? 0) : undefined;
        default:
          return undefined;
      }
    }
    
    switch (itemId) {
      case 'prompt-responses':
        return dashboardCounts.criticalReports > 0 ? dashboardCounts.criticalReports : undefined;
      case 'investigations':
        return dashboardCounts.activeInvestigations > 0 ? dashboardCounts.activeInvestigations : undefined;
      case 'employees':
      case 'users':
        return dashboardCounts.atRiskEmployees > 0 ? dashboardCounts.atRiskEmployees : undefined;
      case 'prompts':
        return dashboardCounts.scheduledMemos > 0 ? dashboardCounts.scheduledMemos : undefined;
      case 'system-health':
        return dashboardCounts.criticalReports > 0 ? dashboardCounts.criticalReports : undefined;
      default:
        return undefined;
    }
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
        {navItems.map((item) => {
          const Icon = Icons[item.icon];
          const badgeCount = getBadgeCount(item.id);
          const isActive =
            activePage === item.id ||
            (item.id === 'policies' && activePage === 'announcements') ||
            (item.id === 'prompt-responses' && activePage === 'reports');
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
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
      
      {/* Bottom section */}
      <div className="px-4 pt-4 border-t border-[var(--color-primary-700)]">
        <button
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
          onClick={() => onNavigate('settings')}
          className={cn(
            'w-full mt-1 flex items-center gap-2.5 px-3 py-1.5 text-sm font-medium transition-colors border border-transparent',
            activePage === 'settings'
              ? 'bg-[var(--color-primary-500)] text-white border-white/20'
              : 'text-white/70 hover:bg-[var(--color-primary-700)] hover:text-white'
          )}
        >
          <Icons.info className={cn('h-4.5 w-4.5 flex-shrink-0', activePage === 'settings' ? 'text-white' : 'text-white/55')} />
          <span className="flex-1 text-left">AI Guide</span>
        </button>
      </div>
    </nav>
  );
}

export function Sidebar({ 
  dataStore, 
  activePage, 
  onNavigate, 
  isOpen, 
  onClose 
}: SidebarProps) {
  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed left-0 top-16 w-64 h-[calc(100vh-64px)] bg-[var(--color-primary-900)] border-r border-[var(--color-primary-700)] overflow-y-auto z-40 pointer-events-auto">
        <SidebarContent 
          dataStore={dataStore} 
          activePage={activePage} 
          onNavigate={onNavigate} 
        />
      </aside>
      
      {/* Mobile Sidebar */}
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
              onNavigate={(page) => {
                onNavigate(page);
                onClose?.();
              }} 
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
