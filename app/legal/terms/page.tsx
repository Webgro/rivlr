export const metadata = { title: "Terms of Service · Rivlr" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-12 prose-rivlr">
      <h1>Terms of Service</h1>
      <p className="lead">
        Last updated: 30 April 2026
      </p>

      <p>
        These terms govern your use of Rivlr ("the Service"), provided by
        Webgro Ltd ("we", "us", "our"), a company registered in England and
        Wales. By accessing or using the Service you agree to be bound by
        these terms. If you don't agree, don't use the Service.
      </p>

      <h2>1. The Service</h2>
      <p>
        Rivlr is a competitive-intelligence tool for ecommerce merchants
        that periodically retrieves publicly available product information
        from Shopify-powered storefronts and presents it in a dashboard.
        We crawl public endpoints only. No authentication, no scraping
        of private data, no bypass of access controls.
      </p>

      <h2>2. Your Account</h2>
      <p>
        You are responsible for safeguarding your login credentials and
        for any activity under your account. You must be at least 18 years
        old to use the Service. You agree to provide accurate information
        and to keep it up to date.
      </p>

      <h2>3. Acceptable Use</h2>
      <p>
        You agree not to:
      </p>
      <ul>
        <li>Use the Service to track sites you've been explicitly prohibited from accessing.</li>
        <li>Resell, redistribute, or republish the Service or its data without written permission.</li>
        <li>Reverse-engineer, decompile, or attempt to extract source code.</li>
        <li>Use the Service in a way that violates applicable law (including data-protection law).</li>
        <li>Attempt to circumvent rate limits, plan limits, or other access controls.</li>
      </ul>

      <h2>4. Subscriptions and Billing</h2>
      <p>
        Paid plans renew automatically until cancelled. Charges are taken
        in advance for each billing cycle (monthly or annual). VAT is
        added where applicable. You can cancel at any time; your access
        continues until the end of the paid period. We don't issue refunds
        for partial months unless required by law.
      </p>
      <p>
        We may change pricing with at least 30 days' notice. Continued use
        after the change takes effect constitutes acceptance.
      </p>

      <h2>5. Data You Add</h2>
      <p>
        You retain ownership of the URLs and notes you add to the Service.
        You grant us a non-exclusive licence to process them as required
        to provide the Service (storing, crawling, displaying back to you).
        We don't sell or share your input data with third parties.
      </p>

      <h2>6. Public Data We Collect</h2>
      <p>
        The Service retrieves publicly accessible product data from
        third-party stores. We're not the source of this information and
        we make no warranty of accuracy. The data is provided as a
        convenience; for purchase decisions you should verify directly.
      </p>

      <h2>7. Third-Party Stores</h2>
      <p>
        Rivlr is not affiliated with Shopify or any tracked store. We
        respect rate limits and use polite crawling practices. If a store
        owner requests we stop tracking their site, we'll comply within
        10 working days of receiving a verifiable request to{" "}
        <a href="mailto:support@rivlr.app">support@rivlr.app</a>.
      </p>

      <h2>8. Service Availability</h2>
      <p>
        We aim for high availability but don't guarantee 100% uptime. Crawl
        cadence is best-effort within the limits of the plan you've chosen.
        Scheduled maintenance is announced where practical.
      </p>

      <h2>9. Termination</h2>
      <p>
        You can terminate your account at any time from the settings page.
        We may suspend or terminate your account if you breach these terms,
        with notice where reasonable. On termination your data is retained
        for 30 days, then permanently deleted unless legal retention
        applies.
      </p>

      <h2>10. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, our liability for any
        claim arising from your use of the Service is limited to the fees
        you paid in the 12 months preceding the claim. We're not liable
        for indirect, incidental, or consequential losses (including loss
        of profit, business, or data).
      </p>

      <h2>11. Changes to These Terms</h2>
      <p>
        We may update these terms occasionally. Material changes will be
        notified by email at least 14 days in advance. Your continued use
        after the effective date constitutes acceptance.
      </p>

      <h2>12. Governing Law</h2>
      <p>
        These terms are governed by the laws of England and Wales. Any
        dispute will be subject to the exclusive jurisdiction of the
        English courts.
      </p>

      <h2>13. Contact</h2>
      <p>
        Webgro Ltd · England and Wales · {" "}
        <a href="mailto:support@rivlr.app">support@rivlr.app</a>
      </p>

      <p className="text-sm text-muted mt-12">
        These terms are a template. They've been written carefully but they
        are not legal advice. Have your solicitor review before relying on
        them in production.
      </p>
    </article>
  );
}
