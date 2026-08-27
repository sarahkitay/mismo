type DraftEntry = {
  flush: () => void;
  isDirty: () => boolean;
  label?: string;
};

const entriesByInvestigation = new Map<string, Set<DraftEntry>>();

export function registerInvestigationDraft(investigationId: string, entry: DraftEntry): () => void {
  if (!entriesByInvestigation.has(investigationId)) {
    entriesByInvestigation.set(investigationId, new Set());
  }
  entriesByInvestigation.get(investigationId)!.add(entry);
  return () => {
    entriesByInvestigation.get(investigationId)?.delete(entry);
  };
}

export function investigationHasUnsavedDrafts(investigationId: string): boolean {
  const entries = entriesByInvestigation.get(investigationId);
  if (!entries) return false;
  for (const entry of entries) {
    if (entry.isDirty()) return true;
  }
  return false;
}

export function flushInvestigationDrafts(investigationId: string): void {
  const entries = entriesByInvestigation.get(investigationId);
  if (!entries) return;
  for (const entry of entries) entry.flush();
}

export function unsavedInvestigationDraftLabels(investigationId: string): string[] {
  const entries = entriesByInvestigation.get(investigationId);
  if (!entries) return [];
  return [...entries].filter((e) => e.isDirty()).map((e) => e.label ?? 'Unsaved changes');
}
