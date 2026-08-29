import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Wordmark } from "@/components/wordmark";
import { HeroDemo } from "./(marketing)/hero-demo";
import { HowItWorks } from "./(marketing)/how-it-works";

export const metadata = {
  title: "Shopify Competitor Price & Stock Tracker | Rivlr",
  description:
    "Track competitor product prices, stock levels, and sales velocity across Shopify stores. Automatic checks through the day, instant alerts, no spreadsheet babysitting. Try free.",
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
      "Track competitor product prices, stock levels, and sales velocity across Shopify stores. Automatic checks through the day, instant alerts.",
    url: "https://rivlr.app",
    siteName: "Rivlr",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shopify Competitor Price & Stock Tracker | Rivlr",
    description:
      "Competitor price and stock tracking for Shopify operators. Checks through the day. Try free.",
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
    "Shopify competitor price and stock tracker. Automatic checks on prices, inventory levels, and sales velocity through the day, with instant email alerts when something changes.",
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "GBP",
      description: "5 tracked products, daily checks",
    },
    {
      "@type": "Offer",
      name: "Starter",
      price: "14.99",
      priceCurrency: "GBP",
      description: "50 tracked products, daily checks",
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
      description: "400 tracked products, checks every 6 hours",
    },
    {
      "@type": "Offer",
      name: "Scale",
      price: "299.00",
      priceCurrency: "GBP",
      description: "2,500 tracked products, checks every 6 hours",
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
  if (await getCurrentUser()) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-paper" data-theme="dark">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_LD) }}
      />

      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-neutral-800/60 bg-[#0a0a0a]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Wordmark size="lg" />
          </Link>
          <div className="flex items-center gap-7 text-sm">
            <a
              href="#demo"
              className="hidden md:inline text-neutral-400 hover:text-paper transition"
            >
              Demo
            </a>
            <a
              href="#pricing"
              className="hidden md:inline text-neutral-400 hover:text-paper transition"
            >
              Pricing
            </a>
            <Link
              href="/help"
              className="hidden md:inline text-neutral-400 hover:text-paper transition"
            >
              Help
            </Link>
            <Link
              href="/login"
              className="text-neutral-400 hover:text-paper transition"
            >
              Sign in
            </Link>
            <Link
              href="/signup?source=nav"
              className="rounded-md bg-signal px-3.5 py-1.5 text-sm font-medium text-white hover:bg-red-600 transition"
            >
              Try for free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-24 md:pt-32 pb-8 text-center">
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.02]">
          Know what your competitors charge. Always.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg md:text-xl text-neutral-400 leading-relaxed">
          Rivlr watches competitor prices and stock across any Shopify
          store, then emails you the moment something changes. Set up in a
          minute. No installs, no spreadsheets.
        </p>

        <div id="demo" className="mx-auto mt-12 max-w-3xl scroll-mt-24 text-left">
          <div className="rounded-2xl border border-neutral-800 bg-[#0f0f0f] p-6 md:p-8">
            <p className="mb-4 text-sm text-neutral-400">
              Try it now. Paste a competitor&apos;s product URL and see
              their live price and stock. No signup needed.
            </p>
            <HeroDemo />
          </div>
        </div>

        <p className="mt-6 text-sm text-neutral-500">
          Free for up to 5 products. No credit card. Cancel anytime.
        </p>
      </section>

      {/* How it works */}
      <HowItWorks />

      {/* Feature blocks */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <FeatureBlock
          title="Every price change, on the record"
          body="Rivlr keeps a full price history for every product you track. See when a rival dropped, by how much, and whether they put it back up. React in hours, not weeks."
          points={[
            "Full price history kept forever on paid plans",
            "Compare up to 5 rivals on one chart",
            "Sale and compare-at prices captured too",
          ]}
        >
          <PriceMockup />
        </FeatureBlock>

        <FeatureBlock
          reverse
          title="Stock levels, down to the unit"
          body="Most trackers tell you in stock or out. Rivlr goes further: where stores expose inventory we read it, and where they hide it we probe for the exact quantity. Watch a rival sell down to zero in real time."
          points={[
            "Exact quantities, not just in or out",
            "Sales velocity worked out from stock movement",
            "Out-of-stock alerts the hour it happens",
          ]}
        >
          <StockMockup />
        </FeatureBlock>

        <FeatureBlock
          title="See how their store really runs"
          body="Every check also reads the signals stores leave in public: the apps and review widgets they run, their merchandising tags, bestseller flags, and quietly added new products."
          points={[
            "Review counts and scores per product",
            "Bestseller and social-proof detection",
            "Daily scan catches new launches",
          ]}
        >
          <IntelMockup />
        </FeatureBlock>

        <FeatureBlock
          reverse
          title="Alerts that respect your inbox"
          body="Opt in per product, per change type. Rivlr dedupes within 24 hours so one price drop means one email. Pro adds a weekly digest of everything that moved."
          points={[
            "Per-product, per-type opt-in",
            "Deduplicated within 24 hours",
            "Weekly digest on Pro",
          ]}
        >
          <AlertMockup />
        </FeatureBlock>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-24 scroll-mt-24">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Simple pricing
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-neutral-400">
            Every plan tracks prices, stock, and sends alerts. Pick how
            many products you watch and how often we check.
          </p>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-4">
          <PricingCard
            name="Free"
            price="£0"
            blurb="Try it properly"
            features={["5 tracked products", "Daily checks", "Email alerts", "30-day history"]}
            cta="Start free"
            href="/signup?source=pricing-free"
          />
          <PricingCard
            name="Starter"
            price="£14.99"
            blurb="For a focused watchlist"
            features={[
              "50 tracked products",
              "Daily checks",
              "Email alerts",
              "Full history kept",
              "Tags and linked products",
            ]}
            cta="Try for free"
            href="/signup?source=pricing-starter"
          />
          <PricingCard
            name="Growth"
            price="£29.99"
            blurb="For serious operators"
            features={[
              "150 tracked products",
              "Checks every 6 hours",
              "Compare view",
              "CSV import",
              "Full history kept",
            ]}
            cta="Try for free"
            href="/signup?source=pricing-growth"
            highlight
          />
          <PricingCard
            name="Pro"
            price="£59.99"
            blurb="For the whole catalogue"
            features={[
              "400 tracked products",
              "Checks every 6 hours",
              "Weekly digest",
              "Priority support",
              "Overage packs: £15 per 100 extra products",
            ]}
            cta="Try for free"
            href="/signup?source=pricing-pro"
          />
          <PricingCard
            name="Scale"
            price="£299"
            blurb="Track every competitor you have"
            features={[
              "2,500 tracked products",
              "Checks every 6 hours",
              "Whole-store scans",
              "Priority support",
              "Everything in Pro",
            ]}
            cta="Try for free"
            href="/signup?source=pricing-scale"
          />
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-neutral-500 leading-relaxed">
          Need more than 400 products? Add overage packs to Pro (£15 a
          month per extra 100) or move to Scale for 2,500. Beyond that,{" "}
          <a
            href="mailto:hello@rivlr.app?subject=Rivlr%20Custom%20plan"
            className="underline underline-offset-4 hover:text-paper"
          >
            talk to us
          </a>{" "}
          about a custom tier.
        </p>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-center">
          Common questions
        </h2>
        <div className="mt-12 space-y-3">
          <Faq q="How does it work, and is it legal?">
            Yes. Rivlr reads the same public product data that Shopify
            stores publish for browsers, apps, and search engines every
            day. We respect rate limits, identify our crawler honestly,
            and stop tracking any store that asks us to.
          </Faq>
          <Faq q="Which stores can I track?">
            Any Shopify store, anywhere in the world. That covers a huge
            share of direct-to-consumer ecommerce. Support for other
            platforms is on the roadmap.
          </Faq>
          <Faq q="Do I need to install anything?">
            No. Rivlr runs entirely in your browser. There is no Shopify
            app to install, no code snippet, and the stores you track
            need nothing from you at all.
          </Faq>
          <Faq q="How fresh is the data?">
            Daily on Free and Starter, and every 6 hours on Growth, Pro
            and Scale. Any product can also be refreshed on demand from
            its detail page.
          </Faq>
          <Faq q="Can I cancel anytime?">
            Yes. Billing is monthly through Stripe and you can cancel in
            the app whenever you like. Access continues until the end of
            the period you have paid for, and your account drops to the
            free plan rather than disappearing.
          </Faq>
          <Faq q="What if I need more than 400 products?">
            Pro supports overage packs: each adds 100 products for £15 a
            month. For bigger catalogues, Scale covers 2,500 products at
            £299 a month. Past that, email us and we will build you a
            custom tier.
          </Faq>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-4xl px-6 py-28 text-center">
        <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
          Start watching your rivals today
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-neutral-400">
          Free for up to 5 products. Your first crawl runs within
          minutes of signing up.
        </p>
        <div className="mt-10">
          <Link
            href="/signup?source=footer-cta"
            className="inline-block rounded-md bg-signal px-8 py-4 text-base font-medium text-white hover:bg-red-600 transition"
          >
            Try Rivlr for free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-800/60">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-wrap items-start justify-between gap-10">
            <div>
              <Wordmark size="lg" />
              <p className="mt-4 max-w-xs text-sm text-neutral-500">
                Competitor price and stock tracking for Shopify
                operators. A Webgro product, made in London.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm sm:grid-cols-3">
              <a href="#demo" className="text-neutral-400 hover:text-paper">
                Demo
              </a>
              <a href="#pricing" className="text-neutral-400 hover:text-paper">
                Pricing
              </a>
              <Link href="/help" className="text-neutral-400 hover:text-paper">
                Help
              </Link>
              <Link
                href="/legal/terms"
                className="text-neutral-400 hover:text-paper"
              >
                Terms
              </Link>
              <Link
                href="/legal/privacy"
                className="text-neutral-400 hover:text-paper"
              >
                Privacy
              </Link>
              <Link
                href="/legal/cookies"
                className="text-neutral-400 hover:text-paper"
              >
                Cookies
              </Link>
              <a
                href="mailto:hello@rivlr.app"
                className="col-span-2 text-neutral-400 hover:text-paper sm:col-span-1"
              >
                hello@rivlr.app
              </a>
            </div>
          </div>
          <div className="mt-12 border-t border-neutral-800/60 pt-6 text-xs text-neutral-500">
            © 2026 Webgro Ltd, England &amp; Wales
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Building blocks ────────────────────────────────────────────────────

function FeatureBlock({
  title,
  body,
  points,
  children,
  reverse,
}: {
  title: string;
  body: string;
  points: string[];
  children: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div
      className={`grid items-center gap-12 py-16 lg:grid-cols-2 ${
        reverse ? "lg:[&>*:first-child]:order-2" : ""
      }`}
    >
      <div>
        <h3 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
          {title}
        </h3>
        <p className="mt-4 text-neutral-400 leading-relaxed">{body}</p>
        <ul className="mt-6 space-y-2.5 text-sm">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2.5">
              <CheckIcon />
              <span className="text-neutral-300">{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>{children}</div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 flex-shrink-0 text-signal"
      aria-hidden
    >
      <path d="M5 12 L10 17 L19 7" />
    </svg>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group overflow-hidden rounded-lg border border-neutral-800 bg-[#0f0f0f]">
      <summary className="flex cursor-pointer list-none select-none items-center justify-between px-5 py-4 transition hover:bg-[#141414]">
        <span className="font-medium">{q}</span>
        <span className="text-neutral-500 transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="px-5 pb-5 text-sm leading-relaxed text-neutral-400">
        {children}
      </div>
    </details>
  );
}

function PricingCard({
  name,
  price,
  blurb,
  features,
  cta,
  href,
  highlight,
}: {
  name: string;
  price: string;
  blurb: string;
  features: string[];
  cta: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 ${
        highlight
          ? "border-signal bg-[#0f0f0f]"
          : "border-neutral-800 bg-[#0f0f0f]"
      }`}
    >
      {highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-signal px-3 py-0.5 text-xs font-medium text-white">
          Most popular
        </span>
      )}
      <div className="text-lg font-semibold">{name}</div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-4xl font-semibold tracking-tight">{price}</span>
        {price !== "£0" && (
          <span className="text-sm text-neutral-500">/month</span>
        )}
      </div>
      <div className="mt-1 text-sm text-neutral-500">{blurb}</div>
      <ul className="mt-6 space-y-2.5 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <CheckIcon />
            <span className="text-neutral-300">{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-8">
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

// ── Feature visuals ────────────────────────────────────────────────────

function MockupFrame({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-[#0f0f0f] shadow-2xl">
      <div className="border-b border-neutral-800 bg-[#141414] px-4 py-2.5 text-xs text-neutral-500">
        {label}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function PriceMockup() {
  return (
    <MockupFrame label="Price history · last 30 days">
      <svg viewBox="0 0 400 180" className="w-full" aria-hidden>
        {[45, 90, 135].map((y) => (
          <line
            key={y}
            x1="0"
            x2="400"
            y1={y}
            y2={y}
            stroke="rgba(127,127,127,0.15)"
          />
        ))}
        <polyline
          fill="none"
          stroke="#FF3B30"
          strokeWidth="2"
          points="0,60 55,60 55,84 130,84 130,70 210,70 210,110 290,110 290,96 400,96"
        />
        <polyline
          fill="none"
          stroke="#525252"
          strokeWidth="2"
          points="0,90 90,90 90,102 180,102 180,122 260,122 260,112 400,112"
        />
        <circle cx="210" cy="110" r="4" fill="#FF3B30" />
      </svg>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-neutral-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-signal" /> Their price
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-neutral-600" /> Yours
        </span>
        <span className="ml-auto font-mono text-signal">Dropped £8.00</span>
      </div>
    </MockupFrame>
  );
}

function StockMockup() {
  const rows = [
    { name: "Linen Overshirt, Sand", qty: "47", state: "ok" },
    { name: "Aero Trainer 02, Bone", qty: "6", state: "low" },
    { name: "Field Tote, Olive", qty: "0", state: "out" },
  ];
  return (
    <MockupFrame label="Stock levels · live">
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.name}
            className="flex items-center justify-between rounded-md border border-neutral-800 bg-[#141414] px-3.5 py-3"
          >
            <span className="text-sm text-paper">{r.name}</span>
            <span
              className={`inline-flex items-center gap-2 font-mono text-sm ${
                r.state === "out"
                  ? "text-signal"
                  : r.state === "low"
                    ? "text-yellow-400"
                    : "text-neutral-300"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  r.state === "out"
                    ? "bg-signal"
                    : r.state === "low"
                      ? "bg-yellow-400"
                      : "bg-green-500"
                }`}
              />
              {r.qty} units
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-xs text-neutral-500">
        Quantity checked through the day. Selling 11 units/day.
      </div>
    </MockupFrame>
  );
}

function IntelMockup() {
  const facts = [
    { label: "Reviews", value: "1,204 · 4.6" },
    { label: "Widget", value: "Judge.me" },
    { label: "Demand", value: "Bestseller" },
    { label: "Listed", value: "2024" },
    { label: "Variants", value: "12" },
    { label: "Images", value: "8" },
  ];
  return (
    <MockupFrame label="Store intel · aero-trainer-02">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label}>
            <div className="text-xs text-neutral-500">{f.label}</div>
            <div className="mt-0.5 font-mono text-sm text-paper">
              {f.value}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {["new-in", "runners", "ss26", "core-range"].map((t) => (
          <span
            key={t}
            className="rounded border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 font-mono text-[11px] text-neutral-400"
          >
            #{t}
          </span>
        ))}
      </div>
    </MockupFrame>
  );
}

function AlertMockup() {
  return (
    <MockupFrame label="Inbox">
      <div className="space-y-2">
        <div className="rounded-md border border-signal/30 bg-signal/[0.05] px-3.5 py-3">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Rivlr</span>
            <span>09:14</span>
          </div>
          <div className="mt-1 text-sm font-medium text-paper">
            Price drop: Aero Trainer 02 now £116.00
          </div>
          <div className="mt-0.5 text-xs text-neutral-400">
            Down £8.00 at runfast.myshopify.com
          </div>
        </div>
        <div className="rounded-md border border-neutral-800 bg-[#141414] px-3.5 py-3">
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Rivlr</span>
            <span>Yesterday</span>
          </div>
          <div className="mt-1 text-sm font-medium text-paper">
            Back in stock: Field Tote, Olive
          </div>
          <div className="mt-0.5 text-xs text-neutral-400">
            62 units at terrabag.myshopify.com
          </div>
        </div>
      </div>
      <div className="mt-3 text-xs text-neutral-500">
        Two emails this week. That is the point.
      </div>
    </MockupFrame>
  );
}
