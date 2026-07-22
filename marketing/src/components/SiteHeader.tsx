import { useEffect, useState } from 'react';
import type { MarketingPage } from '../App';
import { APP_URL } from '../config';

interface SiteHeaderProps {
  page: MarketingPage;
  onNavigate: (page: MarketingPage) => void;
}

export function SiteHeader({ page, onNavigate }: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = (next: MarketingPage) => {
    onNavigate(next);
    setMenuOpen(false);
  };

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="header-inner">
        <a
          href="/"
          className="logo"
          onClick={(e) => {
            e.preventDefault();
            go('home');
          }}
        >
          mismo
        </a>

        <button
          type="button"
          className="nav-toggle"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`nav-links${menuOpen ? ' is-open' : ''}`} aria-label="Primary">
          <a
            href="/"
            className={page === 'home' ? 'is-active' : undefined}
            onClick={(e) => {
              e.preventDefault();
              go('home');
            }}
          >
            Home
          </a>
          <a
            href="/features"
            className={page === 'features' ? 'is-active' : undefined}
            onClick={(e) => {
              e.preventDefault();
              go('features');
            }}
          >
            Features
          </a>
          <a
            href="/pricing"
            className={page === 'pricing' ? 'is-active' : undefined}
            onClick={(e) => {
              e.preventDefault();
              go('pricing');
            }}
          >
            Pricing
          </a>
          <a href={APP_URL} style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Sign in
          </a>
        </nav>
      </div>
    </header>
  );
}
