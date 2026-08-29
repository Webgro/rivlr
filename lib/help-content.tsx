/**
 * Help-article content as JSX components, keyed by slug. Separate from
 * lib/help-articles.ts so the metadata file stays plain TS (importable
 * from server components without React deps).
 *
 * UI mocks live in lib/help-mocks.tsx — each mock renders an
 * approximation of the actual app surface in plain Tailwind so the
 * help articles never go stale relative to a binary screenshot.
 */

import {
  MockAddProduct,
  MockMultipleUrls,
  MockMixedCollection,
  MockCsvUpload,
  MockDashboardInsights,
  MockTagsPage,
  MockLinkModal,
  MockNotificationEmails,
  MockNotesEditor,
  MockCompareChart,
  MockAutoPaused,
} from "./help-mocks";

export const HELP_CONTENT: Record<string, () => React.ReactNode> = {
  "getting-started": () => (
    <>
      <h2>What Rivlr does</h2>
      <p>
        Rivlr watches competitor products on Shopify stores. It checks the
        price and stock of every product you&apos;ve added, automatically
        and around the clock, and alerts you when something changes.
        Everything lands on a dashboard you can scan in a few seconds each
        morning.
      </p>

      <h2>Three minutes to your first tracked product</h2>
      <ol>
        <li>
          Click <strong>Watchlist</strong> in the sidebar, then{" "}
          <strong>+ Add products</strong>.
        </li>
        <li>
          Paste the link to any Shopify product page, for example{" "}
          <code>https://example.com/products/dog-food</code>.
        </li>
        <li>
          Click <strong>Track products</strong>. Within about 30 seconds
          the first check runs and you&apos;ll see the current price and
          stock on your Watchlist.
        </li>
      </ol>

      <MockAddProduct />

      <h2>Where to look next</h2>
      <ul>
        <li>
          <a href="/help/adding-products">Adding more products</a>: single
          links, whole collections, anything on Shopify.
        </li>
        <li>
          <a href="/help/reading-the-dashboard">Reading the dashboard</a>:
          what each card and feed is telling you.
        </li>
        <li>
          <a href="/help/notifications">Setting up alerts</a>: get an
          email when something matters.
        </li>
      </ul>
    </>
  ),

  "adding-products": () => (
    <>
      <h2>Single product</h2>
      <p>
        Paste the link to any Shopify product page into the box on{" "}
        <strong>+ Add products</strong>. Links in either of these shapes
        work:
      </p>
      <ul>
        <li>
          <code>https://store.com/products/product-name</code>
        </li>
        <li>
          <code>https://store.com/collections/X/products/product-name</code>
        </li>
      </ul>
      <p>
        Both point to the same product. Don&apos;t worry about tidying the
        link first: trailing slashes, tracking codes and language prefixes
        (like <code>/en-gb/</code>) are all handled.
      </p>

      <h2>Many at once</h2>
      <p>
        Paste a list, one link per line (commas work too). Any number is
        fine; people have added thousands in one go. Rivlr checks each link
        looks right when you submit, then starts checking the products in
        the background.
      </p>

      <MockMultipleUrls />

      <h2>What happens after submitting</h2>
      <p>
        You land back on your Watchlist with a banner showing how many were
        added, how many were already tracked, and how many failed. New
        products show no price or stock at first. That&apos;s normal: the
        first check fills them in within a few minutes, and the progress
        widget in the bottom-right corner shows it happening.
      </p>

      <h2>Limits</h2>
      <ul>
        <li>Products you already track are skipped quietly.</li>
        <li>
          Links that aren&apos;t Shopify product pages are counted as
          &quot;failed&quot; in the banner.
        </li>
        <li>
          Each plan covers a set number of products. If an add would go
          over your limit, Rivlr stops it and tells you why.
        </li>
      </ul>
    </>
  ),

  "adding-collections": () => (
    <>
      <h2>Collection links</h2>
      <p>
        Instead of pasting products one by one, paste a Shopify{" "}
        <strong>collection</strong> link and Rivlr adds every product in
        that collection.
      </p>
      <ul>
        <li>
          <code>https://store.com/collections/dog-food</code>
        </li>
        <li>
          <code>https://store.com/collections/all</code> (the store&apos;s
          whole catalogue)
        </li>
      </ul>

      <h2>Mixing collections and individual products</h2>
      <p>
        You can mix both in the same paste. After you submit, the banner
        tells you what happened, for example:
      </p>
      <blockquote>
        found 412 products in 2 collections · ✓ 408 added · 4 duplicates
        skipped
      </blockquote>

      <MockMixedCollection />

      <h2>Collection size cap</h2>
      <p>
        Each collection is capped at 1,000 products. That stops an
        accidental paste of <code>/collections/all</code> on a huge store
        from filling your whole plan in one click.
      </p>

      <h2>What if a collection can&apos;t be read?</h2>
      <p>
        Some stores hide collections behind a login or block automatic
        checks. If a collection can&apos;t be read, it&apos;s counted in
        the &quot;failed&quot; total and the rest of your paste carries on
        as normal.
      </p>
    </>
  ),

  "csv-upload": () => (
    <>
      <h2>For when you live in spreadsheets</h2>
      <p>
        On the <strong>+ Add products</strong> page, click{" "}
        <strong>↑ Upload CSV / text file</strong>. Any of these file types
        work: <code>.csv</code>, <code>.tsv</code>, or plain{" "}
        <code>.txt</code>.
      </p>

      <h2>Format</h2>
      <p>
        The layout of your spreadsheet doesn&apos;t matter. Rivlr picks
        out every product link it can find and ignores everything else:
        headers, notes, extra columns, all fine.
      </p>

      <p>The simplest file is just one link per line:</p>
      <pre style={{ background: "var(--elevated)", padding: 12, borderRadius: 6, fontSize: 12, overflow: "auto" }}>
{`https://store-a.com/products/widget
https://store-b.com/collections/dog-food
https://store-c.com/products/another-widget`}
      </pre>

      <MockCsvUpload />

      <h2>What happens next</h2>
      <p>
        The links from the file are added to the text box so you can
        review, edit, or add more before clicking{" "}
        <strong>Track products</strong>. From there it works exactly like
        a normal paste.
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

      <h3>1. The stat cards</h3>
      <p>
        Four cards at the top: price changes in the last 24 hours (up and
        down), stock changes in the last 24 hours (sold out and
        restocked), the biggest single price drop, and suggested matches
        waiting for review. Click a number to see the detail behind it.
      </p>

      <h3>2. Opportunities</h3>
      <p>
        Competitors currently out of stock, with the longest-standing at
        the top. The longer they&apos;ve been out, the more of their
        customers you could have been winning. Each row shows their last
        known price for reference.
      </p>

      <MockDashboardInsights />

      <h3>3. Top movers (7 days)</h3>
      <p>
        The biggest price changes of the week: drops in green, rises in
        red, with the percentage alongside. Click any row to open the
        product.
      </p>

      <h3>4. Recent activity</h3>
      <p>
        A running feed of stock and price changes from the last 7 days.
        For the full feed with filters, click <strong>View all</strong>{" "}
        above the list.
      </p>

      <h2>The &quot;not checked recently&quot; banner</h2>
      <p>
        If several products haven&apos;t been checked in the last two
        hours, a warning banner appears at the top. It usually just means
        checks are running behind. Click <strong>Check now</strong> on the
        Watchlist to catch up straight away.
      </p>
    </>
  ),

  tags: () => (
    <>
      <h2>What tags are for</h2>
      <p>
        Tags are colour-coded labels you put on products to keep them
        organised: by category, by competitor, by why you&apos;re watching
        them. Anywhere you see a tag, you can click it to filter.
      </p>

      <h2>Creating a tag</h2>
      <p>
        Open your <strong>Watchlist</strong>, click{" "}
        <strong>Manage tags</strong> beside the tag filter, then enter a
        name and pick one of the eight colours. Tags are shared: everyone
        on your team sees and uses the same set.
      </p>

      <MockTagsPage />

      <h2>Applying tags</h2>
      <p>
        On the Watchlist, tick the products you want to tag and use the{" "}
        <strong>Apply tag</strong> dropdown in the bar that appears. Only
        tags you&apos;ve already created show up here, which stops typos
        creating stray tags.
      </p>

      <h2>Filtering by tag</h2>
      <p>
        The tag dropdown on the Watchlist filters to one tag. You can also
        click any tag chip on a product row to jump straight to that
        filter.
      </p>

      <h2>Removing or recolouring</h2>
      <p>
        On the Tags page each tag has a colour picker and a delete button.
        Deleting a tag removes it from every product automatically.
      </p>
    </>
  ),

  "linking-products": () => (
    <>
      <h2>Why link products?</h2>
      <p>
        The same item is often sold by several competitors. Linking those
        products puts them in one group, so each product&apos;s page shows
        the others&apos; current price and stock side by side. It&apos;s
        the easiest way to spot who&apos;s undercutting whom.
      </p>

      <h2>Linking by hand</h2>
      <p>
        On any product page, click <strong>+ Link product</strong>. A
        window opens with likely matches based on the product name, and
        you can type to search everything you track. Click one to link
        them. If either product is already in a group, the new one joins
        it.
      </p>

      <MockLinkModal />

      <h2>Suggested matches</h2>
      <p>
        Rivlr also looks for products with similar names across different
        stores and lists them under <strong>Suggested matches</strong>,
        reachable from the dashboard. Click <strong>Link</strong> to
        accept or <strong>Dismiss</strong> if they&apos;re not the same
        item.
      </p>

      <h2>What &quot;linked&quot; looks like</h2>
      <p>
        Each linked product&apos;s page gains a &quot;Linked
        products&quot; section listing the others in the group with their
        store, current price, and stock. Each row is clickable.
      </p>

      <h2>Removing a link</h2>
      <p>
        On a product page, click the × next to a linked product to unlink
        just that one, or &quot;Remove from group&quot; to take the
        product out of the group entirely.
      </p>
    </>
  ),

  notifications: () => (
    <>
      <h2>Two kinds of alert</h2>
      <p>Rivlr can email you when:</p>
      <ul>
        <li>A tracked product sells out (or comes back in stock)</li>
        <li>A tracked product drops in price</li>
      </ul>

      <h2>Choosing who gets them</h2>
      <p>
        Click <strong>Settings</strong> in the sidebar and add the email
        addresses that should receive alerts. Add as many as you like,
        separated by commas.
      </p>

      <MockNotificationEmails />

      <h2>Per-product switches</h2>
      <p>
        On each product&apos;s page, two switches turn each kind of alert
        on or off <em>for that product</em>. Both start off. Turn them on
        for the products you genuinely want to hear about.
      </p>

      <h2>Turning alerts on in bulk</h2>
      <p>
        On the Watchlist, tick several products and use the bar that
        appears to turn alerts on or off for all of them at once.
      </p>

      <h2>No repeat alerts</h2>
      <p>
        You&apos;ll never get the same kind of alert twice for the same
        product within 24 hours. If a competitor&apos;s price bounces up
        and down all day, you get at most one drop alert.
      </p>

      <h2>What if I&apos;m not getting emails?</h2>
      <p>Check, in order:</p>
      <ol>
        <li>Are the recipient addresses saved in Settings?</li>
        <li>Are the switches on for the right products?</li>
        <li>
          Has anything actually changed? (A product that was already out
          of stock when you added it won&apos;t trigger an alert.)
        </li>
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
        A free-text box on every product. Use it for anything you want to
        remember: how often a competitor restocks, pricing tactics
        you&apos;ve tried, links to your own documents.
      </p>

      <h2>How to add notes</h2>
      <p>
        Open any product page; the notes box sits below the alert
        switches. Type, then click <strong>Save</strong> or simply click
        outside the box and it saves itself.
      </p>

      <MockNotesEditor />

      <h2>Format</h2>
      <p>
        Plain text, up to 10,000 characters per product. Line breaks are
        kept. What you type is exactly what you&apos;ll see.
      </p>
    </>
  ),

  compare: () => (
    <>
      <h2>Side-by-side price history</h2>
      <p>
        Comparing products puts their price histories on one chart so you
        can see who&apos;s been changing prices, and by how much, over
        time. Handy for spotting category trends or deciding your own
        price.
      </p>

      <h2>How to compare</h2>
      <ol>
        <li>
          On the <strong>Watchlist</strong>, tick 2 to 5 products.
        </li>
        <li>
          In the bar that appears, click <strong>Compare</strong>.
        </li>
        <li>
          You&apos;re taken to a chart with one colour-coded line per
          product, labelled in the key.
        </li>
      </ol>

      <MockCompareChart />

      <h2>Currency warning</h2>
      <p>
        If the products aren&apos;t all priced in the same currency, a
        warning appears above the chart. The exact values aren&apos;t
        directly comparable, but the shape of each line still shows the
        trend.
      </p>

      <h2>Limits</h2>
      <p>
        Up to 5 products per chart. More than that gets hard to read.
      </p>
    </>
  ),

  "troubleshooting-crawls": () => (
    <>
      <h2>Common reasons a product isn&apos;t updating</h2>
      <p>The order to check things in:</p>

      <h3>1. Has the first check run yet?</h3>
      <p>
        New products show &quot;waiting for first check&quot; until the
        first one completes, usually within 5 to 10 minutes of being
        added. Watch the progress widget in the bottom-right corner; if
        nothing&apos;s happening, click <strong>Check now</strong> on the
        Watchlist.
      </p>

      <h3>2. Is the product still on the competitor&apos;s site?</h3>
      <p>
        If a product has been removed from the competitor&apos;s store,
        its page stops loading. After three failed checks in a row, Rivlr
        pauses it for you. Paused products show a &quot;paused&quot; badge
        on the Watchlist and an explanation on their page.
      </p>

      <h3>3. Is the link right?</h3>
      <p>
        Open the link in your browser. If it loads a product page on the
        competitor&apos;s site, it&apos;s fine. If it goes somewhere else
        or shows an error, fix or remove it.
      </p>

      <h3>4. Has the price actually changed?</h3>
      <p>
        Stores that sell in several countries can show you a different
        price depending on where you are. Rivlr checks the UK price unless
        you&apos;ve chosen a different country for that product. Also
        check the variants table on the product page: the price you saw in
        the browser might belong to a different variant.
      </p>

      <MockAutoPaused />

      <h2>Checking a product right now</h2>
      <p>
        On any product page, click <strong>↻ Check now</strong> to run an
        immediate check rather than waiting for the next scheduled one.
        Useful when you&apos;ve spotted something on the competitor&apos;s
        site and want to confirm Rivlr sees it too.
      </p>

      <h2>Still stuck?</h2>
      <p>
        Email <a href="mailto:hello@rivlr.app">hello@rivlr.app</a> with
        the product link and the &quot;last error&quot; message from the
        product page. We&apos;ll dig in.
      </p>
    </>
  ),
};
