import type { DataStore } from '@/hooks/useDataStore';
import { AdminCaseRegisterHub } from '@/pages/admin/AdminCaseRegisterHub';

interface AdminPromptResponsesProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  initialFilters?: Record<string, string>;
}

export function AdminPromptResponses({ dataStore, onNavigate, initialFilters }: AdminPromptResponsesProps) {
  return <AdminCaseRegisterHub dataStore={dataStore} onNavigate={onNavigate} initialFilters={initialFilters} entry="prompt-responses" />;
}
