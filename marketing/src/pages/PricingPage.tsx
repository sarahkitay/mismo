import { inviteMailto } from '../config';

const PLANS = [
  {
    name: 'Starter',
    price: 'Custom',
    blurb: 'For smaller teams getting started with proactive check-ins.',
    features: ['Daily employee check-ins', 'Incident & wage-hour reporting', 'Basic analytics', 'Email support'],
    featured: false,
  },
  {
    name: 'Growth',
    price: 'Custom',
    blurb: 'For organizations that need full case and investigation workflows.',
    features: [
      'Everything in Starter',
      'Investigations & case register',
      'Memos & acknowledgements',
      'AI language assist for outreach',
      'Priority onboarding',
    ],
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    blurb: 'For multi-site companies with advanced compliance needs.',
    features: [
      'Everything in Growth',
      'State compliance tooling',
      'Dedicated success partner',
      'SSO & advanced admin controls',
      'Custom reporting',
    ],
    featured: false,
  },
];

export function PricingPage() {
  return (
    <>
      <div className="page-hero">
        <p className="eyebrow">Pricing</p>
        <h1>Plans that scale with your workforce</h1>
        <p>
          Every engagement is scoped to your employee count and rollout needs. Request an invitation
          and we&apos;ll tailor pricing with you.
        </p>
      </div>

      <section className="section">
        <div className="pricing-grid">
          {PLANS.map((plan) => (
            <article key={plan.name} className={`price-card${plan.featured ? ' featured' : ''}`}>
              <div>
                <h3>{plan.name}</h3>
                <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)', fontSize: '0.92rem' }}>{plan.blurb}</p>
              </div>
              <p className="price">
                {plan.price} <span>/ quote</span>
              </p>
              <ul>
                {plan.features.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <a className={`btn ${plan.featured ? 'btn-teal' : 'btn-dark'}`} href={inviteMailto(`Mismo ${plan.name} plan`)}>
                Request Invitation
              </a>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
