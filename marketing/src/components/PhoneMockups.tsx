export function PhoneMockups() {
  return (
    <div className="phones" aria-hidden="true">
      <div className="phone phone-welcome">
        <div className="phone-screen">
          <h3>
            Welcome To
            <br />
            Mismo!
          </h3>
          <svg className="mascot" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="58" r="28" stroke="#fff" strokeWidth="3" />
            <circle cx="50" cy="54" r="3" fill="#fff" />
            <circle cx="70" cy="54" r="3" fill="#fff" />
            <path d="M48 68c4 6 20 6 24 0" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            <path d="M78 42c8-10 18-8 22-2" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            <circle cx="100" cy="34" r="6" stroke="#fff" strokeWidth="2.5" />
            <path d="M40 88h40" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            <path d="M50 88v18M70 88v18" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <div className="phone phone-chat">
        <div className="phone-screen">
          <div className="chat-header">RE: Company Handbook Updates</div>
          <div className="chat-body">
            <div className="bubble">
              <strong>Jane Smith</strong>
              Hi Sandra — can we clarify the updated remote-work section before Friday&apos;s all-hands?
            </div>
            <div className="bubble">
              <strong>Sandra Moreno</strong>
              Absolutely. I&apos;ve attached the revised language and marked the discussion for review.
            </div>
            <div className="chat-actions">
              <div className="mini-btn primary">Resolve Discussion</div>
              <div className="mini-btn ghost">Continue Discussion</div>
            </div>
            <p className="chat-status">
              This discussion has been marked as resolved and closed with confirmation by Sandra Moreno.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
