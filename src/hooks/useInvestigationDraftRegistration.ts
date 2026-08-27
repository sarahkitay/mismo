import { useEffect, useRef } from 'react';
import { registerInvestigationDraft } from '@/lib/investigationDraftRegistry';

export function useInvestigationDraftRegistration(
  investigationId: string,
  label: string,
  isDirty: () => boolean,
  flush: () => void
) {
  const isDirtyRef = useRef(isDirty);
  const flushRef = useRef(flush);
  isDirtyRef.current = isDirty;
  flushRef.current = flush;

  useEffect(() => {
    return registerInvestigationDraft(investigationId, {
      label,
      isDirty: () => isDirtyRef.current(),
      flush: () => flushRef.current(),
    });
  }, [investigationId, label]);
}
