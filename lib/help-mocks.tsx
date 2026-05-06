/**
 * Inline UI mocks used inside help articles. Each mock recreates the
 * shape of a real app surface in plain Tailwind so screenshots stay
 * in-sync with the actual product without binary asset uploads.
 *
 * Visual rules:
 *  - Chrome: rounded outer panel with window dots so it reads as
 *    "this is a screenshot" at a glance.
 *  - Use the app's real theme tokens (border-default, bg-elevated,
 *    text-muted, signal) so mocks track theme-toggle in real time.
 *  - Don't try to be 1:1 with production — be representative. The
 *    point is teaching the layout, not pixel parity.
 */

import { type ReactNode } from "react";

function MockChrome({
  caption,
  children,
}: {
  caption?: string;
  children: ReactNode;
}) {
  return (
    <figure className="my-6 not-prose">
      <div className="rounded-xl border border-default bg-elevated overflow-hidden shadow-sm">
        <div className="border-b border-default bg-surface px-4 py-2 flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-default border border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-default border border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-default border border-strong" />
          {caption && (
            <span className="ml-3 text-[11px] text-muted/80 font-mono uppercase tracking-[0.15em]">
              {caption}
            </span>
          )}
        </div>
        <div className="p-5">{children}</div>
      </div>
    </figure>
  );
}

/** Panel header used to label "fake page sections" inside mocks. */
function PanelHeader({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-semibold tracking-tight text-foreground">
      {children}
    </div>
  );
}

/* ─── 1. Add product flow ─────────────────────────────────────────── */

export function MockAddProduct() {
  return (
    <MockChrome caption="/products/new">
      <PanelHeader>Add products</PanelHeader>
      <p className="mt-1 text-xs text-muted">
        Paste one or many Shopify product or collection URLs.
      </p>
      <div className="mt-4 rounded-md border border-default bg-surface p-3 font-mono text-sm">
        <span className="text-foreground">https://gymshark.com/products/legacy-tee</span>
        <span className="ml-1 inline-block w-px h-4 bg-foreground align-middle animate-pulse" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-[11px] text-muted font-mono">
          1 URL · 1 store
        </span>
        <button
          type="button"
          className="rounded-md bg-signal px-4 py-1.5 text-sm font-medium text-white pointer-events-none"
        >
          Track product →
        </button>
      </div>
    </MockChrome>
  );
}

/* ─── 2. Multiple URLs paste ──────────────────────────────────────── */

export function MockMultipleUrls() {
  return (
    <MockChrome caption="/products/new — bulk paste">
      <PanelHeader>Add products</PanelHeader>
      <div className="mt-3 rounded-md border border-default bg-surface p-3 font-mono text-xs leading-relaxed text-foreground space-y-1">
        <div>https://gymshark.com/products/legacy-tee</div>
        <div>https://gymshark.com/products/vital-leggings</div>
        <div>https://allbirds.com/products/wool-runners</div>
        <div>https://lululemon.co.uk/products/align-pant</div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-[11px] text-muted font-mono">
          4 URLs · 3 stores
        </span>
        <button
          type="button"
          className="rounded-md bg-signal px-4 py-1.5 text-sm font-medium text-white pointer-events-none"
        >
          Track 4 products →
        </button>
      </div>
    </MockChrome>
  );
}

/* ─── 3. Mixed paste with collection URLs ─────────────────────────── */

export function MockMixedCollection() {
  return (
    <MockChrome caption="/products/new — products + collection">
      <PanelHeader>Add products</PanelHeader>
      <div className="mt-3 rounded-md border border-default bg-surface p-3 font-mono text-xs leading-relaxed space-y-1">
        <div className="text-foreground">https://gymshark.com/products/legacy-tee</div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-signal/15 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-signal font-mono">
            collection
          </span>
          <span className="text-foreground">
            https://allbirds.com/collections/mens-shoes
          </span>
        </div>
        <div className="text-foreground">https://lululemon.co.uk/products/align-pant</div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-[11px] text-muted font-mono">
          2 products + 1 collection (~24 expanded)
        </span>
        <button
          type="button"
          className="rounded-md bg-signal px-4 py-1.5 text-sm font-medium text-white pointer-events-none"
        >
          Track 26 products →
        </button>
      </div>
    </MockChrome>
  );
}

/* ─── 4. CSV upload button ────────────────────────────────────────── */

