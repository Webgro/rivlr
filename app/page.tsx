import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { Wordmark } from "@/components/wordmark";
import { HeroDemo } from "./(marketing)/hero-demo";
import { RadarBackground } from "./(marketing)/radar-bg";
import { LivePill } from "./(marketing)/live-pill";
import { IntelTicker } from "./(marketing)/intel-ticker";
import { SectionIndex, DotDivider } from "./(marketing)/section-index";
import { HowItWorks } from "./(marketing)/how-it-works";
import { ComparisonTable } from "./(marketing)/comparison-table";

export const metadata = {
  title: "Shopify Competitor Price & Stock Tracker | Rivlr",
  description:
    "Track competitor product prices, stock levels, and sales velocity across Shopify stores. Hourly updates, instant alerts, no spreadsheet babysitting. Try free.",
  keywords: [
    "shopify competitor price tracker",
    "competitor price tracker",
    "shopify price monitoring",
    "competitor stock tracker",
    "competitor inventory tracker",
    "ecommerce competitor analysis",
    "track competitor prices",
    "shopify stock monitoring",
  ],
  openGraph: {
    title: "Shopify Competitor Price & Stock Tracker | Rivlr",
    description:
      "Track competitor product prices, stock levels, and sales velocity across Shopify stores. Hourly updates, instant alerts.",
    url: "https://rivlr.app",
    siteName: "Rivlr",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shopify Competitor Price & Stock Tracker | Rivlr",
    description:
      "Hourly competitor price and stock tracking for Shopify operators. Try free.",
  },
};

const SOFTWARE_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Rivlr",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "CompetitiveIntelligence",
  operatingSystem: "Web",
  description:
    "Shopify competitor price and stock tracker. Hourly updates on prices, inventory levels, and sales velocity, with instant email alerts when something changes.",
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "GBP",
      description: "5 tracked products, daily crawl",
    },
    {
      "@type": "Offer",
      name: "Starter",
      price: "14.99",
      priceCurrency: "GBP",
      description: "50 tracked products, daily crawl",
    },
    {
      "@type": "Offer",
      name: "Growth",
      price: "29.99",
      priceCurrency: "GBP",
      description: "150 tracked products, every 6 hours",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "59.99",
      priceCurrency: "GBP",
      description: "400 tracked products, hourly crawl",
    },
  ],
  publisher: {
    "@type": "Organization",
    name: "Webgro Ltd",
    url: "https://rivlr.app",
  },
  url: "https://rivlr.app",
};

