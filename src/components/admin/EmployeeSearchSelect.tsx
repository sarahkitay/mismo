import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@/types';
import { Input } from '@/components/ui/input';
import { Icons } from '@/lib/icons';
import { cn } from '@/lib/utils';

export type EmployeeSearchOption = {
  id: string;
  label: string;
  sublabel?: string;
};

function userToOption(user: User): EmployeeSearchOption {
  return {
    id: user.id,
    label: `${user.firstName} ${user.lastName}`.trim(),
    sublabel: user.email || user.employeeId || undefined,
  };
}

function matchesQuery(option: EmployeeSearchOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${option.label} ${option.sublabel ?? ''}`.toLowerCase();
  return q.split(/\s+/).every((part) => haystack.includes(part));
}

interface EmployeeSearchSelectProps {
  options: EmployeeSearchOption[];
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
}

/** Type-ahead employee picker — filters as you type instead of scrolling a long list. */
export function EmployeeSearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Type a name to search…',
  emptyMessage = 'No matching employees',
  className,
  disabled,
}: EmployeeSearchSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (!value) return;
    if (selected) setQuery(selected.label);
  }, [value, selected]);

  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const filtered = useMemo(() => {
    const matches = options.filter((o) => matchesQuery(o, query));
    return matches.slice(0, 50);
  }, [options, query]);

  return (
    <div ref={rootRef} className={cn('relative w-[260px]', className)}>
      <div className="relative">
        <Icons.search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <Input
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          className="pl-8 pr-8"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value) onChange('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter' && filtered.length === 1) {
              e.preventDefault();
              onChange(filtered[0].id);
              setQuery(filtered[0].label);
              setOpen(false);
            }
          }}
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {(query || value) && !disabled && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            aria-label="Clear selection"
            onClick={() => {
              setQuery('');
              onChange('');
              setOpen(true);
            }}
          >
            <Icons.x className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-[var(--color-border-200)] bg-[var(--color-surface-100)] shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">{emptyMessage}</p>
          ) : (
            <ul role="listbox">
              {filtered.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.id === value}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-200)]',
                      option.id === value && 'bg-[var(--color-surface-200)]'
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(option.id);
                      setQuery(option.label);
                      setOpen(false);
                    }}
                  >
                    <span className="font-medium text-[var(--color-text-primary)]">{option.label}</span>
                    {option.sublabel && (
                      <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">{option.sublabel}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function employeesToSearchOptions(users: User[]): EmployeeSearchOption[] {
  return users
    .map(userToOption)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}
