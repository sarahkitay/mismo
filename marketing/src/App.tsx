import { useEffect, useState } from 'react';
import { SiteHeader } from './components/SiteHeader';
import { SiteFooter } from './components/SiteFooter';
import { HomePage } from './pages/HomePage';
import { FeaturesPage } from './pages/FeaturesPage';
import { PricingPage } from './pages/PricingPage';

export type MarketingPage = 'home' | 'features' | 'pricing';

function pathToPage(pathname: string): MarketingPage {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path === '/features') return 'features';
  if (path === '/pricing') return 'pricing';
  return 'home';
}

function pageToPath(page: MarketingPage): string {
  if (page === 'features') return '/features';
  if (page === 'pricing') return '/pricing';
  return '/';
}

export default function App() {
  const [page, setPage] = useState<MarketingPage>(() =>
    typeof window !== 'undefined' ? pathToPage(window.location.pathname) : 'home'
  );

  useEffect(() => {
    const onPop = () => setPage(pathToPage(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (next: MarketingPage) => {
    const path = pageToPath(next);
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setPage(next);
    window.scrollTo(0, 0);
  };

  return (
    <div className="site-shell">
      <SiteHeader page={page} onNavigate={navigate} />
      <main className="site-main">
        {page === 'home' && <HomePage onNavigate={navigate} />}
        {page === 'features' && <FeaturesPage />}
        {page === 'pricing' && <PricingPage />}
      </main>
      <SiteFooter page={page} onNavigate={navigate} />
    </div>
  );
}
