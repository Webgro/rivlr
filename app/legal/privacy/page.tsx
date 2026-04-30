export const metadata = { title: "Privacy Policy · Rivlr" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-12 prose-rivlr">
      <h1>Privacy Policy</h1>
      <p className="lead">Last updated: 30 April 2026</p>

      <p>
        Rivlr is operated by Webgro Ltd ("we"). This policy explains what
        personal data we collect, why, and what rights you have. We comply
        with the UK GDPR and Data Protection Act 2018.
      </p>

      <h2>Data Controller</h2>
      <p>
        Webgro Ltd is the data controller for personal data processed
        through the Service. Contact:{" "}
        <a href="mailto:support@rivlr.app">support@rivlr.app</a>.
      </p>

      <h2>What We Collect</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>What</th>
            <th>Why</th>
            <th>Legal basis</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Account</td>
            <td>Email, password hash, name (optional)</td>
            <td>To identify you and provide the Service</td>
            <td>Contract</td>
          </tr>
          <tr>
            <td>Billing</td>
            <td>Stripe customer ID, billing address, VAT number, last 4 of card</td>
            <td>To take payment and issue invoices</td>
            <td>Contract / Legal obligation (tax)</td>
          </tr>
          <tr>
            <td>Operational</td>
            <td>IP address, user agent, browser logs</td>
            <td>Security, fraud prevention, debugging</td>
            <td>Legitimate interest</td>
          </tr>
          <tr>
            <td>Tracked URLs</td>
            <td>The URLs and notes you add</td>
            <td>To provide the tracking service</td>
            <td>Contract</td>
          </tr>
          <tr>
            <td>Notification settings</td>
            <td>Email addresses you've configured for alerts</td>
            <td>To send the alerts you've requested</td>
            <td>Contract</td>
          </tr>
        </tbody>
      </table>

      <h2>What We Don't Collect</h2>
      <ul>
        <li>We don't use third-party advertising or analytics trackers.</li>
        <li>We don't sell or rent personal data.</li>
        <li>We don't profile users for marketing purposes.</li>
      </ul>

      <h2>Sub-Processors</h2>
      <p>We rely on the following sub-processors to deliver the Service:</p>
      <ul>
        <li>
          <strong>Vercel Inc.</strong> — application hosting (US/EU)
        </li>
        <li>
          <strong>Neon Inc.</strong> — database hosting (EU-West)
        </li>
        <li>
          <strong>Stripe Payments UK Ltd</strong> — payment processing (UK)
        </li>
        <li>
          <strong>Resend Inc.</strong> — transactional email delivery (US)
        </li>
      </ul>
      <p>
        Each processes personal data on our behalf under appropriate data
        processing agreements with standard contractual clauses where data
        leaves the UK/EEA.
      </p>

      <h2>Data Retention</h2>
      <ul>
        <li>
          <strong>Account data</strong>: kept while your account is active,
          plus 30 days after termination, then deleted (except where
          retention is required by law — e.g. tax records).
        </li>
        <li>
          <strong>Tracked URLs and observation history</strong>: kept while
          your account is active. On free plans we may delete observations
          older than 90 days. On paid plans, indefinitely until you cancel.
        </li>
        <li>
          <strong>Billing records</strong>: 7 years (UK statutory tax
          retention).
        </li>
        <li>
          <strong>Logs</strong>: typically 30 days.
        </li>
      </ul>

      <h2>Your Rights</h2>
      <p>Under the UK GDPR you have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you.</li>
        <li>Correct inaccurate data.</li>
        <li>Request deletion ("right to be forgotten").</li>
        <li>Restrict or object to processing.</li>
        <li>Receive your data in a portable format.</li>
        <li>Lodge a complaint with the Information Commissioner's Office (ICO).</li>
      </ul>
      <p>
        To exercise any of these, email{" "}
        <a href="mailto:support@rivlr.app">support@rivlr.app</a>. We'll
        respond within 30 days.
      </p>

      <h2>Cookies</h2>
      <p>
        We use a small number of strictly necessary cookies (session and
        theme preference). We don't use analytics or advertising cookies by
        default. See our <a href="/legal/cookies">Cookie Policy</a> for
        details.
      </p>

      <h2>International Transfers</h2>
      <p>
        Some sub-processors are based outside the UK/EEA (notably Vercel
        and Resend in the US). Where this happens, we use standard
        contractual clauses approved by the UK Information Commissioner's
        Office to protect your data.
      </p>

      <h2>Security</h2>
      <p>
        We use TLS for all traffic, encrypted databases at rest, and
        principle-of-least-privilege access for our team. No system is
        100% secure; if we detect a breach affecting your data we'll
        notify you within 72 hours per UK GDPR.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy. Material changes are notified by email
        at least 14 days in advance.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions: {" "}
        <a href="mailto:support@rivlr.app">support@rivlr.app</a>
      </p>

      <p className="text-sm text-muted mt-12">
        This policy is a template. Have it reviewed by a solicitor or
        privacy professional before relying on it in production.
      </p>
    </article>
  );
}
