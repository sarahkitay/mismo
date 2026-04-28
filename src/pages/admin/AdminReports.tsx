import type { DataStore } from '@/hooks/useDataStore';
import { AdminCaseRegisterHub } from '@/pages/admin/AdminCaseRegisterHub';

interface AdminReportsProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  initialFilters?: Record<string, string>;
}

export function AdminReports({ dataStore, onNavigate, initialFilters }: AdminReportsProps) {
  return <AdminCaseRegisterHub dataStore={dataStore} onNavigate={onNavigate} initialFilters={initialFilters} entry="reports" />;
}
