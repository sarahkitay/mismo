import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getInitials } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { TopNavNotifications } from '@/components/TopNavNotifications';

interface TopNavProps {
  dataStore: DataStore;
  onMenuClick?: () => void;
  onNavigate?: (page: string, params?: Record<string, string>) => void;
}

function roleLabel(role: DataStore['currentRole']): string {
  if (role === 'SUPER_ADMIN') return 'Mismo Internal';
  if (role === 'HR' || role === 'MANAGER' || role === 'ADMIN') return 'Human Resources';
  if (role === 'CLIENT') return 'Client';
  if (role === 'EMPLOYEE') return 'Employee';
  return role;
}

export function TopNav({ dataStore, onMenuClick, onNavigate }: TopNavProps) {
  const { currentUser, currentRole, switchRole, logout, users, setPreviewUserId } = dataStore;
  const directoryRole = users.find((u) => u.id === currentUser.id)?.role;
  /** Only platform super-admins can switch preview roles. HR users stay in HR. */
  const showRoleSwitcher = directoryRole === 'SUPER_ADMIN';
  const isEmployee = currentRole === 'EMPLOYEE';

  const handleSwitchToHR = () => {
    switchRole('HR');
    onNavigate?.('dashboard');
  };

  const handleSwitchToMismoInternal = () => {
    switchRole('SUPER_ADMIN');
    onNavigate?.('clients');
  };

  const handleSwitchToClient = () => {
    switchRole('CLIENT');
    onNavigate?.('client-dashboard');
  };

  const handleViewAsEmployee = () => {
    const employee = users.find((u) => u.role === 'EMPLOYEE');
    if (employee) {
      setPreviewUserId(employee.id);
      onNavigate?.('home', { previewEmployee: 'true' });
    }
  };

  const handleExportData = () => {
    const payload = localStorage.getItem('mismo_app_v1') ?? '{}';
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mismo-audit-export-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-[var(--color-primary-900)] border-b border-[var(--color-primary-700)] z-50">
      <div className="h-full flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-white hover:text-white hover:bg-white/10"
            onClick={onMenuClick}
            aria-label="Open menu"
          >
            <Icons.menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <span className="text-xl sm:text-2xl font-bold text-white">Mismo</span>
              <p className="hidden sm:block text-[10px] leading-none text-white/70 truncate">
                Proactive Risk Infrastructure
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {!isEmployee && (
            <button
              type="button"
              onClick={handleExportData}
              className="hidden md:inline text-xs text-white/80 hover:text-white"
            >
              Export Data
            </button>
          )}

          <Badge className="hidden sm:inline-flex bg-[var(--color-emerald-600)] text-white border-0 text-[10px] sm:text-xs">
            {roleLabel(currentRole)}
          </Badge>

          {showRoleSwitcher && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:flex items-center gap-2 bg-white text-[var(--color-text-primary)]"
                >
                  <span className="text-xs text-[var(--color-text-secondary)]">View as:</span>
                  <span className="font-medium">{roleLabel(currentRole)}</span>
                  <Icons.chevronRight className="h-4 w-4 rotate-90" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleSwitchToMismoInternal}>
                  <Icons.shield className="h-4 w-4 mr-2" />
                  Mismo Internal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSwitchToHR}>
                  <Icons.briefcase className="h-4 w-4 mr-2" />
                  Human Resources
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSwitchToClient}>
                  <Icons.building className="h-4 w-4 mr-2" />
                  Client View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleViewAsEmployee}>
                  <Icons.user className="h-4 w-4 mr-2" />
                  View as employee
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <TopNavNotifications dataStore={dataStore} onNavigate={onNavigate} />

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-white">
                {currentUser.firstName} {currentUser.lastName}
              </p>
              <p className="text-xs text-white/70">{roleLabel(currentRole)}</p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  aria-label="Account menu"
                >
                  <span className="text-sm font-semibold text-white">
                    {getInitials(currentUser.firstName, currentUser.lastName)}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {currentUser.firstName} {currentUser.lastName}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">
                      {currentUser.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {currentRole !== 'CLIENT' && (
                  <DropdownMenuItem
                    onClick={() =>
                      onNavigate?.(currentRole === 'EMPLOYEE' ? 'settings' : 'account')
                    }
                  >
                    <Icons.settings className="h-4 w-4 mr-2" />
                    Profile &amp; settings
                  </DropdownMenuItem>
                )}
                {logout && (
                  <DropdownMenuItem
                    onClick={() => logout()}
                    className="text-[var(--color-alert-600)] focus:text-[var(--color-alert-600)]"
                  >
                    <Icons.logout className="h-4 w-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
