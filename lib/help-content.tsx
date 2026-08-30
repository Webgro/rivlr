/**
 * Help-article bodies as JSX, keyed by slug. Separate from
 * lib/help-articles.ts so the metadata file stays plain TS and can be
 * imported from server components and the sitemap without React.
 *
 * UI mocks live in lib/help-mocks.tsx. Each one draws an approximation
 * of a real app surface in the app's own theme tokens, so an article
 * never goes stale against a binary screenshot and never fights the
 * light / dark toggle.
 *
 * House style for anything written here:
 *  - No em dashes. A comma or a full stop instead.
 *  - Shop-owner English. "Watching", "checks", "products you both
 *    sell". Never the internal vocabulary.
 *  - Nothing is promised that the app does not already do. Where a
 *    number is a floor rather than a measurement, the article says so
 *    in the same breath as the number.
 */

import Link from "next/link";

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
  MockAutoPaused,
} from "./help-mocks";

export const HELP_CONTENT: Record<string, () => React.ReactNode> = {
  "getting-started": () => (
    <>
      <h2>What Rivlr does</h2>
      <p>
        Rivlr watches competitor Shopify shops for you and answers three
        questions. It only ever reads what any shopper can already see on
        a rival&apos;s website, and there is nothing to install on your
        own shop.
      </p>

      <h3>1. Prices</h3>
      <p>
        What competitors charge for the things you sell. Your product,
        their product and the gap between the two prices, on one screen.
        This is the <strong>Prices</strong> page in the sidebar.
      </p>

      <h3>2. Stock</h3>
      <p>
        When a rival runs out of something you also sell. A competitor
        who is out of stock cannot take the sale, so that is the moment
        to hold your price or push the product. This is the{" "}
        <strong>Stock</strong> page.
      </p>

      <h3>3. Discovery</h3>
      <p>
        What rivals sell that you do not, ordered by what is actually
        shifting units rather than by what looks interesting. This is the{" "}
        <strong>Discovery</strong> page.
      </p>

      <h2>Finding your way around</h2>
      <p>The sidebar has five main places:</p>
      <ul>
        <li>
          <strong>Dashboard</strong>: what changed in the last day or so.
        </li>
        <li>
          <strong>Opportunities</strong>: rivals about to sell out, and
          your products priced above a rival&apos;s.
        </li>
        <li>
          <strong>Prices</strong>: your catalogue beside rival prices.
        </li>
        <li>
          <strong>Stock</strong>: rival stock on the things you sell.
        </li>
        <li>
          <strong>Discovery</strong>: rival products you do not sell.
        </li>
      </ul>
      <p>
        Lower down, next to Settings, sits <strong>Competitors</strong>.
        That is where you add and manage the rival shops being watched.
        Choosing shops is setup you do occasionally, not somewhere you
        visit every day, which is why it is not at the top.
      </p>

      <h2>Your first hour</h2>
      <ol>
        <li>
          Work through <Link href="/help/guided-setup">guided setup</Link>: your
          shop address, one competitor, then pick from the products you
          both sell.
        </li>
        <li>
          Open <strong>Prices</strong> and see where you sit against them.
        </li>
        <li>
          Add a second competitor from{" "}
          <Link href="/help/adding-competitors">the Competitors page</Link> if
          your plan allows one.
        </li>
        <li>
          Turn on <Link href="/help/notifications">email alerts</Link> for the
          products you care most about.
        </li>
      </ol>

      <h2>Where to read next</h2>
      <ul>
        <li>
          <Link href="/help/product-matching">
            How Rivlr matches products you both sell
          </Link>
        </li>
        <li>
          <Link href="/help/units-sold">
            Units sold, and why it is sometimes blank
          </Link>
        </li>
        <li>
          <Link href="/help/plans-and-limits">
            Plans, product limits and competitor limits
          </Link>
        </li>
      </ul>
    </>
  ),

  "guided-setup": () => (
    <>
      <h2>What guided setup is</h2>
      <p>
        A new account is walked through four short screens at{" "}
        <code>/welcome</code>. By the end of them Rivlr knows what you
        sell, knows one shop you compete with, and has offered you a list
        of products you both sell so you can start watching the ones that
        matter.
      </p>
      <p>
        You can leave at any point using the link in the top right, and
        pick it up again later.
      </p>

      <h2>Step 1: your shop address</h2>
      <p>
        Type your own shop&apos;s web address, for example{" "}
        <code>mystore.com</code> or your{" "}
        <code>.myshopify.com</code> address. Rivlr reads your product list
        so it has something to compare rival prices against.
      </p>
      <p>
        This step is skippable. If you do not have a shop yet, choose{" "}
        <strong>I don&apos;t have a store yet</strong> and carry on. You
        will still see rival prices and stock, but the side-by-side
        comparison needs your own products, so it is worth coming back to.
      </p>

      <h2>Step 2: one competitor</h2>
      <p>
        Add a single rival shop to begin with. Pick the one whose prices
        you find yourself checking most often. You can add more later, up
        to the number your plan allows.
      </p>

      <h2>Step 3: reading both product lists</h2>
      <p>
        A progress screen appears while Rivlr reads your catalogue and
        theirs. A small shop takes a moment. A shop with thousands of
        products takes several minutes.
      </p>
      <p>
        <strong>You can close the tab.</strong> The reading carries on
        without you, and Rivlr emails you when it has finished so you can
        come back and pick up where you left off.
      </p>

      <h2>Step 4: pick the products you both sell</h2>
      <p>
        Rivlr compares the two product lists and shows you the overlap:
        the things you sell that this competitor sells too. Tick the ones
        you want to watch and they are set up ready to compare, with the
        two products already matched to each other.
      </p>
      <p>
        More matches are shown than your plan lets you watch, on purpose,
        so you choose the ones that matter to your business rather than
        the ones that happened to come out on top of the list. The screen
        tells you how many you can still add.
      </p>

      <h2>If there is no overlap</h2>
      <p>
        Sometimes Rivlr finds nothing in common. That usually means the
        two shops stock different lines, or that the same item is written
        up very differently on each site. You can still pick rival
        products by hand from{" "}
        <Link href="/help/discovery">the Discovery page</Link>, or add another
        competitor and try again.
      </p>
    </>
  ),

  "adding-competitors": () => (
    <>
      <h2>Where competitors live</h2>
      <p>
        Click <strong>Competitors</strong> in the sidebar, below the main
        list and beside Settings. It lists every shop Rivlr is watching
        for you, how many of its products you are watching, and what
        Rivlr has worked out about the shop itself: roughly how big the
        catalogue is, which apps it appears to run, and whether it is on
        Shopify Plus.
      </p>

      <h2>Adding one</h2>
      <ol>
        <li>
          Click <strong>Add a store</strong>.
        </li>
        <li>
          Type the shop&apos;s web address. Any form works, with or
          without <code>https://</code>, and a{" "}
          <code>.myshopify.com</code> address is fine.
        </li>
        <li>
          Leave the &quot;this is my own store&quot; box unticked for a
          competitor. Tick it only for your own shop.
        </li>
        <li>Save.</li>
      </ol>
      <p>
        Rivlr checks it really is a Shopify shop before adding it, so a
        typo or a non-Shopify site is refused rather than sitting there
        quietly doing nothing.
      </p>

      <h2>What happens next</h2>
      <p>
        Rivlr reads the shop&apos;s public product list and compares it
        against your own catalogue. Anything you both sell is offered
        back to you so you can start watching those products in one
        click, already matched to your own version of the product. See{" "}
        <Link href="/help/product-matching">
          how Rivlr matches products you both sell
        </Link>
        .
      </p>

      <h2>Your own shop</h2>
      <p>
        Add your own shop the same way, but tick the box that says it is
        yours. Your own products are free: they never count toward your
        plan&apos;s product limit, and your own shop does not use up a
        competitor slot either. Without it, Rivlr has nothing to compare
        rival prices against, so the Prices and Stock pages stay empty.
      </p>

      <h2>How many competitor shops you can have</h2>
      <p>
        Every plan allows a set number of competitor shops, separate from
        the number of products:
      </p>
      <table>
        <thead>
          <tr>
            <th>Plan</th>
            <th>Competitor shops</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Free</td>
            <td>1</td>
          </tr>
          <tr>
            <td>Starter</td>
            <td>3</td>
          </tr>
          <tr>
            <td>Growth</td>
            <td>10</td>
          </tr>
          <tr>
            <td>Scale</td>
            <td>25</td>
          </tr>
        </tbody>
      </table>
      <p>
        If you are at the limit, Rivlr says so instead of adding the shop.
        Remove a shop you no longer care about, or move up a plan. Full
        detail in <Link href="/help/plans-and-limits">plans and limits</Link>.
      </p>
    </>
  ),

  "product-matching": () => (
    <>
      <h2>Matching happens on its own</h2>
      <p>
        You do not pair products up by hand one at a time. When you add a
        competitor, Rivlr reads their product list, compares it against
        yours, and offers you everything the two of you both sell. Tick
        what you want and it is set up in one click, with your product
        and theirs already sitting together so the price comparison works
        straight away.
      </p>

      <h2>How Rivlr decides two products are the same thing</h2>
      <p>Two ways, in this order:</p>
      <ol>
        <li>
          <strong>By product code.</strong> Where both shops publish the
          same code for an item, that is a certain match.
        </li>
        <li>
          <strong>By product name.</strong> Where the codes do not line
          up, Rivlr compares the two product names.
        </li>
      </ol>
      <p>
        Be aware that most shops use their own internal codes rather than
        the manufacturer&apos;s, so shared codes are rarer than you would
        expect and the product name does most of the work in practice.
      </p>
      <p>
        Name matching is careful rather than eager. If both names state a
        size, a length or a pack quantity and those do not agree, the
        pair is rejected even when the names otherwise look almost
        identical. A 20 inch chain lead and an 80 inch chain lead are not
        the same product, and a wrong match would quietly poison every
        price comparison that came after it.
      </p>

      <MockLinkModal />

      <h2>Matching something by hand</h2>
      <p>
        On the <strong>Prices</strong> page, any of your products without
        a rival on it shows a <strong>+ Match</strong> button. Click it
        and Rivlr offers the closest names it can find on the shops you
        watch. Pick one and the two are matched. You can search if the
        suggestions are not right.
      </p>

      <h2>Why some rows show no price gap</h2>
      <p>
        Sometimes you will see both products and both prices, but the gap
        column is blank. That is deliberate.
      </p>
      <p>
        It happens when one of the two listings covers several sizes or
        options and the other does not. A listing with many sizes shows
        its cheapest one, so comparing that against a single-size listing
        is comparing a small against a large. Rather than print a number
        you might reprice against, Rivlr leaves the gap out and says the
        sizes or options differ. Open both products and compare the size
        you actually care about.
      </p>
      <p>
        The same rule applies in the spreadsheet export, where those rows
        carry the note &quot;Different sizes or options, check before
        comparing&quot;.
      </p>

      <h2>Stopping a match</h2>
      <p>
        On the Prices page, tick the products you are finished with and
        use <strong>Stop watching</strong> in the bar that appears. That
        removes the rival listings attached to them. Your own products
        stay where they are: they arrive from your shop on their own and
        cost you nothing.
      </p>
    </>
  ),

  "adding-products": () => (
    <>
      <h2>When you would do this</h2>
      <p>
        Most people never need to. Adding a competitor shop offers you
        the products you both sell automatically, and the{" "}
        <Link href="/help/discovery">Discovery page</Link> covers the rest. Add
        by link when you want one specific rival product and would rather
        not go looking for it.
      </p>
      <p>
        The add-by-link page is reached from the Prices page. Everything
        you add here counts toward your plan&apos;s product limit.
      </p>

      <h2>One product</h2>
      <p>
        Paste the web address of any Shopify product page. Links in
        either of these shapes work:
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
        Both point at the same product. Do not bother tidying the link
        first. Trailing slashes, marketing codes on the end and language
        prefixes such as <code>/en-gb/</code> are all handled.
      </p>

      <MockAddProduct />

      <h2>Many at once</h2>
      <p>
        Paste a list, one link per line. Commas work too. Rivlr checks
        every link looks right when you submit, then starts reading the
        products in the background.
      </p>

      <MockMultipleUrls />

      <h2>A whole collection</h2>
      <p>
        Paste a Shopify <strong>collection</strong> address instead and
        Rivlr adds every product in it:
      </p>
      <ul>
        <li>
          <code>https://store.com/collections/dog-food</code>
        </li>
        <li>
          <code>https://store.com/collections/all</code>, meaning the
          whole shop
        </li>
      </ul>
      <p>
        You can mix collections and single products in the same paste.
        Each collection is capped at 1,000 products so an accidental
        paste of <code>/collections/all</code> on a huge shop cannot fill
        your whole plan in one click.
      </p>

      <MockMixedCollection />

      <h2>From a spreadsheet</h2>
      <p>
        Click <strong>Upload CSV / text file</strong> and choose a{" "}
        <code>.csv</code>, <code>.tsv</code> or <code>.txt</code> file.
        The layout does not matter: Rivlr picks out every product link it
        can find and ignores headers, notes and spare columns. The
        simplest file is one link per line.
      </p>

      <MockCsvUpload />

      <p>
        The links land in the text box so you can review or edit them
        before you submit, and from there it behaves exactly like a
        normal paste.
      </p>

      <h2>What the result banner means</h2>
      <p>
        After submitting you get a count of how many were added, how many
        you were already watching, and how many failed. Products you
        already watch are skipped quietly. Anything that was not a
        Shopify product page counts as a failure. If an add would take
        you past your plan&apos;s product limit, Rivlr stops and tells
        you rather than silently dropping rows.
      </p>
      <p>
        New products show no price or stock for a few minutes. That is
        normal: the first check fills them in.
      </p>
    </>
  ),

  prices: () => (
    <>
      <h2>What the page shows</h2>
      <p>
        <strong>Prices</strong> is your own catalogue with the cheapest
        rival price beside each product. One row per product you sell,
        with your price, the cheapest rival&apos;s price, the gap as a
        percentage, and their stock.
      </p>
      <p>
        Three counters sit at the top: how many products you have, how
        many of them have a rival on them, and how many you are currently
        priced above a rival on. That last one is the number worth acting
        on.
      </p>
      <p>
        Your own products arrive from your shop on their own and are
        free. They never count toward your plan&apos;s product limit.
      </p>

      <h2>Search</h2>
      <p>
        The search box matches your product names. Type a few words and
        press <strong>Apply</strong>.
      </p>

      <h2>Filters</h2>
      <ul>
        <li>
          <strong>Has a rival</strong> or <strong>No rival yet</strong>.
          Use &quot;no rival yet&quot; to find the gaps in your setup,
          then match them.
        </li>
        <li>
          <strong>By rival shop</strong>. Narrow the page to a single
          competitor, which is the quickest way to answer &quot;where do
          I stand against this one shop&quot;.
        </li>
      </ul>
      <p>
        <strong>Clear</strong> removes every filter. The count on the
        right tells you how many rows are on screen.
      </p>

      <h2>Tick-boxes and bulk actions</h2>
      <p>
        Every row has a tick-box, and the box in the header selects the
        lot. Tick anything and a bar appears at the top of the table
        with:
      </p>
      <ul>
        <li>
          <strong>Apply tag</strong>, to label the selected products. See{" "}
          <Link href="/help/tags">tags, favourites and notes</Link>.
        </li>
        <li>
          <strong>Stop watching</strong>, which removes the rival
          listings attached to the selected products. It asks you to
          confirm first, and it does not touch your own products.
        </li>
      </ul>
      <p>
        If a rival-shop filter is on, stopping watching applies only to
        that shop&apos;s version of the product, which is handy when you
        have finished with one competitor but not the others.
      </p>

      <h2>Getting it into a spreadsheet</h2>
      <p>
        <strong>Export to a spreadsheet</strong> sits under the page
        title. It respects whatever filters are on screen. See{" "}
        <Link href="/help/price-export">exporting prices to a spreadsheet</Link>
        .
      </p>

      <h2>If the page is empty</h2>
      <p>
        Two reasons. Either Rivlr does not know which shop is yours, in
        which case add it on the Competitors page and tick the box that
        says it is yours, or none of your products has a rival on it yet,
        in which case the page offers you a button through to Discovery
        to go and find some.
      </p>
    </>
  ),

  "price-export": () => (
    <>
      <h2>The button</h2>
      <p>
        <strong>Export to a spreadsheet</strong> sits under the title on
        the Prices page. It downloads a CSV that opens in Excel, Numbers
        or Google Sheets.
      </p>

      <h2>It is deliberately not a Shopify import file</h2>
      <p>
        This is the part worth understanding. Shopify&apos;s product
        importer only accepts its own columns, which means a file it
        would accept could not carry the competitor prices. The
        competitor prices are the whole reason for opening the sheet, so
        Rivlr keeps them and lets you handle the upload.
      </p>
      <p>
        Decide your new prices in the sheet, then change them in Shopify
        yourself, either by hand or through Shopify&apos;s own bulk
        editor. The <strong>Handle</strong> and <strong>SKU</strong>{" "}
        columns are there so you can line every row back up with the
        right product in Shopify.
      </p>

      <h2>What is in the file</h2>
      <ul>
        <li>
          <strong>Handle</strong> and <strong>SKU</strong>, to find the
          product again in Shopify.
        </li>
        <li>
          <strong>Product</strong> and <strong>Currency</strong>.
        </li>
        <li>
          <strong>Your price</strong>.
        </li>
        <li>
          <strong>Cheapest competitor</strong> and{" "}
          <strong>Their price</strong>.
        </li>
        <li>
          <strong>Difference</strong> and <strong>Difference %</strong>.
        </li>
        <li>
          <strong>Competitors watched</strong>, the number of rival shops
          on that product.
        </li>
        <li>
          <strong>Note</strong>, in plain English: they are cheaper, you
          are cheaper, same price, no competitor price yet, or that the
          sizes or options differ.
        </li>
        <li>
          <strong>New price</strong>, left empty for you to fill in.
        </li>
      </ul>

      <h2>Order and filters</h2>
      <p>
        Rows come out with the biggest undercut first, so the decisions
        that matter most are at the top of the sheet rather than
        wherever they happened to sit on screen.
      </p>
      <p>
        Whatever filters are on the page ride along with the download.
        Filter to one rival shop and you get a sheet for that shop.
        Filter to &quot;has a rival&quot; and you get only the rows worth
        comparing. Clear the filters and you get everything.
      </p>

      <h2>Rows with a blank difference</h2>
      <p>
        Two cases. Either there is no competitor price yet, or one
        listing covers several sizes or options and the other does not,
        which makes the two prices incomparable. Both say so in the Note
        column. See{" "}
        <Link href="/help/product-matching">how products are matched</Link>.
      </p>

      <h2>The Stock page has its own export</h2>
      <p>
        Same button, different sheet: your product, the rival shop, their
        price, their stock and how fast it is going. See{" "}
        <Link href="/help/stock">the Stock page</Link>.
      </p>
    </>
  ),

  stock: () => (
    <>
      <h2>What the page shows</h2>
      <p>
        <strong>Stock</strong> is the rival side of the things you sell.
        One row per rival listing that is matched to one of your
        products, showing their shop, their price, whether they have it,
        how many they have left where the shop publishes that, and how
        many they have sold recently.
      </p>
      <p>
        Rivals that are <strong>out of stock come first</strong>. That is
        the ordering that makes the page useful: when a competitor cannot
        take the sale and you can, that is your window to hold your price
        or push the product.
      </p>
      <p>
        Two counters at the top: how many rivals are currently out of
        stock, and how many rival products are on the page in total.
      </p>

      <h2>Search and filters</h2>
      <ul>
        <li>
          <strong>Search</strong> by product name or shop name.
        </li>
        <li>
          <strong>Out of stock only</strong>, which is the fastest route
          to today&apos;s list of openings.
        </li>
        <li>
          <strong>Any rival shop</strong>, to narrow to one competitor.
        </li>
      </ul>
      <p>
        Long lists are paged, with Previous and Next at the foot. The
        counter beside the filters tells you how many rows match out of
        the total.
      </p>

      <h2>Tick-boxes and bulk actions</h2>
      <p>
        Tick rows and a bar appears with <strong>Stop watching</strong>.
        It asks you to confirm, because stopping means Rivlr stops
        checking those rival listings and their price and stock history
        goes with them. Your own products are not affected.
      </p>

      <h2>The selling column</h2>
      <p>
        Where a shop publishes an exact stock count, Rivlr can work out
        roughly how many units have gone in the last week. Most shops do
        not publish counts, so this column is blank on a lot of rows, and
        that is normal rather than a fault. Where a number does show,
        read it as the least that sold, not an exact figure. Full
        explanation in{" "}
        <Link href="/help/units-sold">units sold, and why it is sometimes blank</Link>
        .
      </p>

      <h2>Export</h2>
      <p>
        <strong>Export to a spreadsheet</strong> downloads every row
        matching the filters on screen, not just the page you are looking
        at. The columns are your product, your product handle, the rival
        shop, their product, currency, their price, their stock, units
        left, and units sold in the last 7 days at least.
      </p>

      <h2>If the list is short</h2>
      <p>
        The page is worth far more with a few dozen rows than with three,
        so when the list is thin it shows a prompt through to Discovery
        to go and match more of your products against rival versions.
      </p>
    </>
  ),

  discovery: () => (
    <>
      <h2>What the page shows</h2>
      <p>
        <strong>Discovery</strong> lists everything your competitors
        stock that you do not, with the items shifting the most units
        first. It is where you go looking for the next thing to put on
        your shelves.
      </p>
      <p>
        A product appears here when nothing of yours has been matched to
        it. As soon as you match it to one of your own products it drops
        off this page and starts showing on Prices and Stock instead.
      </p>

      <h2>The ordering is the point</h2>
      <p>
        A list of a rival&apos;s catalogue is not very interesting. A
        list sorted by what is actually selling is. Products with a known
        units-sold figure come first, largest first, then the rest.
      </p>
      <p>
        The <strong>Selling</strong> column shows the least a product has
        sold in the last 7 days, worked out from the shop&apos;s stock
        count falling. It is blank wherever the shop keeps its stock
        numbers private, which is most shops. Read{" "}
        <Link href="/help/units-sold">units sold</Link> before you lean on the
        figure.
      </p>

      <h2>Search and filters</h2>
      <ul>
        <li>
          <strong>Search</strong> by product name.
        </li>
        <li>
          <strong>All shops</strong>, or narrow to one competitor. The
          count beside each shop tells you how many of its products you
          do not sell.
        </li>
      </ul>
      <p>Results are paged, 50 at a time.</p>

      <h2>Opening a product</h2>
      <p>
        Click any row to open the product, where you get its price
        history, stock history and the option to match it to one of your
        own products if it turns out you do sell it after all.
      </p>

      <h2>If the page is empty</h2>
      <p>
        Either you have no competitor shops yet, in which case add one
        from the Competitors page, or a shop was added very recently and
        its product list is still being read. That takes a little while
        on a big shop.
      </p>
    </>
  ),

  "units-sold": () => (
    <>
      <h2>Shopify shops do not publish sales figures</h2>
      <p>
        No shop tells you how much it has sold. What some shops do
        publish, on their own product pages, is exactly how many units
        they have left.
      </p>
      <p>
        Rivlr reads that number every time it checks a product. When the
        number goes down, something was sold. Add up the drops over a
        week and you get a figure such as{" "}
        <strong>87 sold in 7 days</strong>. That is the difference
        between knowing a competitor stocks something and knowing that it
        moves.
      </p>
      <p>
        A restock is not a negative sale, so when the number goes up
        Rivlr ignores it rather than subtracting it. Otherwise a busy
        product that was refilled would look as though it had sold
        nothing.
      </p>

      <h2>It is a floor, not an exact figure</h2>
      <p>
        This matters, so it is worth being blunt about. The figure is the{" "}
        <strong>least</strong> that was sold. The real number is that or
        higher, never lower.
      </p>
      <p>
        The reason is simple. Rivlr sees the stock count at each check,
        not in between. If a shop sells ten and then puts ten back on the
        shelf between two checks, the count looks unchanged and those ten
        sales are invisible. Anything sold before Rivlr started watching
        the product is invisible too.
      </p>
      <p>
        So read &quot;87 sold in 7 days&quot; as &quot;at least 87&quot;.
        It is very good for ranking products against each other and for
        telling a mover from a shelf-sitter. It is not an audit of a
        competitor&apos;s books, and Rivlr does not pretend otherwise.
      </p>

      <h2>A blank figure is normal</h2>
      <p>
        Most Shopify shops do not publish stock counts at all. They show
        &quot;in stock&quot; and nothing more. On those products there is
        no number to watch go down, so the column stays blank.
      </p>
      <p>
        For a sense of scale, on a real account with 5,600 products being
        watched, roughly 1,200 of them had a usable figure. That is about
        one in five. A blank cell is the normal case, not a fault, and
        nothing is broken when you see one.
      </p>
      <p>
        Rivlr also waits for a few readings before printing anything. A
        product added yesterday has nothing to say yet.
      </p>

      <h2>Some figures appear before you start watching</h2>
      <p>
        On a competitor shop&apos;s page you will sometimes see a figure
        against a product you have never watched. That happens when the
        product has been under observation already, so the history was
        there before you arrived.
      </p>
      <p>
        There is no privacy question in that. The figure is built from
        numbers the shop publishes openly on its own website to anybody
        who visits. It says nothing about who bought anything, and it
        identifies nobody.
      </p>

      <h2>Where you see it</h2>
      <ul>
        <li>
          <Link href="/help/discovery">Discovery</Link>, where it sets the
          order of the whole page.
        </li>
        <li>
          <Link href="/help/stock">Stock</Link>, in the selling column and in
          the spreadsheet export.
        </li>
        <li>
          <Link href="/help/reading-the-dashboard">Opportunities</Link>, where
          it is what lets Rivlr guess that a rival is about to run out.
        </li>
      </ul>

      <h2>Getting more of them</h2>
      <p>
        In <strong>Settings</strong>, under Checks, there is a switch
        called <strong>Check exact stock daily</strong>. With it on,
        Rivlr asks once a day for the exact quantity on products whose
        shops do not publish one, the same way a shopper&apos;s basket
        would find out. Nothing is ever bought. With it off, Rivlr uses
        only the numbers shops share openly, and you will see fewer
        figures.
      </p>
    </>
  ),

  "reading-the-dashboard": () => (
    <>
      <h2>The dashboard</h2>
      <p>
        Built to be read in thirty seconds with a coffee. Top to bottom:
      </p>

      <h3>Cards</h3>
      <p>
        Price drops and price rises in the last 24 hours, products that
        went out of stock and products that came back. Click a number to
        see what is behind it.
      </p>

      <MockDashboardInsights />

      <h3>Opportunities</h3>
      <p>
        Competitors currently out of stock, longest-standing at the top,
        with their last known price for reference. The longer they have
        been out, the more of their customers have had to shop somewhere
        else.
      </p>

      <h3>Top movers, 7 days</h3>
      <p>
        The biggest price changes of the week, drops in green and rises
        in red, with the percentage beside each. Click a row to open the
        product.
      </p>

      <h3>Recent activity</h3>
      <p>
        A running feed of price and stock changes. <strong>View all</strong>{" "}
        opens the full feed.
      </p>

      <h2>The Opportunities page</h2>
      <p>
        The sidebar entry goes somewhere more detailed, with two lists.
        Both are worked out once a day.
      </p>

      <h3>About to sell out</h3>
      <p>
        Competitor products selling fast enough to run out within the
        next few days. Rivlr gets there by watching how fast their stock
        count is falling, so this list only covers shops that publish
        stock counts. See{" "}
        <Link href="/help/units-sold">units sold</Link> for what that means.
      </p>
      <p>
        You choose how close to empty a product has to be before it
        appears. In <strong>Settings</strong>, under Alerts, set the
        low-stock warning to a number of days. A lower number waits until
        they are nearer to selling out, so fewer products show up.
      </p>

      <h3>Priced above a rival</h3>
      <p>
        Your products where a competitor is currently cheaper, which is
        the same comparison the Prices page makes, filtered to just the
        rows that need a decision.
      </p>

      <h2>The &quot;checks are running behind&quot; banner</h2>
      <p>
        If a lot of products have not been checked recently, a banner
        appears at the top of the dashboard. It usually means checks are
        catching up and it clears itself. If it persists, see{" "}
        <Link href="/help/troubleshooting">common questions and fixes</Link>.
      </p>
    </>
  ),

  notifications: () => (
    <>
      <h2>What Rivlr will email you about</h2>
      <ul>
        <li>A competitor product sells out, or comes back in stock.</li>
        <li>A competitor product drops in price.</li>
        <li>
          A competitor product looks likely to run out soon, sent each
          morning.
        </li>
        <li>A summary of the week, every Monday morning.</li>
      </ul>

      <h2>Choosing who gets them</h2>
      <p>
        Open <strong>Settings</strong> and find{" "}
        <strong>Notification emails</strong>. Add as many addresses as
        you like, separated by commas. There is a{" "}
        <strong>Send test email</strong> button beside it so you can
        check they arrive before you rely on them.
      </p>

      <MockNotificationEmails />

      <h2>Per-product switches</h2>
      <p>
        Open any product and you will find two switches, one for stock
        and one for price. Both start off. Turn them on for the products
        you genuinely want to hear about, otherwise a busy category will
        bury you.
      </p>

      <h2>Turning alerts on in bulk</h2>
      <p>
        Tick several products in a list and use the bar that appears to
        switch alerts on or off for all of them at once.
      </p>

      <h2>No repeat alerts</h2>
      <p>
        You will never get the same kind of alert twice for the same
        product within 24 hours. If a competitor bounces a price up and
        down all day you get at most one price-drop email.
      </p>

      <h2>Not getting emails?</h2>
      <p>Check these in order:</p>
      <ol>
        <li>Are the addresses saved in Settings? Send yourself a test.</li>
        <li>Are the switches on for the right products?</li>
        <li>
          Has anything actually changed? A product that was already out
          of stock when you started watching it will not send a
          sold-out alert.
        </li>
        <li>
          Look in your spam folder. The sender is{" "}
          <code>alerts@rivlr.app</code>.
        </li>
      </ol>
      <p>
        Every email has a one-click unsubscribe link, which switches off
        that kind of email for that address.
      </p>
    </>
  ),

  tags: () => (
    <>
      <h2>Tags</h2>
      <p>
        Tags are colour-coded labels you put on products to keep a long
        list under control: by category, by competitor, by why you are
        watching them at all.
      </p>

      <h3>Creating one</h3>
      <p>
        Go to the Tags page, enter a name and pick a colour. Only tags
        you have already made can be applied, which stops a typo turning
        into a stray tag nobody meant to create.
      </p>

      <MockTagsPage />

      <h3>Applying them</h3>
      <p>
        Tick products in a list, choose a tag in the bar that appears,
        and click <strong>Apply tag</strong>.
      </p>

      <h3>Recolouring and deleting</h3>
      <p>
        Each tag on the Tags page has a colour picker and a delete
        button. Deleting a tag takes it off every product automatically.
      </p>

      <h2>Favourites</h2>
      <p>
        The star beside a product on the Prices page marks it as a
        favourite. Favourites sort to the top of the page and get their
        own panel on the dashboard, which is the quickest way to keep an
        eye on a handful of products that really matter.
      </p>

      <h2>Notes</h2>
      <p>
        Every product has a free-text box for anything you want to
        remember: how often that competitor restocks, a price you tried
        and what happened, a link to your own supplier paperwork.
      </p>
      <p>
        Open the product, type in the notes box, then click{" "}
        <strong>Save</strong> or simply click outside the box and it
        saves itself. Plain text, up to 10,000 characters, line breaks
        kept.
      </p>

      <MockNotesEditor />
    </>
  ),

  "plans-and-limits": () => (
    <>
      <h2>Two limits, not one</h2>
      <p>
        Every plan sets a number of <strong>products</strong> and a
        number of <strong>competitor shops</strong>. They are separate,
        and you can run into either one first.
      </p>
      <p>
        There are two limits because a shop is expensive on its own.
        Adding one means reading its whole product list and re-reading it
        from then on, whether or not you go on to watch anything from it.
      </p>

      <table>
        <thead>
          <tr>
            <th>Plan</th>
            <th>Products</th>
            <th>Competitor shops</th>
            <th>How often prices are checked</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Free</td>
            <td>5</td>
            <td>1</td>
            <td>Daily</td>
          </tr>
          <tr>
            <td>Starter</td>
            <td>50</td>
            <td>3</td>
            <td>Daily</td>
          </tr>
          <tr>
            <td>Growth</td>
            <td>100</td>
            <td>10</td>
            <td>Every 6 hours</td>
          </tr>
          <tr>
            <td>Scale</td>
            <td>250, and up to 2,500</td>
            <td>25</td>
            <td>Every 6 hours</td>
          </tr>
        </tbody>
      </table>

      <h2>Your own products are free</h2>
      <p>
        Products on your own shop never count toward the product limit,
        and your own shop does not use a competitor slot. Rivlr reads
        your whole catalogue however big it is, because it is the thing
        rival prices are compared against.
      </p>
      <p>
        So &quot;50 products&quot; on Starter means 50{" "}
        <strong>competitor</strong> products being watched, which is also
        how most people read it.
      </p>

      <h2>Going past 250 on Scale</h2>
      <p>
        Scale includes 250 products. Above that you add packs of 100 for
        £10 a month each, from the Billing page, up to 2,500 products.
        Beyond 2,500 is a conversation rather than a button, so email us.
      </p>

      <h2>How often things are checked</h2>
      <p>
        Free and Starter check once a day. Growth and Scale check every 6
        hours. It is set by your plan, so there is nothing to configure,
        and Settings shows you which one you are on.
      </p>
      <p>
        A few things run once a day on every plan regardless: prices in
        other countries, the exact stock check, and the low-stock
        warnings.
      </p>

      <h2>Price history</h2>
      <p>
        History is not limited by plan. Price and stock history builds up
        from the day you start watching a product, on every plan
        including Free.
      </p>

      <h2>When you hit a limit</h2>
      <p>
        Rivlr stops and tells you rather than quietly dropping things.
        For products, either stop watching some you no longer need or
        move up a plan. For shops, remove a competitor you have finished
        with or move up a plan. See{" "}
        <Link href="/help/billing-and-cancelling">
          changing plan, card details and cancelling
        </Link>
        .
      </p>
    </>
  ),

  "billing-and-cancelling": () => (
    <>
      <h2>Everything starts on the Billing page</h2>
      <p>
        <strong>Billing</strong> is in the sidebar, near Settings. It
        shows the plan you are on, how much of your product allowance you
        have used, and the four plans side by side.
      </p>

      <h2>Changing plan</h2>
      <p>
        Pick the plan you want and confirm. Moving up takes effect
        immediately and you are charged the difference for the rest of
        the current month. Moving down takes effect the same way, with
        the balance credited against your next bill.
      </p>
      <p>
        If you move down to a plan whose limits are below what you are
        already using, Rivlr tells you before anything changes so you can
        tidy up first.
      </p>

      <h2>Adding product packs on Scale</h2>
      <p>
        On Scale, a picker on the Billing page adds packs of 100 products
        at £10 a month each, up to 2,500 in total. Add or remove packs
        whenever you like.
      </p>

      <h2>Card details and invoices</h2>
      <p>
        These are handled by Stripe, our payment provider. There is a
        link on the Billing page through to Stripe&apos;s own portal,
        where you can change the card on file, update your billing
        address and download every invoice. Rivlr never sees or stores
        your card number.
      </p>

      <h2>Cancelling</h2>
      <p>
        There is a cancel option on the Billing page. Cancelling
        schedules the end of the period you have already paid for, so:
      </p>
      <ul>
        <li>
          You keep everything until the end of the current paid period.
        </li>
        <li>Nothing is charged after that.</li>
        <li>
          At the end of it the account drops to <strong>Free</strong>. It
          is not deleted.
        </li>
        <li>
          You can change your mind and resume any time before the period
          ends.
        </li>
      </ul>
      <p>
        On Free you keep the account, your history and your settings, but
        the Free limits apply: 5 products, 1 competitor shop and daily
        checks.
      </p>

      <h2>Deleting the account entirely</h2>
      <p>
        That is separate, and it lives on the <strong>Profile</strong>{" "}
        page. It removes your data and cannot be undone, so cancel first
        if all you want is to stop paying.
      </p>
    </>
  ),

  troubleshooting: () => (
    <>
      <h2>The sales figure is blank</h2>
      <p>
        Almost always because that shop does not publish a stock count.
        Rivlr works out how much a rival has sold by watching their stock
        number fall, so on a shop that only ever says &quot;in stock&quot;
        there is nothing to watch and the column stays empty.
      </p>
      <p>
        This is the normal case rather than a fault. On a real account
        with 5,600 products, only about 1,200 had a usable figure. Two
        things can help a little:
      </p>
      <ul>
        <li>
          Turn on <strong>Check exact stock daily</strong> in Settings,
          which asks for the exact quantity once a day on products whose
          shops do not publish one.
        </li>
        <li>
          Give it a few days. Rivlr needs several readings before it will
          print a number.
        </li>
      </ul>
      <p>
        Background in{" "}
        <Link href="/help/units-sold">units sold, and why it is sometimes blank</Link>
        .
      </p>

      <h2>There is no price gap on a product</h2>
      <p>
        You can see both products and both prices, but the gap is blank.
        That happens when one listing covers several sizes or options and
        the other does not. The many-size listing shows its cheapest
        option, so the two prices are not comparable, and Rivlr would
        rather show nothing than a number you might reprice against. In
        the spreadsheet export those rows say &quot;Different sizes or
        options, check before comparing&quot;.
      </p>
      <p>
        Open both products and compare the size you actually sell. More
        in{" "}
        <Link href="/help/product-matching">
          how Rivlr matches products you both sell
        </Link>
        .
      </p>

      <h2>My product has not updated yet</h2>
      <p>Work through these in order.</p>

      <h3>1. Has the first check run?</h3>
      <p>
        A newly added product shows no price or stock until its first
        check finishes, usually within a few minutes. The progress widget
        in the bottom-right corner shows it happening.
      </p>

      <h3>2. How often does your plan check?</h3>
      <p>
        Free and Starter check once a day. Growth and Scale check every 6
        hours. If it was checked this morning and you changed nothing,
        the next check is when your plan says it is, not when you refresh
        the page. Settings shows which one you are on.
      </p>
      <p>
        There is no faster option than every 6 hours on any plan, so if
        you need a figure right now, open the product and click{" "}
        <strong>Check now</strong> to run one immediately.
      </p>

      <h3>3. Is the product still on their site?</h3>
      <p>
        If a competitor has removed a product, its page stops loading.
        After a few failures in a row Rivlr pauses it rather than
        retrying forever. Paused products carry a badge and an
        explanation.
      </p>

      <MockAutoPaused />

      <h3>4. Are you looking at the same price they are showing you?</h3>
      <p>
        Shops that sell in several countries show different prices to
        different visitors. Rivlr reads the UK price unless you have
        chosen other countries in Settings. Also check the variants on
        the product page: the price you saw in your browser may belong to
        a different size or option.
      </p>

      <h2>I cannot add another competitor</h2>
      <p>
        Every plan allows a set number of competitor shops: 1 on Free, 3
        on Starter, 10 on Growth, 25 on Scale. This is separate from your
        product limit, so you can be well under on products and still be
        full on shops.
      </p>
      <p>
        Either remove a shop you have finished with, from the Competitors
        page, or move up a plan on the Billing page. Your own shop does
        not count toward this limit. See{" "}
        <Link href="/help/plans-and-limits">plans and limits</Link>.
      </p>

      <h2>The Prices or Stock page is empty</h2>
      <p>
        Rivlr needs to know which shop is yours. Go to{" "}
        <strong>Competitors</strong>, add your own shop and tick the box
        that says it is yours. Then check that some of your products have
        rival versions matched to them: if none do, the page offers you a
        button through to Discovery to go and find some.
      </p>

      <h2>Still stuck?</h2>
      <p>
        Email <a href="mailto:hello@rivlr.app">hello@rivlr.app</a> with
        the product link and anything the product page says under
        &quot;last error&quot;. We will look into it.
      </p>
    </>
  ),
};
