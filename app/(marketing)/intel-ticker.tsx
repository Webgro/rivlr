import { headers } from "next/headers";

interface FeedItem {
  title: string;
  storeDomain: string;
  currency: string;
  kind: "price_drop" | "price_rise" | "stock_in" | "stock_out";
  observedAt: string;
  prevPrice: string | null;
  newPrice: string | null;
}

/**
 * Live intel ticker — horizontal marquee of REAL recent competitor moves
 * pulled from the user's own tracked products via /api/public/intel-feed.
 * Cached at the edge for 60s, so it feels alive without hammering Postgres.
 *
 * When the feed is empty (e.g. fresh account, no observations yet) we
 * hide the ticker entirely rather than showing fake data.
 */
export async function IntelTicker() {
  // Server-fetch the public feed. We need an absolute URL on the server, so
  // resolve it from request headers.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "rivlr.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const url = `${proto}://${host}/api/public/intel-feed`;

  let items: FeedItem[] = [];
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (res.ok) {
      const data = (await res.json()) as { items: FeedItem[] };
      items = data.items;
    }
  } catch {
    // Fall through to empty.
  }

  if (items.length === 0) return null;

  // Repeat to make the marquee loop seamlessly. We need at least 6-8 to
  // make the scroll feel populated.
  const minLength = 8;
  while (items.length < minLength) items = items.concat(items);
  const repeated = [...items, ...items];

  return (
    <div className="relative border-y border-neutral-800/80 bg-[#0a0a0a]/60 backdrop-blur overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10 pointer-events-none" />

      {/* Live indicator on the left edge */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 hidden md:flex items-center gap-2 rounded border border-neutral-800 bg-[#0d0d0d] px-2.5 py-1 text-[9px] uppercase tracking-[0.2em] font-mono text-neutral-500">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-signal opacity-75 animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal" />
        </span>
        Live
      </div>

      <div className="ticker-track flex items-center py-3 whitespace-nowrap md:pl-24">
        {repeated.map((e, i) => (
          <span key={i} className="inline-flex items-center">
            {/* Item separator dot — sits between items */}
            {i > 0 && (
              <span className="mx-6 inline-flex items-center gap-1.5 select-none" aria-hidden>
                <span className="h-px w-3 bg-neutral-800" />
                <span className="h-1 w-1 rounded-full bg-signal/60" />
                <span className="h-px w-3 bg-neutral-800" />
              </span>
            )}
            <Item item={e} />
          </span>
        ))}
      </div>
      <style>{`
        .ticker-track {
          animation: ticker-scroll 90s linear infinite;
          width: max-content;
        }
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ticker-track {
            animation-duration: 360s;
          }
        }
      `}</style>
    </div>
  );
}

function Item({ item }: { item: FeedItem }) {
  const symbol = currencySymbol(item.currency);
  return (
    <span className="inline-flex items-center gap-2.5 text-xs font-mono text-neutral-400">
      <Badge kind={item.kind} />
      <span className="text-neutral-500">{item.storeDomain}</span>
      <span className="text-neutral-700">›</span>
      <span className="text-paper truncate max-w-[260px]">{item.title}</span>
      {item.kind === "price_drop" || item.kind === "price_rise" ? (
        item.prevPrice && item.newPrice ? (
          <>
            <span className="text-neutral-700">·</span>
            <span className="line-through text-neutral-600">
              {symbol}
              {Number(item.prevPrice).toFixed(2)}
            </span>
            <span
              className={
                item.kind === "price_drop" ? "text-green-500" : "text-signal"
              }
            >
              {symbol}
              {Number(item.newPrice).toFixed(2)}
            </span>
          </>
        ) : null
      ) : (
        <>
          <span className="text-neutral-700">·</span>
          <span
            className={item.kind === "stock_in" ? "text-green-500" : "text-signal"}
          >
            {item.kind === "stock_in" ? "back in stock" : "out of stock"}
          </span>
        </>
      )}
      <span className="text-neutral-700">·</span>
      <span className="text-neutral-600">{relativeTime(item.observedAt)}</span>
    </span>
  );
}

function Badge({ kind }: { kind: FeedItem["kind"] }) {
  const config = {
    price_drop: {
      label: "PRICE ↓",
      color: "text-green-500",
      border: "border-green-500/30",
    },
    price_rise: {
      label: "PRICE ↑",
      color: "text-signal",
      border: "border-signal/30",
    },
    stock_in: {
      label: "RESTOCK",
      color: "text-green-500",
      border: "border-green-500/30",
    },
    stock_out: {
      label: "OOS",
      color: "text-signal",
      border: "border-signal/30",
    },
  }[kind];

  return (
    <span
      className={`px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] border ${config.color} ${config.border} bg-[#0a0a0a]`}
    >
      {config.label}
    </span>
  );
}

function currencySymbol(c: string) {
  switch (c) {
    case "GBP":
      return "£";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    default:
      return c + " ";
  }
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
