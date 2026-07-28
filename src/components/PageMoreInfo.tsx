import type { ReactNode } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Icons } from '@/lib/icons';
import { cn } from '@/lib/utils';

interface PageMoreInfoProps {
  children: ReactNode;
  /** Underlined trigger label under the page title. */
  label?: string;
  className?: string;
}

/** Compact expandable page intro - keeps headers clean while preserving help text. */
export function PageMoreInfo({ children, label = 'More info', className }: PageMoreInfoProps) {
  return (
    <Collapsible className={cn('mt-1', className)}>
      <CollapsibleTrigger className="group inline-flex items-center gap-1 text-sm text-[var(--mismo-text-secondary)] underline underline-offset-2 decoration-[var(--mismo-text-secondary)]/70 hover:text-[var(--mismo-text)] hover:decoration-[var(--mismo-text)] data-[state=open]:text-[var(--mismo-text)]">
        {label}
        <Icons.chevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 text-sm text-[var(--mismo-text-secondary)] leading-relaxed max-w-3xl">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
