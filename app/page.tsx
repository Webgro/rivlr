import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { Wordmark } from "@/components/wordmark";
import { DemoWidget } from "./(marketing)/demo-widget";

export const metadata = {
  title: "Rivlr — competitive intel for Shopify",
  description:
    "Track competitor prices, stock levels, and sales velocity across Shopify stores. Hourly checks, instant alerts, no spreadsheet babysitting.",
};

export default async function MarketingPage() {
  if (await isAuthed()) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-paper" data-theme="dark">
      {/* Sticky nav */}
      <nav className="sticky top-0 z-40 border-b border-neutral-800/60 bg-[#0a0a0a]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Wordmark />
          <div className="flex items-center gap-6 text-sm">
            <a
              href="#demo"
              className="hidden md:inline text-neutral-400 hover:text-paper"
            >
              Live demo
            </a>
            <a
              href="#features"
              className="hidden md:inline text-neutral-400 hover:text-paper"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="hidden md:inline text-neutral-400 hover:text-paper"
            >
              Pricing
            </a>
            <Link
              href="/help"
              className="hidden md:inline text-neutral-400 hover:text-paper"
            >
              Help
            </Link>
            <Link
              href="/login"
              className="text-neutral-400 hover:text-paper"
            >
              Sign in
            </Link>
            <Link
              href="/signup?source=nav"
              className="rounded-md bg-signal px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600"
            >
              Try for free
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-24">
        <div className="max-w-3xl">
          <span className="inline-block text-[11px] uppercase tracking-[0.15em] text-neutral-500 font-mono mb-6">
            Competitive intel for Shopify
          </span>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[0.96]">
            Know what your{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
              rivals
            </span>{" "}
            are doing.
            <br />
            Before they do.
          </h1>
          <p className="mt-8 text-lg text-neutral-400 max-w-2xl leading-relaxed">
            Rivlr tracks competitor prices, stock levels, and actual sales
            velocity across Shopify stores. Hourly checks. Instant alerts.
            No spreadsheets. Built for ecommerce teams who want to act on
            real signal, not feelings.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/signup?source=hero"
              className="rounded-md bg-signal px-6 py-3.5 text-sm font-medium text-white hover:bg-red-600"
            >
              Try for free →
            </Link>
            <a
              href="#demo"
              className="text-sm text-neutral-400 hover:text-paper underline-offset-4 hover:underline"
            >
              Or test it on a real product →
            </a>
          </div>
          <p className="mt-6 text-xs text-neutral-500 font-mono">
            Free up to 5 products · No credit card needed · Cancel anytime
          </p>
        </div>
      </section>

      {/* LIVE DEMO */}
      <section
        id="demo"
        className="mx-auto max-w-4xl px-6 py-24 border-t border-neutral-800/60"
      >
        <div className="text-center">
          <span className="text-[11px] uppercase tracking-[0.15em] text-signal font-mono">
            Try it now
          </span>
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight">
            Drop in any{" "}
            <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
              competitor
            </span>{" "}
            URL.
          </h2>
          <p className="mt-4 text-neutral-400">
            We&apos;ll fetch the live product data right now — no signup. See
            the kind of intel you&apos;ll get on every product, every hour.
          </p>
        </div>

        <div className="mt-10">
          <DemoWidget />
        </div>
      </section>

      {/* USPs */}
      <section className="mx-auto max-w-6xl px-6 py-24 border-t border-neutral-800/60">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Usp
            eyebrow="Hourly cadence"
            title="Watch the market in real time"
            body="Every product, checked every hour. When a competitor raises a price or runs out of stock, you'll know before they recover."
          />
          <Usp
            eyebrow="Instant alerts"
            title="Email when it matters"
            body="Per-product toggles for stock changes and price drops. No pipeline of irrelevant pings — only events you flagged."
          />
          <Usp
            eyebrow="Sales velocity"
            title="See actual unit movement"
            body="Where stores expose inventory, we calculate units sold per period. Spot trending products before TikTok does."
          />
          <Usp
            eyebrow="Bulk import"
            title="Add 1,000 in one paste"
            body="Paste product URLs, collection URLs, or upload a CSV. We expand collections, dedupe, and track in the background."
          />
        </div>
      </section>

      {/* DASHBOARD MOCKUP */}
      <section
        id="features"
        className="mx-auto max-w-6xl px-6 py-24 border-t border-neutral-800/60"
      >
        <div className="max-w-2xl">
          <span className="text-[11px] uppercase tracking-[0.15em] text-signal font-mono">
            The dashboard
          </span>
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight">
            Density over decoration.
          </h2>
          <p className="mt-4 text-neutral-400 text-lg">
            Every row answers one question:{" "}
            <em style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}>
              what changed, by how much, do I care?
            </em>
          </p>
        </div>

        <div className="mt-12">
          <DashboardMockup />
        </div>
      </section>

      {/* FEATURE ROWS */}
      <section className="mx-auto max-w-6xl px-6 py-12 border-t border-neutral-800/60">
        <FeatureRow
          eyebrow="Compare"
          title="Stack competitors side by side."
          body="Pick 2–5 tracked products, get their price history overlaid on one chart. Spot which competitor leads price wars vs. follows them."
        >
          <CompareMockup />
        </FeatureRow>

        <FeatureRow
          eyebrow="Linked products"
          title="The same item across every store."
          body="Rivlr auto-detects when you're tracking the same product on multiple stores. Approve the link and see all of them on one screen — perfect for category benchmarks."
          reverse
        >
          <LinkedMockup />
        </FeatureRow>

        <FeatureRow
          eyebrow="Tags & organisation"
          title="Cut through the noise."
          body="Colour-coded tags, multi-store filters, search across thousands of products. Track 1,000 SKUs without losing the plot."
        >
          <TagsMockup />
        </FeatureRow>
      </section>

      {/* MID-PAGE CTA */}
      <section className="mx-auto max-w-4xl px-6 py-20 border-t border-neutral-800/60">
        <div className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-[#141414] to-[#0a0a0a] p-10 md:p-14 text-center">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Stop checking competitor prices manually.
          </h2>
          <p className="mt-3 text-neutral-400">
            Setting up takes one minute. The first crawl runs while you read
            this page.
          </p>
          <div className="mt-8">
            <Link
              href="/signup?source=mid-cta"
              className="inline-block rounded-md bg-signal px-6 py-3.5 text-sm font-medium text-white hover:bg-red-600"
            >
              Try for free →
            </Link>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section
        id="pricing"
        className="mx-auto max-w-6xl px-6 py-24 border-t border-neutral-800/60"
      >
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-[11px] uppercase tracking-[0.15em] text-signal font-mono">
            Pricing
          </span>
          <h2 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight">
            One price. No seat fees.
          </h2>
          <p className="mt-4 text-neutral-400">
            Pick a plan by how many competitor products you want to track and
            how often. Upgrade or downgrade any time.
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
        <div className="mt-8 text-center text-sm text-neutral-400">
          Tracking 500+ products?{" "}
          <a
            href="mailto:support@rivlr.app?subject=Rivlr%20Custom%20plan"
            className="underline underline-offset-4 hover:text-paper"
          >
            Talk to us about Custom →
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-24 border-t border-neutral-800/60">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-center">
          Common questions
        </h2>
        <div className="mt-12 space-y-3">
          <Faq q="Is this only for Shopify stores?">
            For now, yes. We crawl public Shopify product endpoints —
            something like 30% of DTC ecommerce — and we&apos;ve focused on
            doing one platform brilliantly first. WooCommerce and
            BigCommerce are on the roadmap.
          </Faq>
          <Faq q="Is what you do legal?">
            Yes. We retrieve publicly accessible product information that
            Shopify themes, apps, and embeds use every day. We respect rate
            limits and identify ourselves with a polite User-Agent. Store
            owners can request we stop tracking by emailing support and we
            comply within 10 working days.
          </Faq>
          <Faq q="How fresh is the data?">
            Depends on your plan: daily, every 6h, or hourly. Plus any
            individual product can be force-refreshed on demand from its
            detail page if you spot something interesting.
          </Faq>
          <Faq q="What about email overload?">
            You opt-in alerts per product, per type (stock change vs price
            drop), and we deduplicate within 24 hours so you won&apos;t get
            three alerts for the same drop. Most users end up with a quiet
            inbox and one or two genuinely useful pings a day.
          </Faq>
          <Faq q="Can my team use it?">
            Multi-user accounts are coming in the next release. Sign up to
            the waitlist and you&apos;ll get early access plus invitation
            tokens for teammates when launched.
          </Faq>
          <Faq q="Where&apos;s my data stored?">
            UK / EU. Postgres on Neon (London region), app on Vercel,
            transactional emails via Resend. Full sub-processor list is on
            our{" "}
            <Link href="/legal/privacy" className="underline">
              privacy page
            </Link>
            .
          </Faq>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-4xl px-6 py-24 border-t border-neutral-800/60 text-center">
        <h2 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[0.98]">
          Watch the{" "}
          <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
            rivals
          </span>
          .
        </h2>
        <p className="mt-6 text-lg text-neutral-400 max-w-xl mx-auto">
          Free up to 5 products. Set up in a minute. Real-time competitor
          intel from the moment you sign in.
        </p>
        <div className="mt-10">
          <Link
            href="/signup?source=footer-cta"
            className="inline-block rounded-md bg-signal px-7 py-4 text-base font-medium text-white hover:bg-red-600"
          >
            Try for free →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-neutral-800/60">
        <div className="mx-auto max-w-6xl px-6 py-12 flex flex-wrap items-start justify-between gap-8">
          <div>
            <Wordmark />
            <p className="mt-3 text-xs text-neutral-500 font-mono">
              A Webgro Ltd product
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-12 gap-y-3 text-sm">
            <Link href="#demo" className="text-neutral-400 hover:text-paper">
              Live demo
            </Link>
            <Link
              href="#pricing"
              className="text-neutral-400 hover:text-paper"
            >
              Pricing
            </Link>
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
              href="mailto:support@rivlr.app"
              className="text-neutral-400 hover:text-paper col-span-2 sm:col-span-1"
            >
              support@rivlr.app
            </a>
          </div>
        </div>
        <div className="border-t border-neutral-800/60">
          <div className="mx-auto max-w-6xl px-6 py-5 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500 font-mono">
            <span>© 2026 Webgro Ltd · England &amp; Wales</span>
            <span>Made with care, in London.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Section building blocks
// ────────────────────────────────────────────────────────────────────────

function Usp({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#141414] p-6">
      <div className="text-[11px] uppercase tracking-wider text-signal font-mono">
        {eyebrow}
      </div>
      <div className="mt-3 text-lg font-semibold tracking-tight">{title}</div>
      <p className="mt-2 text-sm text-neutral-400 leading-relaxed">{body}</p>
    </div>
  );
}

function FeatureRow({
  eyebrow,
  title,
  body,
  children,
  reverse,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div
      className={`grid gap-12 items-center py-12 md:py-16 lg:grid-cols-2 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}
    >
      <div>
        <span className="text-[11px] uppercase tracking-[0.15em] text-signal font-mono">
          {eyebrow}
        </span>
        <h3 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
          {title}
        </h3>
        <p className="mt-4 text-neutral-400 leading-relaxed">{body}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-neutral-800 bg-[#141414]">
      <summary className="cursor-pointer list-none flex items-center justify-between px-5 py-4 select-none">
        <span className="font-medium">{q}</span>
        <span className="text-neutral-500 group-open:rotate-90 transition-transform">
          ›
        </span>
      </summary>
      <div className="px-5 pb-4 text-sm text-neutral-400 leading-relaxed">
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
      className={`rounded-2xl border p-6 flex flex-col ${
        highlight
          ? "border-signal bg-signal/5 shadow-[0_0_0_4px_rgba(255,59,48,0.05)]"
          : "border-neutral-800 bg-[#141414]"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">{name}</div>
        {highlight && (
          <span className="rounded-full bg-signal/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-signal font-mono">
            Most popular
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-4xl font-semibold tracking-tight">{price}</span>
        {price !== "£0" && (
          <span className="text-sm text-neutral-500">/mo</span>
        )}
      </div>
      <div className="mt-1 text-xs text-neutral-500 font-mono">
        {seats} products · {cadence}
      </div>
      <ul className="mt-6 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="text-signal flex-shrink-0">✓</span>
            <span className="text-neutral-300">{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 pt-6 border-t border-neutral-800/50">
        <Link
          href={href}
          className={`block w-full rounded-md py-2.5 text-center text-sm font-medium ${
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

// ────────────────────────────────────────────────────────────────────────
// Inline mockups (HTML/CSS replicas of real Rivlr UI for credibility)
// ────────────────────────────────────────────────────────────────────────

function DashboardMockup() {
  const rows = [
    {
      title: "Linen Overshirt — Sand",
      store: "verdantcloth.myshopify.com",
      price: "£89.00",
      stock: { type: "in" as const, label: "In stock · 47" },
      delta: { v: -4, fmt: "−£4.00", color: "text-green-500" },
    },
    {
      title: "Aero Trainer 02 — Bone",
      store: "runfast.myshopify.com",
      price: "£124.00",
      stock: { type: "out" as const, label: "Out of stock · 4d" },
      delta: { v: 10, fmt: "+£10.00", color: "text-signal" },
    },
    {
      title: "Field Tote — Olive Canvas",
      store: "terrabag.myshopify.com",
      price: "£64.00",
      stock: { type: "low" as const, label: "Low · 6 left" },
      delta: { v: 0, fmt: "—", color: "text-neutral-500" },
    },
    {
      title: "Matcha Daily Whisk — Bamboo",
      store: "kettlerituals.myshopify.com",
      price: "£18.50",
      stock: { type: "in" as const, label: "In stock · 312" },
      delta: { v: 0, fmt: "—", color: "text-neutral-500" },
    },
    {
      title: "Sleep Mask — Charcoal Silk",
      store: "nocturnegoods.myshopify.com",
      price: "£42.00",
      stock: { type: "in" as const, label: "In stock · 18" },
      delta: { v: -3, fmt: "−£3.00", color: "text-green-500" },
    },
  ];

  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#0a0a0a] overflow-hidden shadow-2xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800 bg-[#141414]">
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />
        <span className="ml-3 text-xs text-neutral-500 font-mono">
          rivlr.app/dashboard
        </span>
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
              <div className="truncate font-medium text-paper">
                {r.title}
              </div>
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
          <div className={`text-right font-mono ${r.delta.color}`}>
            {r.delta.fmt}
          </div>
        </div>
      ))}
    </div>
  );
}

function CompareMockup() {
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#0a0a0a] p-5 shadow-xl">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
        Compare 3 products · last 30 days
      </div>
      <svg viewBox="0 0 400 180" className="mt-4 w-full">
        <defs>
          <linearGradient id="grid" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(127,127,127,0.18)" />
            <stop offset="100%" stopColor="rgba(127,127,127,0.0)" />
          </linearGradient>
        </defs>
        {/* grid lines */}
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
        {/* signal red line */}
        <polyline
          fill="none"
          stroke="#FF3B30"
          strokeWidth="2"
          points="20,80 60,72 100,68 140,75 180,52 220,48 260,40 300,38 340,30 380,28"
        />
        {/* blue line */}
        <polyline
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          points="20,100 60,98 100,96 140,90 180,92 220,88 260,80 300,78 340,72 380,70"
        />
        {/* green line */}
        <polyline
          fill="none"
          stroke="#22c55e"
          strokeWidth="2"
          points="20,140 60,138 100,135 140,132 180,128 220,118 260,108 300,98 340,90 380,86"
        />
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
    {
      title: "Premium Dog Food 5kg",
      store: "petworld.co.uk",
      price: "£32.99",
      stock: "in",
    },
    {
      title: "Premium Dog Food 5kg",
      store: "kennelclub.shop",
      price: "£28.50",
      stock: "in",
    },
    {
      title: "Premium Dog Food 5kg",
      store: "doglife.shop",
      price: "£35.00",
      stock: "out",
    },
  ];
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#0a0a0a] p-5 shadow-xl">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
        Linked products · 3 stores
      </div>
      <div className="mt-3 space-y-2">
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
              <div className="truncate text-[11px] text-neutral-500 font-mono">
                {it.store}
              </div>
            </div>
            <div className="text-right text-sm flex-shrink-0">
              <div className="font-mono text-paper">{it.price}</div>
              <div
                className={`text-[10px] inline-flex items-center gap-1 ${it.stock === "in" ? "text-green-500" : "text-signal"}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${it.stock === "in" ? "bg-green-500" : "bg-signal"}`}
                />
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
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
        Filter by tag
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
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
            <div className="text-[9px] text-neutral-500 font-mono truncate">
              product
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
