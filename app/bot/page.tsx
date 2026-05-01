import Link from "next/link";

export const metadata = {
  title: "RivlrBot — public info",
  description:
    "What RivlrBot does, what data it reads, and how merchants can opt out of being tracked.",
};

/**
 * Public-facing info page that the User-Agent string points to:
 *   "Mozilla/5.0 (compatible; RivlrBot/1.0; +https://rivlr.app/bot)"
 *
 * Lives outside the (app) auth gate so anyone — including merchants who
 * spot the User-Agent in their server logs — can read it without
 * needing an account.
 */
export default function BotInfoPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-paper" data-theme="dark">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 font-mono">
          Bot info · v1.0
        </div>
        <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
          RivlrBot
        </h1>
        <p className="mt-4 text-neutral-400 leading-relaxed">
          RivlrBot is the polite User-Agent for{" "}
          <Link
            href="/"
            className="text-paper underline-offset-4 hover:underline"
          >
            Rivlr
          </Link>
          , a competitive-intelligence tool for Shopify operators. If you saw{" "}
          <code className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono text-xs">
            RivlrBot/1.0
          </code>{" "}
          in your server logs, this page explains what we do and how to ask
          us to stop.
        </p>

        <Section title="What we read">
          <ul className="space-y-2 text-sm text-neutral-300 leading-relaxed">
            <li>
              · <strong>Public product endpoints</strong> like{" "}
              <code className="font-mono text-xs text-neutral-400">/products/&#123;handle&#125;.js</code>{" "}
              and <code className="font-mono text-xs text-neutral-400">/products.json</code> for
              price, availability, variants, images, vendor, tags.
            </li>
            <li>
              · <strong>Storefront HTML</strong> on product detail pages for
              JSON-LD (GTIN/MPN/brand, review counts) and on the homepage
              for app-stack fingerprinting (Klaviyo, Loox, etc.).
            </li>
            <li>
              · <strong>Atom feeds</strong> at{" "}
              <code className="font-mono text-xs text-neutral-400">/products.atom</code>{" "}
              for new-product discovery.
            </li>
            <li>
              · <strong>Collection JSON</strong> at{" "}
              <code className="font-mono text-xs text-neutral-400">/collections/all/products.json</code>{" "}
              and best-sellers paths for catalogue size and best-seller
              membership.
            </li>
            <li>
              · <strong>Cart-add inventory probe</strong> at{" "}
              <code className="font-mono text-xs text-neutral-400">/cart/add.js</code>{" "}
              with a single high-quantity request per product per day. We
              never complete a checkout — a 422 response with the remaining
              stock count is exactly what we want, and that's where the
              request stops. Disabled per-store on first 403/429 with a
              7-day backoff.
            </li>
          </ul>
        </Section>

        <Section title="What we don't read">
          <ul className="space-y-2 text-sm text-neutral-300 leading-relaxed">
            <li>· Anything behind authentication.</li>
            <li>· Customer data — we don't have any.</li>
            <li>
              · Order data, cost prices, internal SKUs, or anything from your
              admin. The public storefront API doesn't expose those and we
              don't try to access them.
            </li>
            <li>· Files outside the standard storefront paths above.</li>
          </ul>
        </Section>

        <Section title="How politely">
          <ul className="space-y-2 text-sm text-neutral-300 leading-relaxed">
            <li>· Single concurrent connection per store; minimum 1s between requests on the same store.</li>
            <li>· Inventory probes are at most once per product per day, with a 5s gap between products and 1.5s gap between variants of the same product.</li>
            <li>· We respect <code className="font-mono text-xs text-neutral-400">robots.txt</code> for paths it explicitly disallows for our user-agent.</li>
            <li>· Daily catalogue scans happen during off-peak hours (05:00 UTC).</li>
          </ul>
        </Section>

        <Section title="How to opt out">
          <p className="text-sm text-neutral-300 leading-relaxed">
            Email{" "}
            <a
              href="mailto:support@rivlr.app?subject=Opt%20out%20RivlrBot"
              className="text-paper underline-offset-4 hover:underline"
            >
              support@rivlr.app
            </a>{" "}
            with the domain you'd like us to stop tracking. We comply within
            10 working days. If you'd prefer to block at the network layer
            instead, RivlrBot identifies via the User-Agent string{" "}
            <code className="rounded bg-neutral-900 px-1.5 py-0.5 font-mono text-xs">
              Mozilla/5.0 (compatible; RivlrBot/1.0; +https://rivlr.app/bot)
            </code>{" "}
            — block that and we'll stop reaching you, no questions asked.
          </p>
        </Section>

        <Section title="Why this is okay">
          <p className="text-sm text-neutral-300 leading-relaxed">
            All endpoints we read are publicly accessible to any visitor of
            your storefront — they're the same endpoints your theme, your
            apps, and your shoppers' browsers hit thousands of times a day.
            We don't bypass any access controls and we don't claim to be a
            human. Most competitive-intelligence tools (price-monitoring
            services, market researchers, comparison sites) read this same
            data; we identify ourselves clearly so you know it's us.
          </p>
        </Section>

        <div className="mt-16 pt-8 border-t border-neutral-800 text-xs text-neutral-500 font-mono">
          A Webgro Ltd product · made in London ·{" "}
          <Link href="/legal/privacy" className="hover:text-paper">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link href="/legal/terms" className="hover:text-paper">
            Terms
          </Link>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xs uppercase tracking-[0.2em] text-neutral-500 font-mono mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}