export default async function MarketingPage() {
  if (await isAuthed()) {
    redirect("/dashboard");
  }

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-paper overflow-hidden" data-theme="dark">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_LD) }}
      />
      <RadarBackground />

      {/* Sticky nav with bigger wordmark */}
      <nav className="sticky top-0 z-40 border-b border-neutral-800/60 bg-[#0a0a0a]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Wordmark size="lg" />
          </Link>
          <div className="flex items-center gap-7 text-sm">
            <a href="#demo" className="hidden md:inline text-neutral-400 hover:text-paper transition">
              Demo
            </a>
            <a href="#features" className="hidden md:inline text-neutral-400 hover:text-paper transition">
              Features
            </a>
            <a href="#pricing" className="hidden md:inline text-neutral-400 hover:text-paper transition">
              Pricing
            </a>
            <Link href="/help" className="hidden md:inline text-neutral-400 hover:text-paper transition">
              Help
            </Link>
            <Link href="/login" className="text-neutral-400 hover:text-paper transition">
              Sign in
            </Link>
            <Link
              href="/signup?source=nav"
              className="rounded-md bg-signal px-3.5 py-1.5 text-sm font-medium text-white hover:bg-red-600"
            >
              Try for free
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO with embedded demo */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-16 md:pt-24 pb-12">
        <div className="max-w-4xl">
          <LivePill />

          <h1 className="mt-8 text-5xl md:text-7xl lg:text-[88px] font-semibold tracking-tight leading-[0.94] text-paper">
            Track any{" "}
            <span
              className="relative inline-block"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              competitor
              {/* Target dot above the word */}
              <span
                className="absolute -top-3 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-signal"
                aria-hidden
              />
              <span
                className="absolute -top-3 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-signal animate-ping opacity-50"
                aria-hidden
              />
            </span>{" "}
            product.
            <br />
            <span className="text-neutral-400">In real time.</span>
          </h1>

          {/* SEO-loaded subhead — picked up by search engines but still on-tone. */}
          <h2 className="mt-6 text-base md:text-lg text-neutral-300 font-mono uppercase tracking-[0.15em]">
            The Shopify competitor price &amp; stock tracker.
          </h2>

          <p className="mt-8 text-lg md:text-xl text-neutral-300 max-w-2xl leading-relaxed">
            Paste a competitor product URL. We&apos;ll show you the live
            price, stock and variant count right now. One click, you
            track it forever.
          </p>

          {/* Embedded demo — the URL field IS the CTA */}
          <div className="mt-10 max-w-3xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.2em] text-paper font-mono">
                ↓ Paste a competitor URL
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono">
                No signup · live data
              </span>
            </div>
            <HeroDemo />
          </div>

          <div className="mt-8 flex items-center gap-6 text-xs text-neutral-400 font-mono">
            <span>Free up to 5 products</span>
            <span className="h-1 w-1 rounded-full bg-neutral-600" />
            <span>No credit card</span>
            <span className="h-1 w-1 rounded-full bg-neutral-600" />
            <span>Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* Live ticker — fake intel feed */}
      <IntelTicker />

      {/* How it works — 3-step explainer right after the ticker */}
      <HowItWorks />

      <DotDivider />

      {/* USPs — reframed as ops capabilities */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <SectionIndex num="01" label="Capabilities" />
        <h2 className="mt-6 max-w-3xl text-4xl md:text-6xl font-semibold tracking-tight leading-[0.98]">
          Four ways to stop{" "}
          <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
            guessing
          </span>
          .
        </h2>
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Capability
            num="01"
            eyebrow="Cadence"
            title="Hourly sweep"
            body="Every product, every hour. The faster you see a price drop, the faster you can match, or hold the line confidently."
          />
          <Capability
            num="02"
            eyebrow="Alerts"
            title="Mail when it lands"
            body="Per-product opt-in, deduped within 24h. No notification fatigue, just the moves you care about."
          />
          <Capability
            num="03"
            eyebrow="Velocity"
            title="Read sales speed"
            body="Where stores expose inventory we calculate units sold per period. Spot trending products before TikTok finds them."
          />
          <Capability
            num="04"
            eyebrow="Scale"
            title="1,000 in one paste"
            body="Product URLs, collection URLs, CSV upload. We expand, dedupe, and start watching in the background."
          />
          <Capability
            num="05"
            eyebrow="Discover"
            title="Catch new launches"
            body="Daily catalogue scan finds products competitors quietly add. Track them with one click before anyone else notices."
          />
          <Capability
            num="06"
            eyebrow="Compare"
            title="Stack rivals"
            body="Pick 2 to 5 products. Their full price history, overlaid on one chart. See who leads the market and who follows."
          />
        </div>
      </section>

      <DotDivider />

      {/* The seven tools the sidebar surfaces. Light visual map between
          marketing copy and what the user actually sees once inside. */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <SectionIndex num="·" label="What you get inside" />
        <h2 className="mt-5 text-3xl md:text-4xl font-semibold tracking-tight max-w-3xl">
          Seven tools.{" "}
          <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
            One sidebar.
          </span>
        </h2>
        <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <SidebarTeaser
            iconShape="dashboard"
            label="Dashboard"
            body="The morning scan. Insights cards, opportunities, activity feed."
          />
          <SidebarTeaser
            iconShape="products"
            label="Products"
            body="Your full watchlist. Filters, search, bulk actions, CSV export."
          />
          <SidebarTeaser
            iconShape="discover"
            label="Discover"
            body="New products on stores you watch. One-click track or dismiss."
          />
          <SidebarTeaser
            iconShape="activity"
            label="Activity"
            body="Every detected change in the last 30 days. Filter by store or kind."
          />
          <SidebarTeaser
            iconShape="suggestions"
            label="Suggestions"
            body="Auto-detected matches across stores. Approve to link them."
          />
          <SidebarTeaser
            iconShape="tags"
            label="Tags"
            body="Colour-coded labels. Apply in bulk, filter from anywhere."
          />
          <SidebarTeaser
            iconShape="settings"
            label="Settings"
            body="Notification emails. Per-product alerts you control."
          />
          <SidebarTeaser
            iconShape="help"
            label="Help"
            body="The articles that answer the things people actually ask."
          />
        </div>
      </section>

      <DotDivider />

      {/* Dashboard mockup */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr] items-end">
          <div>
            <SectionIndex num="02" label="The dashboard" />
            <h2 className="mt-5 text-4xl md:text-6xl font-semibold tracking-tight leading-[0.98]">
              Density.{" "}
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
                No fluff.
              </span>
            </h2>
            <p className="mt-5 text-neutral-400 leading-relaxed">
              Every row tells you the same three things: <em>what changed,
              by how much, do I care.</em> Built to be scanned in seconds,
              not pored over.
            </p>
          </div>
          <div className="relative">
            {/* Crosshair brackets around the mockup */}
            <CornerBracket className="absolute left-0 top-0 -translate-x-2 -translate-y-2" />
            <CornerBracket className="absolute right-0 top-0 translate-x-2 -translate-y-2" rotate={90} />
            <CornerBracket className="absolute left-0 bottom-0 -translate-x-2 translate-y-2" rotate={270} />
            <CornerBracket className="absolute right-0 bottom-0 translate-x-2 translate-y-2" rotate={180} />
            <DashboardMockup />
          </div>
        </div>
      </section>

      <DotDivider />

      {/* Comparison table — Rivlr vs Prisync vs spreadsheet */}
      <ComparisonTable />

      {/* Feature rows */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <FeatureRow
          num="03"
          eyebrow="Compare"
          title="Stack rivals."
          italic="Side by side."
          body="Pick 2–5 tracked products, get their full price history overlaid on one chart. Spot which competitor leads price wars vs. follows them."
        >
          <CompareMockup />
        </FeatureRow>

        <FeatureRow
          num="04"
          eyebrow="Linked products"
          title="Same item."
          italic="Every store."
          body="Rivlr auto-detects when you're tracking the same product on multiple stores. Approve the link and see all of them in one row. Perfect for category benchmarks."
          reverse
        >
          <LinkedMockup />
        </FeatureRow>

        <FeatureRow
          num="05"
          eyebrow="Tags & filtering"
          title="Cut noise."
          italic="Find signal."
          body="Colour-coded tags, multi-store filters, search across thousands of products. Track 1,000 SKUs without losing the plot."
        >
          <TagsMockup />
        </FeatureRow>
      </section>

      <DotDivider />

      {/* Mid-page CTA — bold typographic moment */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-20">
        <div className="rounded-3xl border border-neutral-800 bg-gradient-to-br from-[#141414] via-[#0d0d0d] to-[#0a0a0a] p-10 md:p-16 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-signal/20 blur-3xl pointer-events-none" />
          <div className="relative">
            <SectionIndex num="06" label="Decide" />
            <h2 className="mt-5 text-4xl md:text-6xl font-semibold tracking-tight leading-[0.98] max-w-3xl">
              Stop checking competitor prices{" "}
              <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
                with your eyes
              </span>
              .
            </h2>
            <p className="mt-6 max-w-2xl text-neutral-400 text-lg">
              The first crawl runs while you read this paragraph. Set up
              takes one minute. Two if you&apos;re a slow paster.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-5">
              <Link
                href="/signup?source=mid-cta"
                className="rounded-md bg-signal px-7 py-4 text-base font-medium text-white hover:bg-red-600"
              >
                Try for free →
              </Link>
              <a
                href="#demo"
                className="text-sm text-neutral-400 hover:text-paper underline-offset-4 hover:underline"
              >
                or test it on a URL first ↑
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <div className="text-center">
          <SectionIndex num="07" label="Pricing" />
          <h2 className="mt-5 text-4xl md:text-6xl font-semibold tracking-tight leading-[0.98]">
            Pick a{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
              cadence
            </span>
            .
          </h2>
          <p className="mt-5 text-neutral-400 max-w-xl mx-auto">
            Tiered by how many products you watch and how often. Same
            features at every paid level. Only crawl frequency and
            volume change.
          </p>
        </div>

        <div className="mt-16 grid gap-4 lg:grid-cols-4">
          <PricingCard
            name="Free"
            price="£0"
            cadence="Daily"
            seats={5}
            features={[
              "5 tracked products",
              "Daily crawls",
              "Email alerts",
              "30-day history",
            ]}
            cta="Start free"
            href="/signup?source=pricing-free"
          />
          <PricingCard
            name="Starter"
            price="£14.99"
            cadence="Daily"
            seats={50}
            features={[
              "50 tracked products",
              "Daily crawls",
              "Email alerts",
              "Forever history",
              "Tags & linked products",
            ]}
            cta="Try for free"
            href="/signup?source=pricing-starter"
          />
          <PricingCard
            name="Growth"
            price="£29.99"
            cadence="Every 6h"
            seats={150}
            features={[
              "150 tracked products",
              "Every 6 hours",
              "Email alerts",
              "Forever history",
              "Compare view",
              "CSV import",
            ]}
            cta="Try for free"
            href="/signup?source=pricing-growth"
            highlight
          />
          <PricingCard
            name="Pro"
            price="£59.99"
            cadence="Hourly"
            seats={400}
            features={[
              "400 tracked products",
              "Hourly crawls",
              "Email alerts",
              "Forever history",
              "Variant tracking",
              "Priority support",
            ]}
            cta="Try for free"
            href="/signup?source=pricing-pro"
          />
        </div>
        <div className="mt-10 text-center text-sm text-neutral-400">
          Tracking 500+ products?{" "}
          <a
            href="mailto:support@rivlr.app?subject=Rivlr%20Custom%20plan"
            className="underline underline-offset-4 hover:text-paper"
          >
            Talk to us →
          </a>
        </div>
      </section>

      <DotDivider />

      {/* FAQ */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 py-12">
        <SectionIndex num="08" label="Common questions" />
        <h2 className="mt-5 text-4xl md:text-5xl font-semibold tracking-tight">
          Things people ask.
        </h2>
        <div className="mt-12 space-y-3">
          <Faq q="Is this only for Shopify stores?">
            For now, yes. We crawl public Shopify product endpoints,
            something like 30% of DTC ecommerce, and we&apos;ve focused on
            doing one platform brilliantly first. WooCommerce and
            BigCommerce are on the roadmap.
          </Faq>
          <Faq q="Is what you do legal?">
            Yes. We retrieve publicly accessible product information that
            Shopify themes, apps, and embeds use every day. We respect rate
            limits and identify ourselves with a polite User-Agent. Store
            owners can request we stop tracking by emailing support and
            we comply within 10 working days.
          </Faq>
          <Faq q="How fresh is the data?">
            Depends on your plan: daily, every 6h, or hourly. Plus any
            individual product can be force-refreshed on demand from its
            detail page if you spot something interesting.
          </Faq>
          <Faq q="What about email overload?">
            You opt in to alerts per product, per type (stock change vs
            price drop), and we deduplicate within 24 hours so you
            won&apos;t get three alerts for the same drop. Most users end
            up with a quiet inbox and one or two genuinely useful pings
            per day.
          </Faq>
          <Faq q="Can my team use it?">
            Multi-user accounts are coming in the next release. Sign up to
            the waitlist and you&apos;ll get early access plus invitation
            tokens for teammates when launched.
          </Faq>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 py-32 text-center">
        <div className="inline-flex items-center gap-3 mb-10">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" />
          <span className="h-1 w-1 rounded-full bg-signal/60" />
          <span className="h-1 w-1 rounded-full bg-signal/30" />
        </div>
        <h2 className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tight leading-[0.92]">
          Watch the{" "}
          <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
            rivals
          </span>
          .
        </h2>
        <p className="mt-8 text-lg text-neutral-400 max-w-xl mx-auto">
          Free up to 5 products. Set up in a minute. Real-time competitor
          intel from the moment you sign in.
        </p>
        <div className="mt-12">
          <Link
            href="/signup?source=footer-cta"
            className="inline-block rounded-md bg-signal px-9 py-4 text-base font-medium text-white hover:bg-red-600"
          >
            Try for free →
          </Link>
        </div>
      </section>

      {/* Footer with bigger wordmark */}
      <footer className="relative z-10 border-t border-neutral-800/60">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-start justify-between gap-12">
            <div>
              <Wordmark size="xl" />
              <p className="mt-4 text-sm text-neutral-500 font-mono max-w-xs">
                Competitive intelligence for Shopify operators. A Webgro Ltd
                product, made in London.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-12 gap-y-3 text-sm">
              <Link href="#demo" className="text-neutral-400 hover:text-paper">
                Demo
              </Link>
              <Link href="#pricing" className="text-neutral-400 hover:text-paper">
                Pricing
              </Link>
              <Link href="/help" className="text-neutral-400 hover:text-paper">
                Help
              </Link>
              <Link href="/legal/terms" className="text-neutral-400 hover:text-paper">
                Terms
              </Link>
              <Link href="/legal/privacy" className="text-neutral-400 hover:text-paper">
                Privacy
              </Link>
              <Link href="/legal/cookies" className="text-neutral-400 hover:text-paper">
                Cookies
              </Link>
              <a
                href="mailto:support@rivlr.app"
                className="text-neutral-400 hover:text-paper col-span-2 sm:col-span-1"
              >
                support@rivlr.app
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-neutral-800/60">
          <div className="mx-auto max-w-6xl px-6 py-5 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500 font-mono">
            <span>© 2026 Webgro Ltd · England &amp; Wales</span>
            <div className="inline-flex items-center gap-2 text-neutral-600">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-signal opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal" />
              </span>
              <span>Surveillance ongoing</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Section building blocks
// ────────────────────────────────────────────────────────────────────────

function Capability({
  num,
  eyebrow,
  title,
  body,
}: {
  num: string;
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="relative rounded-xl border border-neutral-800 bg-[#0d0d0d] p-6 hover:border-neutral-700 transition group">
      <div className="flex items-start justify-between mb-5">
        <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 font-mono">
          {num}
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-signal opacity-60 group-hover:opacity-100 transition" />
      </div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-signal font-mono">
        {eyebrow}
      </div>
      <div className="mt-2 text-xl font-semibold tracking-tight">{title}</div>
      <p className="mt-3 text-sm text-neutral-400 leading-relaxed">{body}</p>
    </div>
  );
}

function FeatureRow({
  num,
  eyebrow,
  title,
  italic,
  body,
  children,
  reverse,
}: {
  num: string;
  eyebrow: string;
  title: string;
  italic: string;
  body: string;
  children: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div
      className={`grid gap-12 items-center py-16 lg:grid-cols-2 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}
    >
      <div>
        <SectionIndex num={num} label={eyebrow} />
        <h3 className="mt-5 text-4xl md:text-5xl font-semibold tracking-tight leading-[0.98]">
          {title}{" "}
          <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
            {italic}
          </span>
        </h3>
        <p className="mt-5 text-neutral-400 leading-relaxed">{body}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-neutral-800 bg-[#0d0d0d] overflow-hidden">
      <summary className="cursor-pointer list-none flex items-center justify-between px-5 py-4 select-none hover:bg-[#141414] transition">
        <span className="font-medium flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-signal opacity-60 group-open:opacity-100 transition" />
          {q}
        </span>
        <span className="text-neutral-500 group-open:rotate-90 transition-transform">
          ›
        </span>
      </summary>
      <div className="px-5 pb-5 pl-12 text-sm text-neutral-400 leading-relaxed">
        {children}
      </div>
    </details>
  );
}

function PricingCard({
  name,
  price,
  cadence,
  seats,
  features,
  cta,
  href,
  highlight,
}: {
  name: string;
  price: string;
  cadence: string;
  seats: number;
  features: string[];
  cta: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative rounded-2xl border p-6 flex flex-col ${
        highlight
          ? "border-signal bg-gradient-to-b from-signal/[0.04] to-[#0d0d0d]"
          : "border-neutral-800 bg-[#0d0d0d]"
      }`}
    >
      {highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-signal px-3 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white font-mono">
          Most popular
        </span>
      )}
      <div className="text-lg font-semibold">{name}</div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-4xl font-semibold tracking-tight">{price}</span>
        {price !== "£0" && (
          <span className="text-sm text-neutral-500">/mo</span>
        )}
      </div>
      <div className="mt-1 text-xs text-neutral-500 font-mono">
        {seats} products · {cadence}
      </div>
      <ul className="mt-6 space-y-2.5 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="text-signal flex-shrink-0 mt-0.5">·</span>
            <span className="text-neutral-300">{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 pt-6 border-t border-neutral-800/50">
        <Link
          href={href}
          className={`block w-full rounded-md py-2.5 text-center text-sm font-medium transition ${
            highlight
              ? "bg-signal text-white hover:bg-red-600"
              : "bg-paper text-ink hover:bg-neutral-200"
          }`}
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}

function SidebarTeaser({
  iconShape,
  label,
  body,
}: {
  iconShape:
    | "dashboard"
    | "products"
    | "discover"
    | "activity"
    | "suggestions"
    | "tags"
    | "settings"
    | "help";
  label: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-[#0d0d0d] p-4 hover:border-neutral-700 transition group">
      <div className="flex items-center gap-3">
        <div className="rounded-md border border-neutral-800 bg-[#141414] p-2 text-signal/80 group-hover:text-signal transition">
          <SidebarIconRender shape={iconShape} />
        </div>
        <div className="text-base font-semibold tracking-tight">{label}</div>
      </div>
      <p className="mt-3 text-xs text-neutral-400 leading-relaxed">{body}</p>
    </div>
  );
}

function SidebarIconRender({ shape }: { shape: string }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (shape) {
    case "dashboard":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case "products":
      return (
        <svg {...props}>
          <path d="M3 7 L12 3 L21 7 L12 11 L3 7 Z" />
          <path d="M3 7 V17 L12 21 V11" />
          <path d="M21 7 V17 L12 21" />
        </svg>
      );
    case "discover":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M16.24 7.76 L13.5 13.5 L7.76 16.24 L10.5 10.5 z" />
        </svg>
      );
    case "activity":
      return (
        <svg {...props}>
          <path d="M3 12 H7 L9 6 L13 18 L15 12 H21" />
        </svg>
      );
    case "suggestions":
      return (
        <svg {...props}>
          <path d="M9 12 H4 a3 3 0 0 1 0 -6 h2 a3 3 0 0 1 3 3 v0" />
          <path d="M15 12 h5 a3 3 0 0 1 0 6 h-2 a3 3 0 0 1 -3 -3 v0" />
          <path d="M9 12 L15 12" />
        </svg>
      );
    case "tags":
      return (
        <svg {...props}>
          <path d="M20.59 13.41 L13.42 20.58 a2 2 0 0 1 -2.83 0 L3 13 V3 h10 l7.59 7.59 a2 2 0 0 1 0 2.82 z" />
          <circle cx="7" cy="7" r="1.25" fill="currentColor" stroke="none" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "help":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5 a2.5 2.5 0 0 1 5 0 c0 1.5 -2 2 -2.5 3" />
          <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return null;
  }
}

function CornerBracket({
  className,
  rotate = 0,
}: {
  className?: string;
  rotate?: number;
}) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      className={`text-signal ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
      aria-hidden
    >
      <path
        d="M0 5 V0 H5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Inline mockups
// ────────────────────────────────────────────────────────────────────────

function DashboardMockup() {
  const rows = [
    { title: "Linen Overshirt — Sand", store: "verdantcloth.myshopify.com", price: "£89.00", stock: { type: "in" as const, label: "In stock · 47" }, delta: { fmt: "−£4.00", color: "text-green-500" } },
    { title: "Aero Trainer 02 — Bone", store: "runfast.myshopify.com", price: "£124.00", stock: { type: "out" as const, label: "Out of stock · 4d" }, delta: { fmt: "+£10.00", color: "text-signal" } },
    { title: "Field Tote — Olive Canvas", store: "terrabag.myshopify.com", price: "£64.00", stock: { type: "low" as const, label: "Low · 6 left" }, delta: { fmt: "—", color: "text-neutral-500" } },
    { title: "Matcha Daily Whisk — Bamboo", store: "kettlerituals.myshopify.com", price: "£18.50", stock: { type: "in" as const, label: "In stock · 312" }, delta: { fmt: "—", color: "text-neutral-500" } },
    { title: "Sleep Mask — Charcoal Silk", store: "nocturnegoods.myshopify.com", price: "£42.00", stock: { type: "in" as const, label: "In stock · 18" }, delta: { fmt: "−£3.00", color: "text-green-500" } },
  ];

  return (
    <div className="rounded-xl border border-neutral-800 bg-[#0a0a0a] overflow-hidden shadow-2xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800 bg-[#141414]">
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
        <span className="ml-3 text-xs text-neutral-500 font-mono">rivlr.app/products</span>
      </div>
      <div className="grid grid-cols-[28px_2.4fr_1fr_1.2fr_1fr] gap-3 px-5 py-3 border-b border-neutral-800 bg-[#141414] text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
        <div></div>
        <div>Product</div>
        <div>Price</div>
        <div>Stock</div>
        <div className="text-right">Δ 24h</div>
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          className="grid grid-cols-[28px_2.4fr_1fr_1.2fr_1fr] items-center gap-3 px-5 py-3 border-b border-neutral-800 last:border-b-0 text-sm"
        >
          <div>
            <span className="block h-3.5 w-3.5 rounded border border-neutral-700" />
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-9 w-9 rounded-md flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, hsl(${(i * 67) % 360},20%,18%), hsl(${(i * 67 + 30) % 360},25%,28%))`,
              }}
            />
            <div className="min-w-0">
              <div className="truncate font-medium text-paper">{r.title}</div>
              <div className="truncate text-[11px] text-neutral-500 font-mono">
                {r.store}
              </div>
            </div>
          </div>
          <div className="font-mono text-paper">{r.price}</div>
          <div className="text-sm">
            <span className="inline-flex items-center gap-2 text-neutral-300">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  r.stock.type === "in"
                    ? "bg-green-500"
                    : r.stock.type === "low"
                      ? "bg-yellow-500"
                      : "bg-signal"
                }`}
              />
              {r.stock.label}
            </span>
          </div>
          <div className={`text-right font-mono ${r.delta.color}`}>{r.delta.fmt}</div>
        </div>
      ))}
    </div>
  );
}

function CompareMockup() {
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#0a0a0a] p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
          Compare 3 products · last 30 days
        </div>
        <span className="h-1.5 w-1.5 rounded-full bg-signal" />
      </div>
      <svg viewBox="0 0 400 180" className="mt-4 w-full">
        {[40, 80, 120, 160].map((y) => (
          <line
            key={y}
            x1="20"
            x2="380"
            y1={y}
            y2={y}
            stroke="rgba(127,127,127,0.18)"
            strokeDasharray="2 4"
          />
        ))}
        <polyline fill="none" stroke="#FF3B30" strokeWidth="2" points="20,80 60,72 100,68 140,75 180,52 220,48 260,40 300,38 340,30 380,28" />
        <polyline fill="none" stroke="#3b82f6" strokeWidth="2" points="20,100 60,98 100,96 140,90 180,92 220,88 260,80 300,78 340,72 380,70" />
        <polyline fill="none" stroke="#22c55e" strokeWidth="2" points="20,140 60,138 100,135 140,132 180,128 220,118 260,108 300,98 340,90 380,86" />
      </svg>
      <div className="mt-4 flex flex-wrap gap-3 text-[11px] font-mono">
        <span className="inline-flex items-center gap-1.5 text-neutral-400">
          <span className="h-2 w-2 rounded-full bg-signal" /> Premium dog food 5kg
        </span>
        <span className="inline-flex items-center gap-1.5 text-neutral-400">
          <span className="h-2 w-2 rounded-full bg-blue-500" /> Same item, brand B
        </span>
        <span className="inline-flex items-center gap-1.5 text-neutral-400">
          <span className="h-2 w-2 rounded-full bg-green-500" /> Same item, brand C
        </span>
      </div>
    </div>
  );
}

function LinkedMockup() {
  const items = [
    { title: "Premium Dog Food 5kg", store: "petworld.co.uk", price: "£32.99", stock: "in" },
    { title: "Premium Dog Food 5kg", store: "kennelclub.shop", price: "£28.50", stock: "in" },
    { title: "Premium Dog Food 5kg", store: "doglife.shop", price: "£35.00", stock: "out" },
  ];
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#0a0a0a] p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
          Linked products · 3 stores
        </div>
        <span className="h-1.5 w-1.5 rounded-full bg-signal" />
      </div>
      <div className="mt-4 space-y-2">
        {items.map((it, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md border border-neutral-800 bg-[#141414] px-3 py-2.5"
          >
            <div
              className="h-8 w-8 rounded flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, hsl(${(i * 91) % 360},20%,20%), hsl(${(i * 91 + 30) % 360},25%,30%))`,
              }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-paper">{it.title}</div>
              <div className="truncate text-[11px] text-neutral-500 font-mono">{it.store}</div>
            </div>
            <div className="text-right text-sm flex-shrink-0">
              <div className="font-mono text-paper">{it.price}</div>
              <div
                className={`text-[10px] inline-flex items-center gap-1 ${it.stock === "in" ? "text-green-500" : "text-signal"}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${it.stock === "in" ? "bg-green-500" : "bg-signal"}`} />
                {it.stock === "in" ? "In stock" : "Out"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TagsMockup() {
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#0a0a0a] p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
          Filter by tag
        </div>
        <span className="h-1.5 w-1.5 rounded-full bg-signal" />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {[
          { name: "premium", colour: "rgba(168,85,247,0.18)", fg: "#d8b4fe" },
          { name: "watching", colour: "rgba(59,130,246,0.18)", fg: "#93c5fd" },
          { name: "outlet", colour: "rgba(249,115,22,0.18)", fg: "#fdba74" },
          { name: "dog-food", colour: "rgba(34,197,94,0.18)", fg: "#86efac" },
          { name: "uk-only", colour: "rgba(115,115,115,0.22)", fg: "#a3a3a3" },
          { name: "competitor-a", colour: "rgba(239,68,68,0.18)", fg: "#fca5a5" },
          { name: "subscription", colour: "rgba(234,179,8,0.22)", fg: "#fde047" },
        ].map((t) => (
          <span
            key={t.name}
            className="rounded px-2 py-0.5 text-[10px] uppercase tracking-wider font-mono"
            style={{ backgroundColor: t.colour, color: t.fg }}
          >
            #{t.name}
          </span>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[3/2] rounded-md border border-neutral-800 bg-[#141414] flex items-end p-2"
          >
            <div className="text-[9px] text-neutral-500 font-mono truncate">product</div>
          </div>
        ))}
      </div>
    </div>
  );
}
