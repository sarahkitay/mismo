import { INDUSTRY_CHECKLIST_SECTIONS } from '@/data/industryChecklist';
import type { ReportChecklistItem } from '@/types';

export function createIndustryChecklistForReport(): ReportChecklistItem[] {
  const items: ReportChecklistItem[] = [];
  let globalOrder = 0;
  for (const section of INDUSTRY_CHECKLIST_SECTIONS) {
    for (const label of section.items) {
      items.push({
        id: `check-${section.id}-${globalOrder}`,
        sectionId: section.id,
        sectionLabel: section.label,
        label,
        order: globalOrder,
        completed: false,
      });
      globalOrder += 1;
    }
  }
  return items;
}
