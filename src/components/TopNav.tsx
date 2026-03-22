import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getInitials } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface TopNavProps {
  dataStore: DataStore;
  onMenuClick?: () => void;
  onNavigate?: (page: string, params?: Record<string, string>) => void;
}

export function TopNav({ dataStore, onMenuClick, onNavigate }: TopNavProps) {
  const { currentUser, currentRole, switchRole, logout, users, setPreviewUserId } = dataStore;
  const isEmployee = currentRole === 'EMPLOYEE';

  const handleSwitchToHR = () => {
    switchRole('HR');
    onNavigate?.('dashboard');
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
        {/* Left: Logo + Menu button */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            <Icons.menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div>
              <span className="text-2xl font-bold text-white">Mismo</span>
              <p className="text-[10px] leading-none text-white/70">Proactive Risk Infrastructure</p>
            </div>
          </div>
        </div>
        
        {/* Right: Role switcher + User */}
        <div className="flex items-center gap-4">
          {!isEmployee && (
            <>
              <button
                type="button"
                onClick={handleExportData}
                className="hidden md:inline text-xs text-white/80 hover:text-white"
              >
                Export Data
              </button>
            </>
          )}
          <Badge className="hidden md:inline-flex bg-[var(--color-emerald-600)] text-white border-0">
            {currentRole === 'SUPER_ADMIN'
              ? 'Super Admin'
              : currentRole === 'HR' || currentRole === 'MANAGER' || currentRole === 'ADMIN'
                ? 'Human Resources'
                : currentRole === 'CLIENT'
                  ? 'Client'
                  : currentRole}
          </Badge>
          {/* Role Switcher: only for HR/Client (employees cannot switch to HR or Client) */}
          {!isEmployee && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-2 bg-white text-[var(--color-text-primary)]">
                  <span className="text-xs text-[var(--color-text-secondary)]">View as:</span>
                  <span className="font-medium">
                    {currentRole === 'HR' || currentRole === 'MANAGER' || currentRole === 'ADMIN'
                      ? 'Human Resources'
                      : currentRole === 'CLIENT'
                        ? 'Client'
                        : currentRole === 'SUPER_ADMIN'
                          ? 'Super Admin'
                          : 'Human Resources'}
                  </span>
                  <Icons.chevronRight className="h-4 w-4 rotate-90" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
                {logout && (
                  <DropdownMenuItem onClick={() => logout()} className="text-[var(--color-alert-600)]">
                    Sign out
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {isEmployee && logout && (
            <Button variant="ghost" size="sm" className="text-white/90 hover:text-white" onClick={() => logout()}>
              Sign out
            </Button>
          )}
          
          {/* User Avatar */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-white">
                {currentUser.firstName} {currentUser.lastName}
              </p>
              <p className="text-xs text-white/70">
                {currentRole === 'EMPLOYEE'
                  ? 'Employee'
                  : currentRole === 'HR' || currentRole === 'MANAGER' || currentRole === 'ADMIN'
                    ? 'Human Resources'
                    : currentRole === 'CLIENT'
                      ? 'Client Viewer'
                      : currentRole === 'SUPER_ADMIN'
                        ? 'Super Admin'
                        : 'Human Resources'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
              <span className="text-sm font-semibold text-white">
                {getInitials(currentUser.firstName, currentUser.lastName)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
