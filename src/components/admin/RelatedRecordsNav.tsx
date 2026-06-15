import { Icons } from '@/lib/icons';
import type { RecordNavTarget } from '@/lib/recordLinks';

const KIND_ICON: Record<RecordNavTarget['kind'], keyof typeof Icons> = {
  employee: 'employees',
  case: 'reports',
  investigation: 'investigations',
  query: 'message',
  prompt: 'message',
  register: 'reports',
};

interface RelatedRecordsNavProps {
  title?: string;
  links: RecordNavTarget[];
  onNavigate: (page: string, params?: Record<string, string>) => void;
  compact?: boolean;
}

export function RelatedRecordsNav({ title = 'Related records', links, onNavigate, compact }: RelatedRecordsNavProps) {
  const unique = links.filter(
    (link, i, arr) =>
      arr.findIndex((x) => x.page === link.page && JSON.stringify(x.params) === JSON.stringify(link.params)) === i
  );

  if (unique.length === 0) return null;

  return (
    <div className={compact ? 'space-y-2' : 'rounded-lg border border-[var(--color-border-200)] bg-[var(--color-surface-100)] p-4 space-y-3'}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{title}</p>
      <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
        {unique.map((link) => {
          const Icon = Icons[KIND_ICON[link.kind]] ?? Icons.reports;
          return (
            <button
              key={`${link.page}-${JSON.stringify(link.params)}`}
              type="button"
              onClick={() => onNavigate(link.page, link.params)}
              className="text-left flex items-start gap-3 p-3 rounded-md border border-[var(--color-border-200)] bg-white hover:border-[var(--mismo-blue)] hover:bg-[var(--mismo-blue-light)]/30 transition-colors min-h-[44px] touch-manipulation"
            >
              <div className="w-9 h-9 rounded-md bg-[var(--color-surface-200)] flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-[var(--mismo-blue)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{link.label}</p>
                {link.sublabel && (
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">{link.sublabel}</p>
                )}
              </div>
              <Icons.chevronRight className="h-4 w-4 text-[var(--color-text-muted)] shrink-0 mt-0.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Inline text link for tables and breadcrumbs. */
export function RecordLink({
  label,
  onClick,
  className = 'text-[var(--mismo-blue)] hover:underline',
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <button type="button" className={className} onClick={onClick}>
      {label}
    </button>
  );
}
