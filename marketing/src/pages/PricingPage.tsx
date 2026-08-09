import { inviteMailto } from '../config';

const PLANS = [
  {
    name: 'Mismo',
    price: '$5',
    period: '/ employee / month',
    blurb: 'Everything your team needs to check in, report, investigate, and stay compliant.',
    features: [
      'Daily incident & wage-hour check-ins',
      'Workplace and compensation reporting',
      'Case register & investigations',
      'Memos, acknowledgements & employee directory',
      'Analytics, notifications & state compliance',
      'Email support',
    ],
    cta: 'Request Invitation',
    subject: 'Mismo plan — $5 per employee',
    featured: true,
    note: 'All product features included. Billed monthly by active employee count.',
  },
  {
    name: 'AI Assistant',
    price: '$199',
    period: '/ month',
    blurb: 'Optional add-on. Mismo AI helps HR draft, navigate, and follow through — training is next.',
    features: [
      'In-app Mismo AI for HR and employees',
      'Draft outreach, case notes & next steps',
      'Guided navigation across reports and memos',
      'Training content & guided learning — coming soon',
    ],
    cta: 'Add AI Assistant',
    subject: 'Mismo AI Assistant — $199/month',
    featured: false,
    note: 'Add-on to Mismo. Training modules will be included as they ship.',
  },
];

export function PricingPage() {
  return (
    <>
      <div className="page-hero">
        <p className="eyebrow">Pricing</p>
        <h1>Simple pricing that scales with your workforce</h1>
        <p>
          <strong>$5 per employee per month</strong> includes every Mismo feature. Add the{' '}
          <strong>AI Assistant for $199 per month</strong> when you want drafting help now — and
          training when it lands.
        </p>
      </div>

      <section className="section">
        <div className="pricing-grid pricing-grid--two">
          {PLANS.map((plan) => (
            <article key={plan.name} className={`price-card${plan.featured ? ' featured' : ''}`}>
              <div>
                <h3>{plan.name}</h3>
                <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)', fontSize: '0.92rem' }}>{plan.blurb}</p>
              </div>
              <p className="price">
                {plan.price} <span>{plan.period}</span>
              </p>
              <ul>
                {plan.features.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {plan.note && <p className="price-note">{plan.note}</p>}
              <a className={`btn ${plan.featured ? 'btn-teal' : 'btn-dark'}`} href={inviteMailto(plan.subject)}>
                {plan.cta}
              </a>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
