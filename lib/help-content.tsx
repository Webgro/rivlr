/**
 * Help-article content as JSX components, keyed by slug. Separate from
 * lib/help-articles.ts so the metadata file stays plain TS (importable
 * from server components without React deps).
 */

function Screenshot({
  caption,
}: {
  caption: string;
}) {
  return (
    <div className="screenshot-placeholder">
      <strong>📷 {caption}</strong>
      <div className="mt-2 text-[11px]">
        Drop a PNG at{" "}
        <code style={{ fontSize: 10 }}>
          /public/help/screenshots/{caption.toLowerCase().replace(/\s+/g, "-")}.png
        </code>
        {" "}and reference it here.
      </div>
    </div>
  );
}

export const HELP_CONTENT: Record<string, () => React.ReactNode> = {
  "getting-started": () => (
    <>
      <h2>What Rivlr does</h2>
      <p>
        Rivlr tracks competitor product pages on Shopify stores. Every hour
        we check the price and stock level of every product you've added,
        and alert you when something changes. Everything lives in a
        dashboard you can scan in a few seconds each morning.
      </p>

      <h2>Three minutes to your first tracked product</h2>
      <ol>
        <li>
          Click <strong>Products</strong> in the sidebar, then{" "}
          <strong>+ Add products</strong>.
        </li>
        <li>
          Paste any Shopify product URL — for example{" "}
          <code>https://example.com/products/dog-food</code>.
        </li>
        <li>
          Click <strong>Track products</strong>. Within ~30 seconds the
          first crawl runs and you'll see the current price and stock on
          your products list.
        </li>
      </ol>

      <Screenshot caption="Add product flow" />

      <h2>Where to look next</h2>
      <ul>
        <li>
          <a href="/help/adding-products">Adding more products</a> — single
          URLs, mixed with collections, anything Shopify.
        </li>
        <li>
          <a href="/help/reading-the-dashboard">Reading the dashboard</a> —
          insights, opportunities, and the activity feed.
        </li>
        <li>
          <a href="/help/notifications">Setting up alerts</a> — get an
          email when something matters.
        </li>
      </ul>
    </>
  ),

  "adding-products": () => (
    <>
      <h2>Single product</h2>
      <p>
        Paste any Shopify product URL into the textarea on{" "}
        <strong>+ Add products</strong>. Rivlr accepts URLs in either of
        these formats:
      </p>
      <ul>
        <li>
          <code>https://store.com/products/handle</code>
        </li>
        <li>
          <code>https://store.com/collections/X/products/handle</code>
        </li>
      </ul>
      <p>
        Both resolve to the same product. Trailing slashes, query strings,
        and locale prefixes (<code>/en-gb/</code>) are all handled.
      </p>

      <h2>Many at once</h2>
      <p>
        Paste a list — one URL per line, or comma-separated. Rivlr handles
        any number; we've tested with thousands. Each URL is validated for
        format only at submit time, then queued for background crawling.
      </p>

      <Screenshot caption="Multiple URLs paste" />

      <h2>What happens after submitting</h2>
      <p>
        You're redirected to the products list with a banner showing how
        many were added, deduplicated, or rejected as invalid. The new
        products appear with no price or stock data yet — that's normal,
        they're queued. Within a few minutes the first crawl populates
        them. The bottom-right progress widget shows live status.
      </p>

      <h2>Limits</h2>
      <ul>
        <li>Duplicate URLs (same product already tracked) are skipped silently.</li>
        <li>Non-Shopify URLs are rejected — counted as "failed" in the banner.</li>
        <li>
          Each plan has a maximum number of products. The system blocks
          adds that would exceed your plan limit and tells you why.
        </li>
      </ul>
    </>
  ),

  "adding-collections": () => (
    <>
      <h2>Collection URLs</h2>
      <p>
        Instead of pasting individual products, paste a Shopify{" "}
        <strong>collection</strong> URL and Rivlr expands it into every
        product the store has in that collection.
      </p>
      <ul>
        <li>
          <code>https://store.com/collections/dog-food</code>
        </li>
        <li>
          <code>https://store.com/collections/all</code> (the store's full
          catalogue)
        </li>
      </ul>

      <h2>Mixing collections and individual products</h2>
      <p>
        You can mix both freely in the same paste. After submit, the
        confirmation banner tells you what happened — for example:
      </p>
      <blockquote>
        2 collections expanded → 412 products · ✓ 408 added · 4 duplicates
        skipped
      </blockquote>

      <Screenshot caption="Mixed paste with collection URLs" />

      <h2>Caps and rate limits</h2>
      <p>
        Each collection is capped at 1,000 products to avoid accidentally
        bulk-tracking 5,000 items from <code>/collections/all</code> on a
        large store. We fetch each page of the collection with a 1-second
        delay to be polite.
      </p>

      <h2>What if a collection fetch fails?</h2>
      <p>
        Some stores hide collections behind login or block automated
        requests. If a collection URL can't be expanded, it's counted in
        the "failed" total and the rest of the paste continues normally.
      </p>
    </>
  ),

  "csv-upload": () => (
    <>
      <h2>For when you live in spreadsheets</h2>
      <p>
        On the <strong>+ Add products</strong> page, click{" "}
        <strong>↑ Upload CSV / text file</strong>. Pick any file —{" "}
        <code>.csv</code>, <code>.tsv</code>, or plain <code>.txt</code>.
      </p>

      <h2>Format</h2>
      <p>
        We don't care about column structure. The parser extracts every
        URL it can find by splitting on whitespace, commas, semicolons —
        any of those work. Headers, comments, extra columns are all
        ignored.
      </p>

      <p>The simplest valid file is one URL per line:</p>
      <pre style={{ background: "var(--elevated)", padding: 12, borderRadius: 6, fontSize: 12, overflow: "auto" }}>
{`https://store-a.com/products/widget
https://store-b.com/collections/dog-food
https://store-c.com/products/another-widget`}
      </pre>

      <Screenshot caption="CSV upload button" />

      <h2>What happens next</h2>
      <p>
        The extracted URLs are appended to the textarea so you can review,
        edit, or add more before clicking <strong>Track products</strong>.
        From there it behaves like a regular paste.
      </p>
    </>
  ),

  "reading-the-dashboard": () => (
    <>
      <h2>The four-panel layout</h2>
      <p>
        The dashboard is designed to give you the gist in 30 seconds. Top
        to bottom:
      </p>

      <h3>1. Insights row</h3>
      <p>
        Four stat cards: 24h price moves (split up/down), 24h stock moves
        (split out/restocked), the biggest single drop, and pending link
        suggestions. The numbers are clickable where it makes sense.
      </p>

      <h3>2. Opportunities</h3>
      <p>
        Competitors currently out of stock, sorted by how long they've been
        OOS. Longer = more time you've had to capture demand. Each row
        shows the last known price as a benchmark.
      </p>

      <Screenshot caption="Dashboard insights and opportunities" />

      <h3>3. Top movers (7 days)</h3>
      <p>
        The biggest absolute price changes — drops in green, rises in red,
        with the percentage shown alongside. Click any row to open the
        product detail.
      </p>

      <h3>4. Recent activity</h3>
      <p>
        A chronological feed of stock-changes and price-changes from the
        last 7 days. For the full feed with filters, click{" "}
        <strong>Activity</strong> in the sidebar.
      </p>

      <h2>Stale-crawl banner</h2>
      <p>
        If more than five products haven't been crawled in the last two
        hours, a warning banner appears at the top. This usually means the
        crawl queue is backed up — clicking{" "}
        <strong>Run crawl now</strong> on the products page kicks off
        immediate processing.
      </p>
    </>
  ),

  tags: () => (
    <>
      <h2>What tags are for</h2>
      <p>
        Tags are colour-coded labels you apply to products to organise
        them — by category, by competitor relationship, by tracking
        intent. They're filterable from the products page and from
        anywhere a tag chip is shown.
      </p>

      <h2>Creating a tag</h2>
      <p>
        Click <strong>Tags</strong> in the sidebar, then enter a name and
        pick from the eight available colours. Tags are global — anyone on
        your team will see and use the same set.
      </p>

      <Screenshot caption="Tags management page" />

      <h2>Applying tags</h2>
      <p>
        From the products page: tick the rows you want to tag, and use the{" "}
        <strong>Apply tag</strong> dropdown in the bulk action bar. Only
        tags you've already created in <strong>/tags</strong> appear here
        — this prevents typos creating ghost tags.
      </p>

      <h2>Filtering by tag</h2>
      <p>
        The tag dropdown on the products page lets you filter to a single
        tag. You can also click any tag chip on a product row to jump
        straight to that filter.
      </p>

      <h2>Removing or renaming</h2>
      <p>
        On the <strong>/tags</strong> page each tag has a colour picker
        and a delete button. Deleting removes it from every product
        automatically.
      </p>
    </>
  ),

  "linking-products": () => (
    <>
      <h2>Why link products?</h2>
      <p>
        The same item is often sold by multiple competitors. Linking puts
        them in the same group, so on each product's detail page you see
        the others' current price and stock side by side — perfect for
        spotting which competitor is undercutting whom.
      </p>

      <h2>Manual linking</h2>
      <p>
        On any product detail page, click <strong>+ Link product</strong>.
        A modal opens with fuzzy-matched candidates based on the title —
        you can type to search across all tracked products. Click one to
        link them. If either side already has a group, the new product
        joins it.
      </p>

      <Screenshot caption="Link product modal" />

      <h2>Suggested links</h2>
      <p>
        Rivlr automatically scans for products with similar titles across
        different stores and surfaces them in <strong>Suggestions</strong>{" "}
        in the sidebar. Click <strong>Link</strong> to accept or{" "}
        <strong>Dismiss</strong> to suppress.
      </p>

      <h2>What "linked" looks like</h2>
      <p>
        Each linked product's detail page shows a "Linked products"
        section listing the other group members with their store, current
        price, and stock. Each row is clickable.
      </p>

      <h2>Removing a link</h2>
      <p>
        On a detail page, click the × next to a linked product to unlink
        just that one, or "Remove from group" at the bottom to take this
        product out of the group entirely.
      </p>
    </>
  ),

  notifications: () => (
    <>
      <h2>Two channels, two events</h2>
      <p>
        Rivlr can email you when:
      </p>
      <ul>
        <li>A tracked product goes out of stock (or back in)</li>
        <li>A tracked product drops in price</li>
      </ul>

      <h2>Setting recipients</h2>
      <p>
        Click <strong>Settings</strong> in the sidebar and add the email
        addresses that should receive alerts. Multiple addresses are fine,
        comma-separated.
      </p>

      <Screenshot caption="Settings — notification emails" />

      <h2>Per-product toggles</h2>
      <p>
        On each product's detail page, two toggle switches enable or
        disable each kind of alert <em>for that product</em>. By default
        both are off — turn them on for the products you actually want to
        be notified about.
      </p>

      <h2>Bulk-toggle</h2>
      <p>
        On the products list, select multiple rows and use the bulk action
        bar to turn alerts on or off for all of them at once.
      </p>

      <h2>Deduplication</h2>
      <p>
        We won't email you about the same kind of event twice for the same
        product within 24 hours. So if a competitor's price keeps
        oscillating, you get one drop alert per day max.
      </p>

      <h2>What if I'm not getting emails?</h2>
      <p>Check, in order:</p>
      <ol>
        <li>Are the recipient addresses set in Settings?</li>
        <li>Is the per-product toggle on for the right products?</li>
        <li>Have they actually changed (vs. just being out of stock from the start)?</li>
        <li>
          Check your spam folder; the sender is{" "}
          <code>alerts@rivlr.app</code>.
        </li>
      </ol>
    </>
  ),

  notes: () => (
    <>
      <h2>What notes are for</h2>
      <p>
        Free-text per-product context. Use it to record anything you want
        to remember — competitor restocking patterns, pricing tactics
        you've tried, deal anniversaries, links to internal docs.
      </p>

      <h2>How to add notes</h2>
      <p>
        Open any product detail page; the notes editor sits below the
        notification toggles. Type, then either click <strong>Save</strong>{" "}
        or just click outside the box (auto-save on blur).
      </p>

      <Screenshot caption="Notes editor" />

      <h2>Format</h2>
      <p>
        Plain text. Line breaks are preserved. There's no length cap up to
        10,000 characters per product. We don't render markdown — what
        you type is what you see.
      </p>
    </>
  ),

  compare: () => (
    <>
      <h2>Side-by-side price history</h2>
      <p>
        Comparing products lays their price histories on a single chart
        so you can see who's been more aggressive over the time window.
        Useful for category trend-spotting or for cross-store decisions.
      </p>

      <h2>How to compare</h2>
      <ol>
        <li>
          On the <strong>Products</strong> page, tick 2–5 product
          checkboxes.
        </li>
        <li>
          In the bulk action bar that appears, click{" "}
          <strong>Compare</strong>.
        </li>
        <li>
          You're taken to a chart with one line per product, colour-coded
          and labelled in the legend.
        </li>
      </ol>

      <Screenshot caption="Compare chart" />

      <h2>Currency warning</h2>
      <p>
        If the products you're comparing aren't all in the same currency,
        a warning appears above the chart. Raw values aren't directly
        comparable — but the shapes still tell you something about
        relative trends.
      </p>

      <h2>Limits</h2>
      <p>
        Maximum 5 products per chart. More than that becomes hard to read.
      </p>
    </>
  ),

  "troubleshooting-crawls": () => (
    <>
      <h2>Common reasons a product isn't updating</h2>
      <p>The order I'd check things in:</p>

      <h3>1. Has the first crawl run yet?</h3>
      <p>
        New products show "pending" until the first crawl completes — that
        usually happens within 5–10 minutes of being added. Check the
        bottom-right progress widget; if there's nothing in flight,
        click <strong>Run crawl now</strong> on the products page.
      </p>

      <h3>2. Is the product still on the competitor's site?</h3>
      <p>
        If a product has been deleted from the competitor's store, it
        starts returning 404 and after 3 consecutive failures Rivlr
        auto-pauses it. Auto-paused products show a "paused" badge on the
        products list and have an error message on their detail page.
      </p>

      <h3>3. Is the URL right?</h3>
      <p>
        Open the URL in a browser. If it loads a product page on the
        competitor's site, the URL is fine. If it redirects elsewhere or
        404s, fix or remove it.
      </p>

      <h3>4. Has the price actually changed?</h3>
      <p>
        For multi-currency stores, the customer-facing price you see in
        the browser may differ from what we crawl (we pin to the UK / GBP
        market). Check the variants table on the detail page — sometimes
        the visible price is one variant while we report another.
      </p>

      <Screenshot caption="Auto-paused product" />

      <h2>Manually triggering a crawl</h2>
      <p>
        On any product detail page, click <strong>↻ Crawl now</strong> to
        force an immediate fetch ignoring the hourly cooldown. Useful
        when you've spotted something on the competitor's site and want
        to confirm Rivlr sees it.
      </p>

      <h2>Still stuck?</h2>
      <p>
        Email <a href="mailto:support@rivlr.app">support@rivlr.app</a>{" "}
        with the product URL and the "last error" message from the detail
        page. We'll dig in.
      </p>
    </>
  ),
};
