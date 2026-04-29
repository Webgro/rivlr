"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, useMemo } from "react";
import {
  bulkPause,
  bulkResume,
  bulkDelete,
  bulkSetStockNotify,
  bulkSetPriceDropNotify,
  bulkAddTags,
} from "./actions";
import { TagChip } from "@/components/tag-chip";
import { type TagColor } from "@/lib/db";

export interface DashboardRow {
  id: string;
  url: string;
  handle: string;
  storeDomain: string;
  title: string | null;
  imageUrl: string | null;
  currency: string;
  active: boolean;
  notifyStockChanges: boolean;
  notifyPriceDrops: boolean;
  tags: string[];
  lastCrawledAt: string | null;
  latestPrice: { price: string; currency: string } | null;
  latestStock: { available: boolean; quantity: number | null } | null;
  priceChange24h: number | null;
  sold30d: number | null;
  oosDays: number | null;
}

export function ProductsTable({
  rows,
  showSold,
  tagColors,
  availableTags,
  totalCount,
}: {
  rows: DashboardRow[];
  showSold: boolean;
  tagColors: Record<string, TagColor>;
  availableTags: Array<{ name: string; color: TagColor }>;
  totalCount: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [selectedTag, setSelectedTag] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [expanding, setExpanding] = useState(false);

  // Page-level state — how many rows on this page are selected.
  const allOnPageSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someOnPageSelected =
    rows.some((r) => selected.has(r.id)) && !allOnPageSelected;
  // Once the user expands selection beyond the page, totalCount > rows.length
  // and selected.size > rows.length tells us we're in "all-pages" mode.
  const hasMorePages = totalCount > rows.length;
  const allMatchingSelected = selected.size === totalCount;
  const showExpandBanner =
    allOnPageSelected && hasMorePages && !allMatchingSelected;

  function toggleAll() {
    if (allOnPageSelected) {
      // Deselect just this page's rows.
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of rows) next.delete(r.id);
        return next;
      });
    } else {
      // Select all rows on this page (additive — doesn't clear other pages).
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of rows) next.add(r.id);
        return next;
      });
    }
  }

  async function expandToAllPages() {
    setExpanding(true);
    try {
      const params = new URLSearchParams();
      const q = searchParams.get("q");
      const store = searchParams.get("store");
      const tag = searchParams.get("tag");
      if (q) params.set("q", q);
      if (store) params.set("store", store);
      if (tag) params.set("tag", tag);
      const res = await fetch(`/api/dashboard/all-ids?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { ids: string[] };
      setSelected(new Set(data.ids));
    } catch (err) {
      setFeedback(
        `Couldn't expand selection: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setExpanding(false);
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const ids = useMemo(() => Array.from(selected), [selected]);

  function run<T>(label: string, fn: () => Promise<T>) {
    setFeedback(null);
    startTransition(async () => {
      const result = await fn();
      const r = result as { ok?: boolean; count?: number; error?: string };
      if (r.ok) {
        setFeedback(`✓ ${label} (${r.count ?? 0})`);
        setSelected(new Set());
        router.refresh();
      } else {
        setFeedback(`Error: ${r.error ?? "unknown"}`);
      }
    });
  }

  function handleAddTag() {
    if (!selectedTag) return;
    run("Tag added", () => bulkAddTags(ids, selectedTag));
    setSelectedTag("");
  }

  return (
    <div>
      {showExpandBanner && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-default bg-elevated px-4 py-2 text-sm">
          <span className="text-muted-strong">
            All {rows.length} on this page selected.
          </span>
          <button
            type="button"
            disabled={expanding}
            onClick={expandToAllPages}
            className="text-foreground underline underline-offset-2 hover:opacity-70 disabled:opacity-50 font-medium"
          >
            {expanding
              ? "Loading…"
              : `Select all ${totalCount} across all pages`}
          </button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky top-2 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-signal/40 bg-elevated px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium">
            {selected.size === totalCount && totalCount > rows.length
              ? `All ${totalCount} selected`
              : `${selected.size} selected`}
          </span>
          <span className="text-muted">·</span>

          <BulkBtn disabled={pending} onClick={() => run("Paused", () => bulkPause(ids))}>
            Pause
          </BulkBtn>
          <BulkBtn disabled={pending} onClick={() => run("Resumed", () => bulkResume(ids))}>
            Resume
          </BulkBtn>

          <Divider />

          <BulkBtn disabled={pending} onClick={() => run("Stock alerts on", () => bulkSetStockNotify(ids, true))}>
            Stock alerts: On
          </BulkBtn>
          <BulkBtn disabled={pending} onClick={() => run("Stock alerts off", () => bulkSetStockNotify(ids, false))}>
            Off
          </BulkBtn>

          <Divider />

          <BulkBtn disabled={pending} onClick={() => run("Price-drop alerts on", () => bulkSetPriceDropNotify(ids, true))}>
            Price-drop: On
          </BulkBtn>
          <BulkBtn disabled={pending} onClick={() => run("Price-drop alerts off", () => bulkSetPriceDropNotify(ids, false))}>
            Off
          </BulkBtn>

          <Divider />

          {availableTags.length === 0 ? (
            <span className="text-xs text-muted">
              No tags yet —{" "}
              <Link href="/tags" className="underline hover:text-foreground">
                create one
              </Link>
            </span>
          ) : (
            <>
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="h-7 rounded border border-default bg-surface px-2 text-xs text-foreground outline-none focus:border-strong"
              >
                <option value="">— pick tag —</option>
                {availableTags.map((t) => (
                  <option key={t.name} value={t.name}>
                    #{t.name}
                  </option>
                ))}
              </select>
              <BulkBtn
                disabled={pending || !selectedTag}
                onClick={handleAddTag}
              >
                Apply tag
              </BulkBtn>
            </>
          )}

          <div className="ml-auto flex items-center gap-2">
            {feedback && (
              <span className="text-xs text-neutral-400 font-mono">{feedback}</span>
            )}
            <BulkBtn
              disabled={pending}
              variant="danger"
              onClick={() => {
                if (
                  confirm(
                    `Delete ${selected.size} product${selected.size === 1 ? "" : "s"}? Their entire history will be removed.`,
                  )
                ) {
                  run("Deleted", () => bulkDelete(ids));
                }
              }}
            >
              Delete
            </BulkBtn>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-neutral-400 hover:text-paper"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-neutral-800">
        <div className="grid grid-cols-[28px_2.4fr_1fr_1.2fr_0.8fr_1fr_1fr] items-center gap-3 border-b border-neutral-800 bg-neutral-900 px-5 py-3 text-[11px] uppercase tracking-wider text-neutral-500 font-mono">
          <input
            type="checkbox"
            aria-label="Select all on this page"
            checked={allOnPageSelected}
            ref={(el) => {
              if (el) el.indeterminate = someOnPageSelected;
            }}
            onChange={toggleAll}
            className="accent-signal"
          />
          <div>Product</div>
          <div>Price</div>
          <div>Stock</div>
          <div className="text-right">{showSold ? "Sold 30d" : ""}</div>
          <div className="text-right">Δ 24h</div>
          <div className="text-right">Last crawled</div>
        </div>

        {rows.map((r) => {
          const isSelected = selected.has(r.id);
          return (
            <div
              key={r.id}
              className={`grid grid-cols-[28px_2.4fr_1fr_1.2fr_0.8fr_1fr_1fr] items-center gap-3 border-b border-neutral-800 px-5 py-4 text-sm last:border-b-0 transition ${
                isSelected
                  ? "bg-signal/5"
                  : "hover:bg-neutral-900/70"
              } ${r.active ? "" : "opacity-60"}`}
            >
              <input
                type="checkbox"
                aria-label={`Select ${r.title ?? r.handle}`}
                checked={isSelected}
                onChange={() => toggleOne(r.id)}
                className="accent-signal"
              />

              <Link href={`/products/${r.id}`} className="flex items-center gap-3 min-w-0 group">
                {r.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={r.imageUrl}
                    alt=""
                    className="h-10 w-10 rounded-md bg-neutral-800 object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-neutral-800 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium group-hover:underline underline-offset-2">
                    {r.title ?? r.handle}
                    {!r.active && (
                      <span className="ml-2 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400 font-mono align-middle">
                        paused
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-xs text-neutral-500 font-mono">
                      {r.storeDomain}
                    </span>
                    {(r.notifyStockChanges || r.notifyPriceDrops) && (
                      <span className="inline-flex items-center gap-1 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400 font-mono">
                        🔔
                        {r.notifyStockChanges && r.notifyPriceDrops
                          ? "stock + price"
                          : r.notifyStockChanges
                            ? "stock"
                            : "price"}
                      </span>
                    )}
                    {r.tags.map((t) => (
                      <TagChip
                        key={t}
                        name={t}
                        color={tagColors[t] ?? "gray"}
                        href={`/products?tag=${encodeURIComponent(t)}`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ))}
                  </div>
                </div>
              </Link>

              <div className="font-mono">
                {r.latestPrice
                  ? `${currencySymbol(r.latestPrice.currency)}${r.latestPrice.price}`
                  : "—"}
              </div>

              <div>
                {r.latestStock ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-2 text-sm">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${r.latestStock.available ? "bg-green-500" : "bg-signal"}`}
                      />
                      {r.latestStock.available
                        ? r.latestStock.quantity !== null
                          ? `${r.latestStock.quantity} in stock`
                          : "In stock"
                        : "Out of stock"}
                    </span>
                    {!r.latestStock.available &&
                      r.oosDays !== null &&
                      r.oosDays > 0 && (
                        <span className="text-[10px] font-mono text-muted ml-3.5">
                          for {r.oosDays}d
                        </span>
                      )}
                  </div>
                ) : (
                  "—"
                )}
              </div>

              <div className="text-right font-mono">
                {showSold ? (
                  r.sold30d !== null && r.sold30d > 0 ? (
                    <span className="text-foreground">{r.sold30d}</span>
                  ) : r.sold30d === 0 ? (
                    <span className="text-muted">0</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )
                ) : null}
              </div>

              <div className={`text-right font-mono ${deltaColor(r.priceChange24h)}`}>
                {r.priceChange24h === null
                  ? "—"
                  : r.priceChange24h === 0
                    ? "0"
                    : `${r.priceChange24h > 0 ? "+" : ""}${currencySymbol(r.currency)}${Math.abs(r.priceChange24h).toFixed(2)}`}
              </div>

              <div className="text-right text-xs text-neutral-500 font-mono">
                {r.lastCrawledAt ? formatRelative(new Date(r.lastCrawledAt)) : "pending"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BulkBtn({
  children,
  onClick,
  disabled,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
        variant === "danger"
          ? "border-signal/40 bg-signal/5 text-signal hover:border-signal hover:bg-signal/10"
          : "border-neutral-700 bg-neutral-800 text-paper hover:border-neutral-500"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="text-neutral-700">·</span>;
}

function currencySymbol(code: string) {
  switch (code) {
    case "GBP": return "£";
    case "USD": return "$";
    case "EUR": return "€";
    case "CAD": return "CA$";
    case "AUD": return "A$";
    default: return code + " ";
  }
}

function deltaColor(delta: number | null) {
  if (delta === null || delta === 0) return "text-neutral-500";
  return delta > 0 ? "text-signal" : "text-green-500";
}

function formatRelative(date: Date) {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
