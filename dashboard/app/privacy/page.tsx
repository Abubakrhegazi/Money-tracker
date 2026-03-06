"use client";

export default function PrivacyPage() {
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
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5rem 0;
          font-size: 0.875rem;
        }
        .data-table th {
          background: var(--surface);
          color: var(--muted);
          font-weight: 500;
          font-size: 0.75rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 0.75rem 1rem;
          text-align: left;
          border-bottom: 1px solid var(--border);
        }
        .data-table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border);
          vertical-align: top;
        }
        .data-table tr:last-child td { border-bottom: none; }
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
        code {
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          font-size: 0.85em;
        }
        @media (max-width: 600px) {
          .toc-grid { grid-template-columns: 1fr; }
          nav { padding: 0 1rem; }
          .container { padding: 2rem 1rem 4rem; }
        }
      `}</style>

            <div className="page-wrapper">
                <nav>
                    <a href="/" className="logo"><span className="logo-dot"></span>Aura</a>
                    <div className="nav-links">
                        <a href="/privacy" className="active">Privacy</a>
                        <a href="/terms">Terms</a>
                    </div>
                </nav>

                <div className="container">
                    <div className="page-header">
                        <div className="badge">Legal</div>
                        <h1>Privacy Policy</h1>
                        <p className="meta">Last updated: March 6, 2026 &nbsp;·&nbsp; Effective: March 6, 2026</p>
                    </div>

                    <div className="highlight-box">
                        <strong>Summary:</strong> Aura collects only what&apos;s needed to track your finances. We never sell your data, never share it with advertisers, and you can delete everything at any time by typing <code>/deleteaccount</code>.
                    </div>

                    <div className="toc">
                        <div className="toc-title">Table of Contents</div>
                        <div className="toc-grid">
                            <a href="#information"><span className="toc-num">01</span> Information We Collect</a>
                            <a href="#how-we-use"><span className="toc-num">02</span> How We Use It</a>
                            <a href="#storage"><span className="toc-num">03</span> Data Storage</a>
                            <a href="#sharing"><span className="toc-num">04</span> Data Sharing</a>
                            <a href="#retention"><span className="toc-num">05</span> Data Retention</a>
                            <a href="#rights"><span className="toc-num">06</span> Your Rights</a>
                            <a href="#security"><span className="toc-num">07</span> Security</a>
                            <a href="#children"><span className="toc-num">08</span> Children</a>
                            <a href="#changes"><span className="toc-num">09</span> Policy Changes</a>
                            <a href="#contact"><span className="toc-num">10</span> Contact Us</a>
                        </div>
                    </div>

                    <section id="information">
                        <h2><span className="section-num">01</span>Information We Collect</h2>
                        <p>We collect the minimum data necessary to provide Aura&apos;s finance tracking features.</p>
                        <table className="data-table">
                            <thead>
                                <tr><th>Data Type</th><th>What We Collect</th><th>Why</th></tr>
                            </thead>
                            <tbody>
                                <tr><td><strong>Account</strong></td><td>Telegram ID, display name</td><td>Identify your account</td></tr>
                                <tr><td><strong>Transactions</strong></td><td>Amount, category, merchant, date, type</td><td>Core app functionality</td></tr>
                                <tr><td><strong>Budgets</strong></td><td>Category limits you set</td><td>Budget tracking feature</td></tr>
                                <tr><td><strong>Preferences</strong></td><td>Notification settings, timezone</td><td>Personalize your experience</td></tr>
                                <tr><td><strong>Usage logs</strong></td><td>Errors, timestamps (no message content)</td><td>Debugging and stability</td></tr>
                            </tbody>
                        </table>
                        <p>We do <strong>not</strong> collect your bank details, passwords, payment card numbers, or the full text of your Telegram messages beyond what you explicitly send to Aura.</p>
                    </section>

                    <section id="how-we-use">
                        <h2><span className="section-num">02</span>How We Use Your Data</h2>
                        <ul>
                            <li>To record and display your financial transactions</li>
                            <li>To generate summaries, reports, and budget alerts</li>
                            <li>To send you notification summaries you&apos;ve opted into</li>
                            <li>To improve bot accuracy and fix bugs</li>
                            <li>To respond to support requests</li>
                        </ul>
                        <p>We never use your data for advertising, profiling, or any purpose unrelated to providing Aura&apos;s service.</p>
                    </section>

                    <section id="storage">
                        <h2><span className="section-num">03</span>Data Storage</h2>
                        <p>Your data is stored in a PostgreSQL database hosted on <strong>Railway</strong> (infrastructure provider). Database backups are stored on <strong>Cloudflare R2</strong>. Both providers maintain industry-standard security practices.</p>
                        <p>All data is stored with encryption at rest. Backups are retained for 30 days then automatically deleted.</p>
                    </section>

                    <section id="sharing">
                        <h2><span className="section-num">04</span>Data Sharing</h2>
                        <p>We do <strong>not</strong> sell, rent, or share your personal data with third parties, except:</p>
                        <ul>
                            <li><strong>Infrastructure providers</strong> — Railway (hosting), Cloudflare (backups), Groq (AI parsing) — who process data only to deliver the service and are bound by their own privacy policies</li>
                            <li><strong>Legal requirements</strong> — if required by law, court order, or to protect the rights and safety of users</li>
                        </ul>
                        <p>No advertisers, data brokers, or analytics companies ever receive your data.</p>
                    </section>

                    <section id="retention">
                        <h2><span className="section-num">05</span>Data Retention</h2>
                        <p>We retain your data for as long as your account is active. When you delete your account:</p>
                        <ul>
                            <li>All transactions are permanently deleted within 24 hours</li>
                            <li>All budgets and preferences are permanently deleted</li>
                            <li>Backup copies are purged within 30 days (the backup retention window)</li>
                            <li>Anonymized error logs may be retained for up to 90 days</li>
                        </ul>
                    </section>

                    <section id="rights">
                        <h2><span className="section-num">06</span>Your Rights</h2>
                        <p>You have the right to:</p>
                        <ul>
                            <li><strong>Access</strong> — request a copy of all data we hold about you</li>
                            <li><strong>Correction</strong> — fix inaccurate data via the dashboard or bot</li>
                            <li><strong>Deletion</strong> — permanently delete all your data by typing <code>/deleteaccount</code> in the bot</li>
                            <li><strong>Portability</strong> — export your transactions to CSV from the dashboard</li>
                            <li><strong>Objection</strong> — opt out of non-essential data processing</li>
                        </ul>
                        <div className="highlight-box">
                            To delete your account and all associated data, send <strong>/deleteaccount</strong> to the Aura bot on Telegram. This is immediate and irreversible.
                        </div>
                    </section>

                    <section id="security">
                        <h2><span className="section-num">07</span>Security</h2>
                        <p>We take security seriously. Measures in place include:</p>
                        <ul>
                            <li>HTTPS everywhere — all data in transit is encrypted</li>
                            <li>JWT authentication with short-lived tokens</li>
                            <li>Rate limiting on all API endpoints</li>
                            <li>Input sanitization to prevent injection attacks</li>
                            <li>Webhook signature verification for Telegram</li>
                            <li>Daily encrypted database backups</li>
                        </ul>
                        <p>If you discover a security vulnerability, please contact us at the address below rather than disclosing it publicly.</p>
                    </section>

                    <section id="children">
                        <h2><span className="section-num">08</span>Children</h2>
                        <p>Aura is available to all users. However, we do not knowingly collect data from children under 13. If you believe a child under 13 has created an account, please contact us and we will delete their data promptly.</p>
                    </section>

                    <section id="changes">
                        <h2><span className="section-num">09</span>Policy Changes</h2>
                        <p>If we make material changes to this policy, we will notify you via a message from the Aura bot on Telegram at least 7 days before the changes take effect. Continued use of Aura after that date constitutes acceptance of the updated policy.</p>
                    </section>

                    <section id="contact">
                        <h2><span className="section-num">10</span>Contact Us</h2>
                        <p>Questions, requests, or concerns about this privacy policy:</p>
                        <div className="contact-card">
                            <div className="contact-icon">✉️</div>
                            <div>
                                <div style={{ fontWeight: 500, color: 'var(--heading)' }}>Aura Support</div>
                                <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Reach us via Telegram bot or email listed in the bot&apos;s /help command</div>
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
