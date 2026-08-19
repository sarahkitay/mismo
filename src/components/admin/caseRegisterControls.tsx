import type { ReactNode } from 'react';

export function BucketBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`interactive-control px-3 py-2 border text-sm rounded-md ${active ? 'bg-[var(--mismo-blue)] text-white border-[var(--mismo-blue)]' : 'border-[var(--color-border-200)] bg-white'}`}
    >
      {children}
    </button>
  );
}

export function Tile({
  active,
  onClick,
  label,
  value,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  value: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 border text-left rounded-lg transition-colors ${
        active
          ? 'border-[var(--color-primary-700)] bg-[var(--mismo-blue-light)]'
          : 'border-[var(--color-border-200)] bg-white hover:bg-[var(--color-surface-200)]'
      }`}
    >
      <p className="text-xs text-[var(--color-text-muted)] uppercase">{label}</p>
      <p className="text-xl font-semibold text-[var(--color-text-primary)]">{value}</p>
    </button>
  );
}
