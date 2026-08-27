import { useEffect, useState, useCallback, useRef } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';
import { Icons } from '@/lib/icons';
import { InvestigationWorkspace } from '@/components/admin/investigation/InvestigationWorkspace';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';
import { investigationHasUnsavedDrafts, unsavedInvestigationDraftLabels } from '@/lib/investigationDraftRegistry';
import type { InvestigationTab } from '@/lib/investigationWorkflow';
import { parseInvestigationTab } from '@/lib/investigationWorkflow';
import { toast } from 'sonner';

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
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const pendingLeaveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setActiveTab(parseTab(initialTab));
  }, [investigationId, initialTab]);

  const requestLeave = useCallback(
    (action: () => void) => {
      if (!investigationHasUnsavedDrafts(investigationId)) {
        action();
        return;
      }
      pendingLeaveRef.current = action;
      setUnsavedDialogOpen(true);
    },
    [investigationId]
  );

  const handleTabChange = (tab: InvestigationTab) => {
    setActiveTab(tab);
    onNavigate('investigation-detail', { id: investigationId, tab });
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" className="enterprise-interactive w-fit" onClick={() => requestLeave(() => onNavigate('investigations'))}>
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
      <UnsavedChangesDialog
        open={unsavedDialogOpen}
        onOpenChange={setUnsavedDialogOpen}
        detail={
          unsavedInvestigationDraftLabels(investigationId).length
            ? `Unsaved: ${unsavedInvestigationDraftLabels(investigationId).join(', ')}`
            : undefined
        }
        onSave={() => {
          dataStore.saveInvestigationProgress?.(investigationId);
          toast.success('Progress saved.');
          setUnsavedDialogOpen(false);
          pendingLeaveRef.current?.();
          pendingLeaveRef.current = null;
        }}
        onDiscard={() => {
          setUnsavedDialogOpen(false);
          pendingLeaveRef.current?.();
          pendingLeaveRef.current = null;
        }}
      />
    </div>
  );
}
