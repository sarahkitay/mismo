import { useEffect, useRef } from 'react';
import type { MarketingPage } from '../App';
import { PhoneMockups } from '../components/PhoneMockups';
import { inviteMailto } from '../config';

interface HomePageProps {
  onNavigate: (page: MarketingPage) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const featureRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = featureRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.disconnect();
          }
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">Workplace. Accountable.</p>
            <h1>Proactively resolve workplace issues.</h1>
            <div className="hero-cta">
              <a className="btn btn-dark" href={inviteMailto()}>
                Request Invitation
              </a>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-blob" />
            <PhoneMockups />
          </div>
        </div>
      </section>

      <section className="feature-band">
        <div className="feature-inner" ref={featureRef}>
          <p className="feature-kicker">Proactive Employee Engagement</p>
          <h2>Encourage incident reporting, automatically</h2>
          <p>
            With Mismo&apos;s automated prompts, encourage your staff to report any errors or potential
            violations.
          </p>
          <a
            href="/features"
            className="text-link"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('features');
            }}
          >
            See All Features <span className="arrow" aria-hidden="true">→</span>
          </a>
        </div>
      </section>
    </>
  );
}
