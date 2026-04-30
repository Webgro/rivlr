export const metadata = { title: "Cookie Policy · Rivlr" };

export default function CookiesPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-12 prose-rivlr">
      <h1>Cookie Policy</h1>
      <p className="lead">Last updated: 30 April 2026</p>

      <p>
        Rivlr uses a minimal set of cookies. We don't use any third-party
        advertising or analytics cookies by default. This page lists every
        cookie we set and what each one is for.
      </p>

      <h2>What is a cookie?</h2>
      <p>
        A cookie is a small text file stored by your browser when you visit
        a website. It allows the site to remember information across page
        loads. For example, that you're signed in.
      </p>

      <h2>Cookies We Use</h2>
      <table>
        <thead>
          <tr>
            <th>Cookie</th>
            <th>Type</th>
            <th>Purpose</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>rivlr_session</code>
            </td>
            <td>Strictly necessary</td>
            <td>Keeps you logged in. Required to use the dashboard.</td>
            <td>30 days</td>
          </tr>
          <tr>
            <td>
              <code>rivlr-theme</code>
            </td>
            <td>Functional (localStorage)</td>
            <td>
              Stores your light/dark mode preference so the dashboard
              renders the right way next visit.
            </td>
            <td>Until you clear browser storage</td>
          </tr>
        </tbody>
      </table>

      <h2>Strictly Necessary Cookies</h2>
      <p>
        We don't ask for consent before setting strictly necessary cookies
        because the Service can't function without them. They identify you
        as a logged-in user and prevent CSRF attacks on form submissions.
      </p>

      <h2>Analytics & Advertising</h2>
      <p>
        We currently use no analytics or advertising cookies. If we add
        analytics in the future (e.g. for product usage telemetry), we'll
        update this policy and offer a clear opt-in.
      </p>

      <h2>Managing Cookies</h2>
      <p>
        Most browsers let you delete or block cookies through their
        settings. Doing so for <code>rivlr_session</code> will sign you
        out. Browsers also offer a "private" or "incognito" mode that
        clears cookies when the window closes.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about cookies?{" "}
        <a href="mailto:support@rivlr.app">support@rivlr.app</a>
      </p>
    </article>
  );
}
