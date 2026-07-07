import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface InvestigationModuleShellProps {
 title: string;
 subtitle: string;
 primaryAction?: ReactNode;
 completionPercent?: number;
 status?: 'not_started' | 'in_progress' | 'complete';
 children: ReactNode;
}

const STATUS_LABELS = {
 not_started: 'Not started',
 in_progress: 'In progress',
 complete: 'Complete',
};

export function InvestigationModuleShell({
 title,
 subtitle,
 primaryAction,
 completionPercent,
 status = 'in_progress',
 children,
}: InvestigationModuleShellProps) {
 return (
 <div className="space-y-4">
 <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
 <div>
 <h2 className="text-xl font-semibold text-[var(--color-primary-900)]">{title}</h2>
 <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-2xl">{subtitle}</p>
 </div>
 <div className="flex flex-wrap items-center gap-2 shrink-0">
 {completionPercent !== undefined && (
 <Badge variant="outline">{completionPercent}% module complete</Badge>
 )}
 <Badge
 className={
 status === 'complete'
 ? 'bg-emerald-100 text-emerald-900'
 : status === 'in_progress'
 ? 'bg-blue-50 text-blue-900'
 : 'bg-[var(--color-surface-200)] text-[var(--color-text-muted)]'
 }
 >
 {STATUS_LABELS[status]}
 </Badge>
 {primaryAction}
 </div>
 </div>
 {children}
 </div>
 );
}

export function InvestigationSubModule({
 title,
 description,
 children,
 badge,
}: {
 title: string;
 description?: string;
 badge?: string;
 children: ReactNode;
}) {
 return (
 <Card className="mismo-card border border-[var(--color-border-200)]">
 <CardContent className="p-5 space-y-3">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h3>
 {badge && <Badge variant="outline" className="text-xs">{badge}</Badge>}
 </div>
 {description && <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>}
 {children}
 </CardContent>
 </Card>
 );
}

export function AIGuidancePanel({
 title = 'AI investigation assistant',
 items,
}: {
 title?: string;
 items: string[];
}) {
 return (
 <Card className="border border-dashed border-[var(--color-primary-700)]/30 bg-gradient-to-br from-blue-50/80 to-[var(--color-surface-100)]">
 <CardContent className="p-4 space-y-2">
 <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary-900)]">{title}</p>
 <ul className="text-sm text-[var(--color-text-secondary)] space-y-1.5 list-disc list-inside">
 {items.map((item) => (
 <li key={item.slice(0, 40)}>{item}</li>
 ))}
 </ul>
 <p className="text-[10px] text-[var(--color-text-muted)] pt-1">
 Preview - connects to your AI provider. No automated decisions are made from this panel.
 </p>
 </CardContent>
 </Card>
 );
}
