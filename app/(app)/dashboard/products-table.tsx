"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, useMemo } from "react";
import {
  bulkPause,
  bulkResume,
  bulkDelete,
  bulkSetStockNotify,
  bulkSetPriceDropNotify,
  bulkAddTags,
  bulkRemoveTag,
} from "../products/actions";

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
}

export function ProductsTable({
  rows,
  showSold,
}: {
  rows: DashboardRow[];
  showSold: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [tagInput, setTagInput] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && selected.size < rows.length;

  function toggleAll() {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
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

  function handleAddTags() {
    const tag = tagInput.trim();
    if (!tag) return;
    run("Tags added", () => bulkAddTags(ids, tag));
    setTagInput("");
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-signal/40 bg-neutral-900 px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <span className="text-neutral-700">·</span>

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

          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="add tag…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddTags();
              }
            }}
            className="h-7 w-32 rounded border border-neutral-700 bg-ink px-2 text-xs text-paper outline-none focus:border-neutral-500"
          />
          <BulkBtn disabled={pending || !tagInput.trim()} onClick={handleAddTags}>
            Add tag
          </BulkBtn>

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
            aria-label="Select all"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
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
                      <Link
                        key={t}
                        href={`/dashboard?tag=${encodeURIComponent(t)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-neutral-300 font-mono hover:bg-neutral-700"
                      >
                        #{t}
                      </Link>
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
          ? "border-red-900 bg-red-950/40 text-red-300 hover:border-red-700"
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
