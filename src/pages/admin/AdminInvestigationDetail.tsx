import { useEffect, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';
import { Icons } from '@/lib/icons';
import { InvestigationWorkspace } from '@/components/admin/investigation/InvestigationWorkspace';
import type { InvestigationTab } from '@/lib/investigationWorkflow';
import { parseInvestigationTab } from '@/lib/investigationWorkflow';

interface AdminInvestigationDetailProps {
  dataStore: DataStore;
  investigationId: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  initialTab?: string;
}

function parseTab(raw?: string): InvestigationTab {
  return parseInvestigationTab(raw);
}

export function AdminInvestigationDetail({
  dataStore,
  investigationId,
  onNavigate,
  initialTab,
}: AdminInvestigationDetailProps) {
  const [activeTab, setActiveTab] = useState<InvestigationTab>(() => parseTab(initialTab) || 'page-1');

  useEffect(() => {
    setActiveTab(parseTab(initialTab));
  }, [investigationId, initialTab]);

  const handleTabChange = (tab: InvestigationTab) => {
    setActiveTab(tab);
    onNavigate('investigation-detail', { id: investigationId, tab });
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" className="enterprise-interactive w-fit" onClick={() => onNavigate('investigations')}>
        <Icons.arrowLeft className="h-4 w-4 mr-2" />
        Back to register
      </Button>
      <InvestigationWorkspace
        dataStore={dataStore}
        investigationId={investigationId}
        onNavigate={onNavigate}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
    </div>
  );
}
