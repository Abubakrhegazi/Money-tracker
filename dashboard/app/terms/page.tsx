import "../legal.css";

export default function TermsPage() {
  return (
    <div className="legal-wrapper">
      <nav className="legal-nav">
        <a href="/" className="legal-logo"><span className="legal-logo-dot"></span>Aura</a>
        <div className="legal-nav-links">
          <a href="/privacy">Privacy</a>
          <a href="/terms" className="active">Terms</a>
        </div>
      </nav>

      <div className="legal-container">
        <div className="legal-header">
          <div className="legal-badge">Legal</div>
          <h1>Terms of Service</h1>
          <p className="legal-meta">Last updated: March 6, 2026 &nbsp;·&nbsp; Effective: March 6, 2026</p>
        </div>

        <div className="legal-highlight">
          By using Aura — via Telegram, the web dashboard, or any other channel — you agree to these terms. Please read them. They&apos;re written in plain language.
        </div>

        <div className="legal-toc">
          <div className="legal-toc-title">Table of Contents</div>
          <div className="legal-toc-grid">
            <a href="#service"><span className="legal-toc-num">01</span> The Service</a>
            <a href="#accounts"><span className="legal-toc-num">02</span> Your Account</a>
            <a href="#plans"><span className="legal-toc-num">03</span> Free Service</a>
            <a href="#acceptable"><span className="legal-toc-num">04</span> Acceptable Use</a>
            <a href="#data"><span className="legal-toc-num">05</span> Your Data</a>
            <a href="#availability"><span className="legal-toc-num">06</span> Availability</a>
            <a href="#liability"><span className="legal-toc-num">07</span> Liability</a>
            <a href="#termination"><span className="legal-toc-num">08</span> Termination</a>
            <a href="#changes"><span className="legal-toc-num">09</span> Changes to Terms</a>
            <a href="#contact"><span className="legal-toc-num">10</span> Contact</a>
          </div>
        </div>

        <section id="service">
          <h2><span className="legal-section-num">01</span>The Service</h2>
          <p>Aura is a personal finance tracking tool accessible via Telegram bot and a web dashboard. It allows you to log income and expenses, set budgets, and view spending analytics.</p>
          <p>Aura is a <strong>tracking tool only</strong> — it does not provide financial advice, banking services, or investment recommendations. Nothing in the app should be considered professional financial advice.</p>
        </section>

        <section id="accounts">
          <h2><span className="legal-section-num">02</span>Your Account</h2>
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
          <h2><span className="legal-section-num">03</span>Free Service</h2>
          <p>Aura is completely free. There are no paid plans, subscriptions, or hidden charges. All features are available to every user at no cost:</p>
          <ul>
            <li>Unlimited transaction logging</li>
            <li>Spending summaries and analytics</li>
            <li>Category budgets</li>
            <li>Full dashboard access</li>
            <li>Daily and weekly notifications</li>
          </ul>
          <p>We reserve the right to introduce optional paid features in the future. If we do, existing free features will remain free and you will be clearly informed before any charges apply.</p>
        </section>

        <section id="acceptable">
          <h2><span className="legal-section-num">04</span>Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Attempt to reverse engineer, hack, or disrupt the service</li>
            <li>Use the service to store illegal financial activity records</li>
            <li>Create multiple accounts to abuse the service</li>
            <li>Automate requests in a way that burdens our infrastructure</li>
            <li>Attempt to access another user&apos;s data</li>
            <li>Use the service for any unlawful purpose</li>
          </ul>
          <div className="legal-warning">
            Violation of these terms may result in immediate account suspension without notice.
          </div>
        </section>

        <section id="data">
          <h2><span className="legal-section-num">05</span>Your Data</h2>
          <p>You own your data. We store it to provide the service, not to profit from it. See our <a href="/privacy">Privacy Policy</a> for full details on what we collect and how we use it.</p>
          <p>You can export your data at any time from the dashboard, and permanently delete everything using <code>/deleteaccount</code>.</p>
        </section>

        <section id="availability">
          <h2><span className="legal-section-num">06</span>Availability</h2>
          <p>We aim to keep Aura running reliably but we do not guarantee 100% uptime. The service may be temporarily unavailable due to maintenance, infrastructure issues, or events outside our control.</p>
          <p>We are not liable for any losses resulting from service downtime or data loss, though we take all reasonable precautions (including daily backups) to prevent such issues.</p>
        </section>

        <section id="liability">
          <h2><span className="legal-section-num">07</span>Liability</h2>
          <p>Aura is provided <strong>&quot;as is&quot;</strong> without warranties of any kind. To the fullest extent permitted by law:</p>
          <ul>
            <li>We are not liable for financial decisions made based on data shown in the app</li>
            <li>We are not liable for indirect, incidental, or consequential damages</li>
            <li>Our total liability to you shall not exceed €10 (ten euros), as Aura is a free service</li>
          </ul>
          <p>Aura displays the data you enter. You are responsible for the accuracy of your entries.</p>
        </section>

        <section id="termination">
          <h2><span className="legal-section-num">08</span>Termination</h2>
          <p><strong>You</strong> can delete your account at any time by sending <code>/deleteaccount</code> to the bot. All your data will be permanently removed.</p>
          <p><strong>We</strong> may suspend or terminate accounts that violate these terms, with or without notice depending on the severity of the violation. In cases of non-malicious violations, we will attempt to notify you first.</p>
        </section>

        <section id="changes">
          <h2><span className="legal-section-num">09</span>Changes to Terms</h2>
          <p>We may update these terms from time to time. For material changes, we will notify you via the Aura bot at least 7 days before they take effect. Your continued use of Aura after the effective date means you accept the updated terms.</p>
          <p>Minor changes (typos, clarifications) may be made without notice.</p>
        </section>

        <section id="contact">
          <h2><span className="legal-section-num">10</span>Contact</h2>
          <p>Questions about these terms or anything else:</p>
          <div className="legal-contact-card">
            <div className="legal-contact-icon">✉️</div>
            <div>
              <div className="legal-contact-name">Aura Support</div>
              <div className="legal-contact-desc">Reach us via Telegram bot or the contact details in the bot&apos;s /help command</div>
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
