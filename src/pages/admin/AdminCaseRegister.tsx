import type { DataStore } from '@/hooks/useDataStore';
import { AdminCaseRegisterHub } from '@/pages/admin/AdminCaseRegisterHub';

interface AdminCaseRegisterProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  initialFilters?: Record<string, string>;
}

export function AdminCaseRegister({ dataStore, onNavigate, initialFilters }: AdminCaseRegisterProps) {
  return (
    <AdminCaseRegisterHub
      dataStore={dataStore}
      onNavigate={onNavigate}
      hubPage="case-register"
      initialFilters={{ view: 'register', register: '1', ...initialFilters }}
    />
  );
}
