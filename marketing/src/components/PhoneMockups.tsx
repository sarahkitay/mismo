export function PhoneMockups() {
  return (
    <div className="phones" aria-hidden="true">
      <div className="phone phone-welcome">
        <div className="phone-screen phone-screen-welcome">
          <h3>
            Welcome To
            <br />
            Mismo!
          </h3>
        </div>
      </div>

      <div className="phone phone-dash">
        <div className="phone-screen phone-screen-dash">
          <div className="dash-topbar">
            <span className="dash-brand">mismo</span>
            <span className="dash-role">HR</span>
          </div>

          <div className="dash-body">
            <p className="dash-eyebrow">Command center</p>
            <h4 className="dash-title">Risk Command Center</h4>

            <div className="dash-card dash-action">
              <div className="dash-card-head">
                <span>Action required</span>
                <span className="dash-count">3</span>
              </div>
              <ul className="dash-list">
                <li>
                  <span>Yes responses needing review</span>
                  <strong>2</strong>
                </li>
                <li>
                  <span>Open investigations</span>
                  <strong>1</strong>
                </li>
                <li>
                  <span>Memo sign-offs pending</span>
                  <strong>4</strong>
                </li>
              </ul>
              <div className="dash-cta">Open action register →</div>
            </div>

            <div className="dash-metrics">
              <div className="dash-metric">
                <span>Open reports</span>
                <strong>5</strong>
              </div>
              <div className="dash-metric">
                <span>At risk</span>
                <strong>2</strong>
              </div>
            </div>

            <div className="dash-card dash-score">
              <span>Analytics index</span>
              <strong>8.4</strong>
              <p>Weighted compliance snapshot</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
