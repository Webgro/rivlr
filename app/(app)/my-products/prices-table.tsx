"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { FavouriteStar } from "../products/favourite-star";
import { LinkProductButton } from "../products/[id]/link-product-button";
import { TagChip } from "@/components/tag-chip";
import { ConfirmDialog } from "@/components/confirm-action-button";
import { type TagColor } from "@/lib/db";
import { stopWatchingRivals, tagMyProducts } from "./actions";

export interface PriceRow {
  id: string;
  title: string | null;
  handle: string;
  imageUrl: string | null;
  currency: string;
  isFavourite: boolean;
  tags: string[];
  myPrice: number | null;
  available: boolean | null;
  quantity: number | null;
  /** Shops selling a rival version of this product. */
  rivalShops: string[];
  bestPrice: number | null;
  bestCurrency: string | null;
  bestShop: string | null;
}

const GRID =
  "grid grid-cols-[28px_28px_minmax(0,2.4fr)_1fr_1.2fr_0.8fr_0.8fr] gap-3";

export function PricesTable({
  rows,
  availableTags,
  tagColors,
  shopFilter,
}: {
  rows: PriceRow[];
  availableTags: Array<{ name: string; color: TagColor }>;
  tagColors: Record<string, TagColor>;
  /** The rival-shop filter currently on screen, if any. Bulk removal is
   *  scoped to it so the action only touches what the user can see. */
  shopFilter: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [chosenTag, setChosenTag] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = rows.some((r) => selected.has(r.id)) && !allSelected;

  const ids = useMemo(() => Array.from(selected), [selected]);

  /** How many rival listings the remove action would actually affect. */
  const rivalsAffected = useMemo(
    () =>
      rows
        .filter((r) => selected.has(r.id))
        .reduce(
          (n, r) =>
            n +
            (shopFilter
              ? r.rivalShops.filter((s) => s === shopFilter).length
              : r.rivalShops.length),
          0,
        ),
    [rows, selected, shopFilter],
  );

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) for (const r of rows) next.delete(r.id);
      else for (const r of rows) next.add(r.id);
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run(
    label: string,
    fn: () => Promise<{ ok: boolean; count?: number; error?: string }>,
  ) {
    setFeedback(null);
    startTransition(async () => {
      // try/catch so a thrown server-action error surfaces inline instead
      // of replacing the whole page with the route error boundary.
      try {
        const r = await fn();
        if (r.ok) {
          setFeedback(`✓ ${label} (${r.count ?? 0})`);
          setSelected(new Set());
        } else {
          setFeedback(`Something went wrong: ${r.error ?? "unknown"}`);
        }
      } catch (err) {
        setFeedback(
          `That did not finish. Refresh and try again with fewer rows. (${
            err instanceof Error ? err.message.slice(0, 80) : "unknown"
          })`,
        );
      }
      router.refresh();
    });
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-signal/40 bg-elevated px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <span className="text-muted">·</span>

          {availableTags.length === 0 ? (
            <span className="text-xs text-muted">
              No tags yet.{" "}
              <Link href="/tags" className="underline hover:text-foreground">
                Create one
              </Link>
            </span>
          ) : (
            <>
              <select
                value={chosenTag}
                onChange={(e) => setChosenTag(e.target.value)}
                className="h-7 rounded border border-default bg-surface px-2 text-xs text-foreground outline-none focus:border-strong"
              >
                <option value="">Choose a tag</option>
                {availableTags.map((t) => (
                  <option key={t.name} value={t.name}>
                    #{t.name}
                  </option>
                ))}
              </select>
              <BulkBtn
                disabled={pending || !chosenTag}
                onClick={() => {
                  const tag = chosenTag;
                  setChosenTag("");
                  run("Tag added", () => tagMyProducts(ids, tag));
                }}
              >
                Apply tag
              </BulkBtn>
            </>
          )}

          <div className="ml-auto flex items-center gap-2">
            {feedback && (
              <span className="text-xs text-muted font-mono">{feedback}</span>
            )}
            <BulkBtn
              variant="danger"
              disabled={pending || rivalsAffected === 0}
              onClick={() => setConfirmOpen(true)}
            >
              {rivalsAffected === 0
                ? "No rivals to remove"
                : `Stop watching ${rivalsAffected} rival ${
                    rivalsAffected === 1 ? "price" : "prices"
                  }`}
            </BulkBtn>
            <ConfirmDialog
              open={confirmOpen}
              onClose={() => setConfirmOpen(false)}
              onConfirm={() => {
                setConfirmOpen(false);
                run("Stopped watching", () =>
                  stopWatchingRivals(ids, shopFilter || undefined),
                );
              }}
              pending={pending}
              title={`Stop watching ${rivalsAffected} rival ${
                rivalsAffected === 1 ? "price" : "prices"
              }?`}
              description={
                <>
                  Rivlr will stop checking{" "}
                  {shopFilter ? (
                    <>
                      the <span className="font-mono">{shopFilter}</span>{" "}
                      version
                    </>
                  ) : (
                    "the rival versions"
                  )}{" "}
                  of the {selected.size} product
                  {selected.size === 1 ? "" : "s"} you picked, and their price
                  and stock history goes with them. Your own products stay
                  exactly as they are. This cannot be undone.
                </>
              }
              confirmLabel="Yes, stop watching"
              variant="danger"
            />
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-muted hover:text-foreground"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-default">
        <div
          className={`${GRID} border-b border-default bg-elevated px-5 py-3 text-[11px] font-medium text-muted`}
        >
          <input
            type="checkbox"
            aria-label="Select every product below"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={toggleAll}
            className="accent-signal"
          />
          <div></div>
          <div>Product</div>
          <div>My price</div>
          <div>Cheapest rival</div>
          <div className="text-right">Gap</div>
          <div className="text-right">Stock</div>
        </div>

        {rows.map((r) => {
          const isSelected = selected.has(r.id);
          const deltaPct =
            r.myPrice !== null && r.bestPrice !== null && r.bestPrice > 0
              ? Math.round(((r.myPrice - r.bestPrice) / r.bestPrice) * 100)
              : null;
          return (
            <div
              key={r.id}
              className={`${GRID} items-center border-b border-default px-5 py-4 last:border-b-0 transition ${
                isSelected ? "bg-signal/5" : "hover:bg-elevated"
              }`}
            >
              <input
                type="checkbox"
                aria-label={`Select ${r.title ?? r.handle}`}
                checked={isSelected}
                onChange={() => toggleOne(r.id)}
                className="accent-signal"
              />

              <FavouriteStar id={r.id} initial={r.isFavourite} />

              <Link
                href={`/products/${r.id}`}
                className="flex items-center gap-3 min-w-0 group"
              >
                {r.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={r.imageUrl}
                    alt=""
                    className="h-10 w-10 rounded-md bg-elevated object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-elevated flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium group-hover:text-signal transition">
                    {r.title ?? r.handle}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {r.rivalShops.length === 0 ? (
                      <span className="truncate text-[10px] text-muted/70 font-mono uppercase tracking-[0.15em]">
                        No rival yet
                      </span>
                    ) : (
                      <span className="truncate text-[10px] text-muted/70 font-mono uppercase tracking-[0.15em]">
                        {r.rivalShops.length} rival
                        {r.rivalShops.length === 1 ? "" : "s"}
                      </span>
                    )}
                    {r.tags.map((t) => (
                      <TagChip
                        key={t}
                        name={t}
                        color={tagColors[t] ?? "gray"}
                      />
                    ))}
                  </div>
                </div>
              </Link>

              <div className="font-mono text-sm">
                {r.myPrice !== null
                  ? `${currencySymbol(r.currency)}${r.myPrice.toFixed(2)}`
                  : "—"}
              </div>

              <div className="min-w-0">
                {r.bestPrice !== null ? (
                  <>
                    <div className="font-mono text-sm">
                      {currencySymbol(r.bestCurrency ?? r.currency)}
                      {r.bestPrice.toFixed(2)}
                    </div>
                    <div className="truncate text-[11px] text-muted font-mono">
                      {r.bestShop}
                    </div>
                  </>
                ) : (
                  <LinkProductButton
                    productId={r.id}
                    browseAllByDefault
                    modalTitle={`Match "${r.title ?? r.handle}" to a competitor`}
                    myPrice={r.myPrice}
                    myCurrency={r.currency}
                    triggerLabel="+ Match"
                    triggerClassName="rounded-md border border-signal/40 bg-signal/5 text-signal px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.15em] hover:bg-signal/10 transition"
                  />
                )}
              </div>

              <div className="text-right font-mono text-sm">
                {deltaPct === null ? (
                  <span className="text-muted">—</span>
                ) : deltaPct > 0 ? (
                  <span className="text-signal">+{deltaPct}%</span>
                ) : deltaPct < 0 ? (
                  <span className="text-green-500">{deltaPct}%</span>
                ) : (
                  <span className="text-muted">±0%</span>
                )}
              </div>

              <div className="text-right text-xs">
                {r.available === null ? (
                  <span className="text-muted">—</span>
                ) : r.available ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    {r.quantity !== null ? `${r.quantity}` : "In"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-signal">
                    <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                    Out
                  </span>
                )}
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
          : "border-default bg-surface text-foreground hover:border-strong"
      }`}
    >
      {children}
    </button>
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
    case "CAD":
      return "CA$";
    case "AUD":
      return "A$";
    default:
      return c + " ";
  }
}