export function MockCsvUpload() {
  return (
    <MockChrome caption="/products/new — CSV upload">
      <div className="rounded-lg border-2 border-dashed border-default bg-surface px-6 py-10 text-center">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mx-auto text-muted"
        >
          <path d="M14 2 H6 a2 2 0 0 0 -2 2 v16 a2 2 0 0 0 2 2 h12 a2 2 0 0 0 2 -2 V8 z" />
          <path d="M14 2 v6 h6" />
          <path d="M12 18 v-6 M9 15 l3 -3 l3 3" />
        </svg>
        <div className="mt-3 text-sm font-medium">
          Drop a CSV here or click to upload
        </div>
        <div className="mt-1 text-xs text-muted">
          One URL per line · headers ignored · max 10,000 rows
        </div>
        <button
          type="button"
          className="mt-4 rounded-md border border-default bg-elevated px-4 py-1.5 text-sm font-medium text-foreground pointer-events-none"
        >
          Choose file
        </button>
      </div>
    </MockChrome>
  );
}

/* ─── 5. Dashboard insights and opportunities ─────────────────────── */

export function MockDashboardInsights() {
  return (
    <MockChrome caption="/dashboard">
      <PanelHeader>Last 24 hours</PanelHeader>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Price drops" value="14" tone="green" />
        <Stat label="Price rises" value="3" />
        <Stat label="New stockouts" value="2" tone="signal" />
        <Stat label="Restocks" value="7" />
      </div>

      <div className="mt-5 rounded-md border border-signal/30 bg-signal/[0.04] p-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-signal font-mono">
          Opportunity
        </div>
        <div className="mt-1 text-sm font-medium">
          Allbirds Wool Runners — 2 days cover, low stock
        </div>
        <div className="mt-0.5 text-xs text-muted">
          Selling ~14/day · 28 units left · likely OOS by Friday
        </div>
      </div>
    </MockChrome>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "signal";
}) {
  const valueClass =
    tone === "green"
      ? "text-green-500"
      : tone === "signal"
        ? "text-signal"
        : "text-foreground";
  return (
    <div className="rounded-md border border-default bg-surface p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted/70 font-mono">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tracking-tight ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

/* ─── 6. Tags management page ─────────────────────────────────────── */

export function MockTagsPage() {
  const tags: Array<{ name: string; color: string; count: number }> = [
    { name: "premium", color: "bg-purple-500/15 text-purple-400", count: 12 },
    { name: "loss-leader", color: "bg-amber-500/15 text-amber-500", count: 4 },
    { name: "new-season", color: "bg-green-500/15 text-green-400", count: 22 },
    { name: "outlet", color: "bg-blue-500/15 text-blue-400", count: 8 },
    { name: "core-range", color: "bg-default text-muted-strong", count: 31 },
  ];
  return (
    <MockChrome caption="/tags">
      <PanelHeader>Tags</PanelHeader>
      <ul className="mt-3 divide-y divide-default rounded-md border border-default overflow-hidden">
        {tags.map((t) => (
          <li
            key={t.name}
            className="flex items-center justify-between px-3 py-2.5 bg-surface"
          >
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-mono ${t.color}`}
              >
                {t.name}
              </span>
              <span className="text-xs text-muted">{t.count} products</span>
            </div>
            <span className="text-xs text-muted">···</span>
          </li>
        ))}
      </ul>
    </MockChrome>
  );
}

/* ─── 7. Link product modal ───────────────────────────────────────── */

export function MockLinkModal() {
  return (
    <MockChrome caption="Link suggestion">
      <PanelHeader>Link these products?</PanelHeader>
      <p className="mt-1 text-xs text-muted">
        Same item across two stores. Match score 94%.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <ProductMini
          title="Wool Runners — Mizzles"
          store="allbirds.com"
          price="£105"
        />
        <ProductMini
          title="Wool Runner Mizzles"
          store="allbirds.co.uk"
          price="£105"
        />
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          className="rounded-md border border-default bg-surface px-3.5 py-1.5 text-xs font-medium text-muted pointer-events-none"
        >
          Dismiss
        </button>
        <button
          type="button"
          className="rounded-md bg-foreground px-4 py-1.5 text-xs font-medium text-surface pointer-events-none"
        >
          Link
        </button>
      </div>
    </MockChrome>
  );
}

function ProductMini({
  title,
  store,
  price,
}: {
  title: string;
  store: string;
  price: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-default bg-surface p-2.5 min-w-0">
      <div className="h-10 w-10 rounded bg-elevated flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{title}</div>
        <div className="truncate text-[10px] text-muted font-mono">{store}</div>
      </div>
      <div className="text-xs font-mono">{price}</div>
    </div>
  );
}

/* ─── 8. Notification emails ──────────────────────────────────────── */

export function MockNotificationEmails() {
  return (
    <MockChrome caption="/settings#alerts">
      <PanelHeader>Notification emails</PanelHeader>
      <p className="mt-1 text-xs text-muted leading-relaxed">
        Where to send price-drop and stock-change alerts. Comma-separated.
      </p>
      <div className="mt-3 rounded-md border border-default bg-surface p-3 font-mono text-sm leading-relaxed text-foreground">
        you@example.com, partner@example.com
      </div>
      <div className="mt-3 flex items-center gap-2 justify-end">
        <button
          type="button"
          className="rounded-md border border-default bg-surface px-3 py-1.5 text-xs text-foreground pointer-events-none"
        >
          Send test
        </button>
        <button
          type="button"
          className="rounded-md bg-foreground px-4 py-1.5 text-xs font-medium text-surface pointer-events-none"
        >
          Save
        </button>
      </div>
    </MockChrome>
  );
}

/* ─── 9. Notes editor ─────────────────────────────────────────────── */

export function MockNotesEditor() {
  return (
    <MockChrome caption="/products/[id] — Notes">
      <PanelHeader>Notes</PanelHeader>
      <div className="mt-3 rounded-md border border-default bg-surface p-3 font-mono text-xs leading-relaxed text-foreground whitespace-pre-line">
        {`Their hero on the homepage Mar 12.
Sold out twice in Feb — restock cycle ~3 weeks.
PDP changed copy on 04 Mar — was "premium leather", now just "leather".`}
      </div>
      <div className="mt-2 text-[10px] text-muted font-mono">
        Auto-saved · 18 minutes ago
      </div>
    </MockChrome>
  );
}

/* ─── 10. Compare chart ───────────────────────────────────────────── */

export function MockCompareChart() {
  // Static SVG with three lines — visual only, no real data binding.
  return (
    <MockChrome caption="/products/compare">
      <PanelHeader>3 products · 30 days</PanelHeader>
      <div className="mt-4 rounded-md border border-default bg-surface p-4">
        <svg
          viewBox="0 0 400 140"
          className="w-full h-auto"
          aria-hidden
          preserveAspectRatio="none"
        >
          {/* gridlines */}
          <line x1="0" y1="35" x2="400" y2="35" stroke="currentColor" className="text-muted/30" strokeWidth="0.5" strokeDasharray="2 4" />
          <line x1="0" y1="70" x2="400" y2="70" stroke="currentColor" className="text-muted/30" strokeWidth="0.5" strokeDasharray="2 4" />
          <line x1="0" y1="105" x2="400" y2="105" stroke="currentColor" className="text-muted/30" strokeWidth="0.5" strokeDasharray="2 4" />
          {/* lines */}
          <polyline
            fill="none"
            stroke="#FF3B30"
            strokeWidth="2"
            points="0,40 50,42 100,38 150,55 200,50 250,72 300,68 350,85 400,82"
          />
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            points="0,70 50,68 100,75 150,72 200,68 250,55 300,58 350,50 400,52"
          />
          <polyline
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
            points="0,95 50,92 100,98 150,95 200,90 250,88 300,80 350,78 400,75"
          />
        </svg>
      </div>
      <div className="mt-3 flex items-center gap-4 flex-wrap text-[11px] font-mono">
        <Legend colour="#FF3B30" label="Allbirds Wool Runners" />
        <Legend colour="#3b82f6" label="Lululemon Align Pant" />
        <Legend colour="#22c55e" label="Gymshark Legacy Tee" />
      </div>
    </MockChrome>
  );
}

function Legend({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-3 rounded-sm"
        style={{ backgroundColor: colour }}
      />
      <span className="text-muted">{label}</span>
    </span>
  );
}

/* ─── 11. Auto-paused product ─────────────────────────────────────── */

export function MockAutoPaused() {
  return (
    <MockChrome caption="/products — auto-paused row">
      <PanelHeader>Tracked products</PanelHeader>
      <ul className="mt-3 divide-y divide-default rounded-md border border-default overflow-hidden">
        <li className="flex items-center gap-3 px-3 py-2.5 bg-surface">
          <div className="h-8 w-8 rounded bg-elevated flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">Legacy Tee</div>
            <div className="truncate text-[10px] text-muted font-mono">
              gymshark.com
            </div>
          </div>
          <div className="text-sm font-mono">£28.00</div>
        </li>
        <li className="flex items-center gap-3 px-3 py-2.5 bg-signal/[0.03]">
          <div className="h-8 w-8 rounded bg-elevated flex-shrink-0 opacity-50" />
          <div className="min-w-0 flex-1 opacity-70">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium line-through">
                Vintage Hoodie
              </span>
              <span className="rounded bg-signal/15 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-signal font-mono flex-shrink-0">
                auto-paused
              </span>
            </div>
            <div className="truncate text-[10px] text-muted font-mono">
              5 consecutive 404s — URL likely retired
            </div>
          </div>
          <button
            type="button"
            className="rounded-md border border-default bg-surface px-2.5 py-1 text-[11px] text-foreground pointer-events-none"
          >
            Resume
          </button>
        </li>
      </ul>
    </MockChrome>
  );
}
