/** Credit + dofollow backlink for site builder. */
export const BUILDER_SITE_URL = 'https://www.sarahkitay.com';
export const BUILDER_NAME = 'Sarah Kitay';

type BuiltByCreditProps = {
  className?: string;
  /** Lighter styling for dark sidebars / footers */
  tone?: 'default' | 'onDark' | 'muted' | 'subtle';
};

export function BuiltByCredit({ className = '', tone = 'default' }: BuiltByCreditProps) {
  const linkClass =
    tone === 'onDark'
      ? 'underline underline-offset-2 text-white/80 hover:text-white'
      : tone === 'muted' || tone === 'subtle'
        ? 'underline underline-offset-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
        : 'underline underline-offset-2 text-[var(--color-primary-700)] hover:text-[var(--color-primary-900)]';

  const textClass =
    tone === 'onDark'
      ? 'text-[11px] text-white/45'
      : tone === 'subtle'
        ? 'text-[10px] text-[var(--color-text-muted)]/70'
        : tone === 'muted'
          ? 'text-[11px] text-[var(--color-text-muted)]'
          : 'text-xs text-[var(--color-text-secondary)]';

  return (
    <p className={`${textClass} ${className}`.trim()}>
      Built by{' '}
      <a href={BUILDER_SITE_URL} target="_blank" rel="noopener" className={linkClass}>
        {BUILDER_NAME}
      </a>
    </p>
  );
}
