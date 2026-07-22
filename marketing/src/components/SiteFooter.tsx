import type { MarketingPage } from '../App';
import { inviteMailto } from '../config';

interface SiteFooterProps {
  page: MarketingPage;
  onNavigate: (page: MarketingPage) => void;
}

export function SiteFooter({ onNavigate }: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <a
            href="/"
            className="logo"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('home');
            }}
          >
            mismo
          </a>
          <p>Working together for a safe, engaging, and productive workplace.</p>
        </div>

        <nav className="footer-nav" aria-label="Footer">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('home');
            }}
          >
            Home
          </a>
          <a
            href="/features"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('features');
            }}
          >
            Features
          </a>
          <a
            href="/pricing"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('pricing');
            }}
          >
            Pricing
          </a>
          <a href="https://blog.mismo.com" rel="noreferrer">
            Blog
          </a>
        </nav>

        <div className="footer-cta">
          <p>Protecting businesses by protecting employees.</p>
          <a className="btn btn-teal" href={inviteMailto()}>
            Request Invitation
          </a>
          <div>
            <a className="reach-out" href={inviteMailto('Mismo question')}>
              Have a question? Reach Out
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        Copyright {year} © Mismo Inc. | Proudly created in Los Angeles.{' '}
        <a href={inviteMailto('Beta terms')} style={{ color: 'inherit', textDecoration: 'underline' }}>
          Beta Terms &amp; Conditions
        </a>
      </div>
    </footer>
  );
}
