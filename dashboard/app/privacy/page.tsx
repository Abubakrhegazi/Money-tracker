import "../legal.css";

export default function PrivacyPage() {
  return (
    <div className="legal-wrapper">
      <nav className="legal-nav">
        <a href="/" className="legal-logo"><span className="legal-logo-dot"></span>Aura</a>
        <div className="legal-nav-links">
          <a href="/privacy" className="active">Privacy</a>
          <a href="/terms">Terms</a>
        </div>
      </nav>

      <div className="legal-container">
        <div className="legal-header">
          <div className="legal-badge">Legal</div>
          <h1>Privacy Policy</h1>
          <p className="legal-meta">Last updated: March 6, 2026 &nbsp;·&nbsp; Effective: March 6, 2026</p>
        </div>

        <div className="legal-highlight">
          <strong>Summary:</strong> Aura collects only what&apos;s needed to track your finances. We never sell your data, never share it with advertisers, and you can delete everything at any time by typing <code>/deleteaccount</code>.
        </div>

        <div className="legal-toc">
          <div className="legal-toc-title">Table of Contents</div>
          <div className="legal-toc-grid">
            <a href="#information"><span className="legal-toc-num">01</span> Information We Collect</a>
            <a href="#how-we-use"><span className="legal-toc-num">02</span> How We Use It</a>
            <a href="#storage"><span className="legal-toc-num">03</span> Data Storage</a>
            <a href="#sharing"><span className="legal-toc-num">04</span> Data Sharing</a>
            <a href="#retention"><span className="legal-toc-num">05</span> Data Retention</a>
            <a href="#rights"><span className="legal-toc-num">06</span> Your Rights</a>
            <a href="#security"><span className="legal-toc-num">07</span> Security</a>
            <a href="#children"><span className="legal-toc-num">08</span> Children</a>
            <a href="#changes"><span className="legal-toc-num">09</span> Policy Changes</a>
            <a href="#contact"><span className="legal-toc-num">10</span> Contact Us</a>
          </div>
        </div>

        <section id="information">
          <h2><span className="legal-section-num">01</span>Information We Collect</h2>
          <p>We collect the minimum data necessary to provide Aura&apos;s finance tracking features.</p>
          <table className="legal-table">
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
          <h2><span className="legal-section-num">02</span>How We Use Your Data</h2>
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
          <h2><span className="legal-section-num">03</span>Data Storage</h2>
          <p>Your data is stored in a PostgreSQL database hosted on <strong>Railway</strong> (infrastructure provider). Database backups are stored on <strong>Cloudflare R2</strong>. Both providers maintain industry-standard security practices.</p>
          <p>All data is stored with encryption at rest. Backups are retained for 30 days then automatically deleted.</p>
        </section>

        <section id="sharing">
          <h2><span className="legal-section-num">04</span>Data Sharing</h2>
          <p>We do <strong>not</strong> sell, rent, or share your personal data with third parties, except:</p>
          <ul>
            <li><strong>Infrastructure providers</strong> — Railway (hosting), Cloudflare (backups), Groq (AI parsing) — who process data only to deliver the service and are bound by their own privacy policies</li>
            <li><strong>Legal requirements</strong> — if required by law, court order, or to protect the rights and safety of users</li>
          </ul>
          <p>No advertisers, data brokers, or analytics companies ever receive your data.</p>
        </section>

        <section id="retention">
          <h2><span className="legal-section-num">05</span>Data Retention</h2>
          <p>We retain your data for as long as your account is active. When you delete your account:</p>
          <ul>
            <li>All transactions are permanently deleted within 24 hours</li>
            <li>All budgets and preferences are permanently deleted</li>
            <li>Backup copies are purged within 30 days (the backup retention window)</li>
            <li>Anonymized error logs may be retained for up to 90 days</li>
          </ul>
        </section>

        <section id="rights">
          <h2><span className="legal-section-num">06</span>Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access</strong> — request a copy of all data we hold about you</li>
            <li><strong>Correction</strong> — fix inaccurate data via the dashboard or bot</li>
            <li><strong>Deletion</strong> — permanently delete all your data by typing <code>/deleteaccount</code> in the bot</li>
            <li><strong>Portability</strong> — export your transactions to CSV from the dashboard</li>
            <li><strong>Objection</strong> — opt out of non-essential data processing</li>
          </ul>
          <div className="legal-highlight">
            To delete your account and all associated data, send <strong>/deleteaccount</strong> to the Aura bot on Telegram. This is immediate and irreversible.
          </div>
        </section>

        <section id="security">
          <h2><span className="legal-section-num">07</span>Security</h2>
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
          <h2><span className="legal-section-num">08</span>Children</h2>
          <p>Aura is available to all users. However, we do not knowingly collect data from children under 13. If you believe a child under 13 has created an account, please contact us and we will delete their data promptly.</p>
        </section>

        <section id="changes">
          <h2><span className="legal-section-num">09</span>Policy Changes</h2>
          <p>If we make material changes to this policy, we will notify you via a message from the Aura bot on Telegram at least 7 days before the changes take effect. Continued use of Aura after that date constitutes acceptance of the updated policy.</p>
        </section>

        <section id="contact">
          <h2><span className="legal-section-num">10</span>Contact Us</h2>
          <p>Questions, requests, or concerns about this privacy policy:</p>
          <div className="legal-contact-card">
            <div className="legal-contact-icon">✉️</div>
            <div>
              <div className="legal-contact-name">Aura Support</div>
              <div className="legal-contact-desc">Reach us via Telegram bot or email listed in the bot&apos;s /help command</div>
            </div>
          </div>
        </section>
      </div>

      <footer className="legal-footer">
        <p>© 2026 Aura Finance Tracker &nbsp;·&nbsp; <a href="/privacy">Privacy Policy</a> &nbsp;·&nbsp; <a href="/terms">Terms of Service</a></p>
      </footer>
    </div>
  );
}
