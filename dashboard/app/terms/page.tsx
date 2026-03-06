"use client";

export default function TermsPage() {
    return (
        <>
            <style jsx global>{`
        :root {
          --bg: #0d0d0f;
          --surface: #141418;
          --border: #1e1e26;
          --accent: #7c6af7;
          --accent-soft: rgba(124, 106, 247, 0.12);
          --text: #e8e8f0;
          --muted: #6b6b80;
          --heading: #ffffff;
          --warning: rgba(251, 191, 36, 0.12);
          --warning-border: rgba(251, 191, 36, 0.25);
          --warning-text: #fbbf24;
        }
        body { background: var(--bg); }
      `}</style>
            <style jsx>{`
        .page-wrapper {
          min-height: 100vh;
          color: var(--text);
          font-family: 'DM Sans', -apple-system, sans-serif;
          font-size: 16px;
          line-height: 1.75;
          position: relative;
        }
        .page-wrapper::before {
          content: '';
          position: fixed;
          top: -200px;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(124,106,247,0.08) 0%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }
        nav {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(13,13,15,0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
          padding: 0 2rem;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .logo {
          font-weight: 700;
          font-size: 1.2rem;
          color: var(--heading);
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .logo-dot {
          width: 8px;
          height: 8px;
          background: var(--accent);
          border-radius: 50%;
          display: inline-block;
        }
        .nav-links { display: flex; gap: 1.5rem; }
        .nav-links a {
          color: var(--muted);
          text-decoration: none;
          font-size: 0.875rem;
          transition: color 0.2s;
        }
        .nav-links a:hover { color: var(--text); }
        .nav-links a.active { color: var(--accent); }
        .container {
          max-width: 760px;
          margin: 0 auto;
          padding: 4rem 2rem 6rem;
          position: relative;
          z-index: 1;
        }
        .page-header {
          margin-bottom: 3rem;
          padding-bottom: 2rem;
          border-bottom: 1px solid var(--border);
        }
        .badge {
          display: inline-block;
          background: var(--accent-soft);
          color: var(--accent);
          font-size: 0.75rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 0.3rem 0.75rem;
          border-radius: 20px;
          margin-bottom: 1rem;
          border: 1px solid rgba(124,106,247,0.2);
        }
        h1 {
          font-size: clamp(2rem, 5vw, 2.75rem);
          font-weight: 700;
          color: var(--heading);
          line-height: 1.15;
          margin-bottom: 1rem;
        }
        .meta { color: var(--muted); font-size: 0.875rem; }
        .toc {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 3rem;
        }
        .toc-title {
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 1rem;
        }
        .toc-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.4rem;
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .toc-grid a {
          color: var(--text);
          text-decoration: none;
          font-size: 0.875rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: color 0.2s;
        }
        .toc-grid a:hover { color: var(--accent); }
        .toc-num {
          color: var(--accent);
          font-size: 0.75rem;
          font-weight: 600;
        }
        section { margin-bottom: 3rem; }
        h2 {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--heading);
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .section-num {
          background: var(--accent-soft);
          color: var(--accent);
          font-size: 0.7rem;
          font-weight: 700;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1px solid rgba(124,106,247,0.2);
        }
        p { margin-bottom: 1rem; }
        ul { padding-left: 1.5rem; margin-bottom: 1rem; }
        li { margin-bottom: 0.4rem; }
        .highlight-box {
          background: var(--accent-soft);
          border: 1px solid rgba(124,106,247,0.2);
          border-left: 3px solid var(--accent);
          border-radius: 8px;
          padding: 1rem 1.25rem;
          margin: 1.5rem 0;
          font-size: 0.9rem;
        }
        .warning-box {
          background: var(--warning);
          border: 1px solid var(--warning-border);
          border-left: 3px solid var(--warning-text);
          border-radius: 8px;
          padding: 1rem 1.25rem;
          margin: 1.5rem 0;
          font-size: 0.9rem;
          color: var(--text);
        }
        .plan-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin: 1.5rem 0;
        }
        .plan-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.25rem;
        }
        .plan-card.pro {
          border-color: rgba(124,106,247,0.3);
          background: linear-gradient(135deg, rgba(124,106,247,0.05), var(--surface));
        }
        .plan-name {
          font-weight: 600;
          color: var(--heading);
          margin-bottom: 0.5rem;
          font-size: 0.95rem;
        }
        .plan-card.pro .plan-name { color: var(--accent); }
        .plan-card ul {
          padding-left: 1rem;
          margin: 0;
          font-size: 0.875rem;
          color: var(--muted);
        }
        .plan-card ul li { margin-bottom: 0.25rem; }
        a { color: var(--accent); text-decoration: none; }
        a:hover { text-decoration: underline; }
        .contact-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .contact-icon {
          width: 44px;
          height: 44px;
          background: var(--accent-soft);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          flex-shrink: 0;
          border: 1px solid rgba(124,106,247,0.2);
        }
        code {
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          font-size: 0.85em;
        }
        footer {
          border-top: 1px solid var(--border);
          padding: 2rem;
          text-align: center;
          color: var(--muted);
          font-size: 0.8rem;
          position: relative;
          z-index: 1;
        }
        footer a { color: var(--muted); text-decoration: none; }
        footer a:hover { color: var(--accent); }
        @media (max-width: 600px) {
          .toc-grid { grid-template-columns: 1fr; }
          .plan-grid { grid-template-columns: 1fr; }
          nav { padding: 0 1rem; }
          .container { padding: 2rem 1rem 4rem; }
        }
      `}</style>

            <div className="page-wrapper">
                <nav>
                    <a href="/" className="logo"><span className="logo-dot"></span>Aura</a>
                    <div className="nav-links">
                        <a href="/privacy">Privacy</a>
                        <a href="/terms" className="active">Terms</a>
                    </div>
                </nav>

                <div className="container">
                    <div className="page-header">
                        <div className="badge">Legal</div>
                        <h1>Terms of Service</h1>
                        <p className="meta">Last updated: March 6, 2026 &nbsp;·&nbsp; Effective: March 6, 2026</p>
                    </div>

                    <div className="highlight-box">
                        By using Aura — via Telegram, the web dashboard, or any other channel — you agree to these terms. Please read them. They&apos;re written in plain language.
                    </div>

                    <div className="toc">
                        <div className="toc-title">Table of Contents</div>
                        <div className="toc-grid">
                            <a href="#service"><span className="toc-num">01</span> The Service</a>
                            <a href="#accounts"><span className="toc-num">02</span> Your Account</a>
                            <a href="#plans"><span className="toc-num">03</span> Free &amp; Paid Plans</a>
                            <a href="#acceptable"><span className="toc-num">04</span> Acceptable Use</a>
                            <a href="#data"><span className="toc-num">05</span> Your Data</a>
                            <a href="#availability"><span className="toc-num">06</span> Availability</a>
                            <a href="#liability"><span className="toc-num">07</span> Liability</a>
                            <a href="#termination"><span className="toc-num">08</span> Termination</a>
                            <a href="#changes"><span className="toc-num">09</span> Changes to Terms</a>
                            <a href="#contact"><span className="toc-num">10</span> Contact</a>
                        </div>
                    </div>

                    <section id="service">
                        <h2><span className="section-num">01</span>The Service</h2>
                        <p>Aura is a personal finance tracking tool accessible via Telegram bot and a web dashboard. It allows you to log income and expenses, set budgets, and view spending analytics.</p>
                        <p>Aura is a <strong>tracking tool only</strong> — it does not provide financial advice, banking services, or investment recommendations. Nothing in the app should be considered professional financial advice.</p>
                    </section>

                    <section id="accounts">
                        <h2><span className="section-num">02</span>Your Account</h2>
                        <p>Your Aura account is created automatically when you first message the bot on Telegram. By doing so, you confirm that:</p>
                        <ul>
                            <li>You are at least 13 years old</li>
                            <li>The information you provide is accurate</li>
                            <li>You are responsible for all activity under your account</li>
                            <li>You will not share your account with others</li>
                        </ul>
                        <p>You are responsible for keeping your dashboard login credentials secure. Notify us immediately if you suspect unauthorized access.</p>
                    </section>

                    <section id="plans">
                        <h2><span className="section-num">03</span>Free &amp; Paid Plans</h2>
                        <div className="plan-grid">
                            <div className="plan-card">
                                <div className="plan-name">Free Plan</div>
                                <ul>
                                    <li>Transaction logging</li>
                                    <li>Basic summaries</li>
                                    <li>Category budgets</li>
                                    <li>Dashboard access</li>
                                    <li>Daily notifications</li>
                                </ul>
                            </div>
                            <div className="plan-card pro">
                                <div className="plan-name">Pro Plan ✦</div>
                                <ul>
                                    <li>Everything in Free</li>
                                    <li>Advanced analytics</li>
                                    <li>CSV/PDF export</li>
                                    <li>Priority support</li>
                                    <li>Early access to features</li>
                                </ul>
                            </div>
                        </div>
                        <p>Paid plan pricing and billing details are displayed at the point of purchase. Subscriptions renew automatically unless cancelled. Refunds are handled on a case-by-case basis — contact us within 7 days of a charge if you believe there&apos;s been an error.</p>
                    </section>

                    <section id="acceptable">
                        <h2><span className="section-num">04</span>Acceptable Use</h2>
                        <p>You agree not to:</p>
                        <ul>
                            <li>Attempt to reverse engineer, hack, or disrupt the service</li>
                            <li>Use the service to store illegal financial activity records</li>
                            <li>Create multiple accounts to circumvent free plan limits</li>
                            <li>Automate requests in a way that burdens our infrastructure</li>
                            <li>Attempt to access another user&apos;s data</li>
                            <li>Use the service for any unlawful purpose</li>
                        </ul>
                        <div className="warning-box">
                            Violation of these terms may result in immediate account suspension without notice.
                        </div>
                    </section>

                    <section id="data">
                        <h2><span className="section-num">05</span>Your Data</h2>
                        <p>You own your data. We store it to provide the service, not to profit from it. See our <a href="/privacy">Privacy Policy</a> for full details on what we collect and how we use it.</p>
                        <p>You can export your data at any time from the dashboard, and permanently delete everything using <code>/deleteaccount</code>.</p>
                    </section>

                    <section id="availability">
                        <h2><span className="section-num">06</span>Availability</h2>
                        <p>We aim to keep Aura running reliably but we do not guarantee 100% uptime. The service may be temporarily unavailable due to maintenance, infrastructure issues, or events outside our control.</p>
                        <p>We are not liable for any losses resulting from service downtime or data loss, though we take all reasonable precautions (including daily backups) to prevent such issues.</p>
                    </section>

                    <section id="liability">
                        <h2><span className="section-num">07</span>Liability</h2>
                        <p>Aura is provided <strong>&quot;as is&quot;</strong> without warranties of any kind. To the fullest extent permitted by law:</p>
                        <ul>
                            <li>We are not liable for financial decisions made based on data shown in the app</li>
                            <li>We are not liable for indirect, incidental, or consequential damages</li>
                            <li>Our total liability to you shall not exceed the amount you paid us in the 3 months prior to the claim</li>
                        </ul>
                        <p>Aura displays the data you enter. You are responsible for the accuracy of your entries.</p>
                    </section>

                    <section id="termination">
                        <h2><span className="section-num">08</span>Termination</h2>
                        <p><strong>You</strong> can delete your account at any time by sending <code>/deleteaccount</code> to the bot. All your data will be permanently removed.</p>
                        <p><strong>We</strong> may suspend or terminate accounts that violate these terms, with or without notice depending on the severity of the violation. In cases of non-malicious violations, we will attempt to notify you first.</p>
                    </section>

                    <section id="changes">
                        <h2><span className="section-num">09</span>Changes to Terms</h2>
                        <p>We may update these terms from time to time. For material changes, we will notify you via the Aura bot at least 7 days before they take effect. Your continued use of Aura after the effective date means you accept the updated terms.</p>
                        <p>Minor changes (typos, clarifications) may be made without notice.</p>
                    </section>

                    <section id="contact">
                        <h2><span className="section-num">10</span>Contact</h2>
                        <p>Questions about these terms or anything else:</p>
                        <div className="contact-card">
                            <div className="contact-icon">✉️</div>
                            <div>
                                <div style={{ fontWeight: 500, color: 'var(--heading)' }}>Aura Support</div>
                                <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Reach us via Telegram bot or the contact details in the bot&apos;s /help command</div>
                            </div>
                        </div>
                    </section>
                </div>

                <footer>
                    <p>© 2026 Aura Finance Tracker &nbsp;·&nbsp; <a href="/privacy">Privacy Policy</a> &nbsp;·&nbsp; <a href="/terms">Terms of Service</a></p>
                </footer>
            </div>
        </>
    );
}
