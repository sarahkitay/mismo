import { inviteMailto } from '../config';

const FEATURES = [
  {
    title: 'Daily check-ins',
    body: 'Automated yes/no prompts surface issues early so HR can act before problems escalate.',
  },
  {
    title: 'Confidential reporting',
    body: 'Employees can raise workplace and wage-hour concerns through a guided, accountable channel.',
  },
  {
    title: 'Case workflows',
    body: 'Track plans, actions, and outcomes with a clear audit trail for every case.',
  },
  {
    title: 'Investigations',
    body: 'Move from intake to resolution with structured investigation modules and documentation.',
  },
  {
    title: 'Memos & acknowledgements',
    body: 'Publish policies and track who has read and acknowledged critical company communications.',
  },
  {
    title: 'Analytics & compliance',
    body: 'See engagement, response rates, and state compliance signals in one place.',
  },
];

export function FeaturesPage() {
  return (
    <>
      <div className="page-hero">
        <p className="eyebrow">Product</p>
        <h1>Everything you need to keep the workplace accountable</h1>
        <p>
          Mismo combines proactive prompts, confidential reporting, and HR workflows so issues are
          found early and handled carefully.
        </p>
      </div>

      <section className="section">
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="feature-card">
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>

        <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'center' }}>
          <a className="btn btn-dark" href={inviteMailto('Mismo features — invitation request')}>
            Request Invitation
          </a>
        </div>
      </section>
    </>
  );
}
