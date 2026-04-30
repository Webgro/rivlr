"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  trackDiscovered,
  dismissDiscovered,
  bulkTrackDiscovered,
  bulkDismissDiscovered,
} from "./actions";

interface Item {
  id: string;
  storeDomain: string;
  title: string | null;
  imageUrl: string | null;
  url: string;
  firstSeen: string;
}

export function DiscoverList({ items }: { items: Item[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const router = useRouter();

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const someSelected = items.some((i) => selected.has(i.id)) && !allSelected;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
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

  function handleTrack(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await trackDiscovered(fd);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      router.refresh();
    });
  }

  function handleDismiss(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await dismissDiscovered(fd);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      router.refresh();
    });
  }

  function handleBulk(action: "track" | "dismiss") {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setFeedback(null);
    startTransition(async () => {
      const result = action === "track"
        ? await bulkTrackDiscovered(ids)
        : await bulkDismissDiscovered(ids);
      if (result.ok) {
        setFeedback(
          action === "track"
            ? `✓ Tracking ${result.count}`
            : `✓ Dismissed ${result.count}`,
        );
        setSelected(new Set());
        router.refresh();
      } else {
        setFeedback(`Error: ${result.error ?? "unknown"}`);
      }
    });
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-signal/40 bg-elevated px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <span className="text-muted">·</span>
          <button
            type="button"
            onClick={() => handleBulk("track")}
            disabled={pending}
            className="rounded border border-default bg-foreground text-surface px-2.5 py-1 text-xs font-medium hover:opacity-90 disabled:opacity-50"
          >
            + Track all
          </button>
          <button
            type="button"
            onClick={() => handleBulk("dismiss")}
            disabled={pending}
            className="rounded border border-default bg-surface px-2.5 py-1 text-xs hover:border-strong disabled:opacity-50"
          >
            Dismiss all
          </button>
          {feedback && (
            <span className="ml-auto text-xs text-muted font-mono">
              {feedback}
            </span>
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-muted hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-default">
        <div className="grid grid-cols-[28px_2fr_1fr_1fr_auto] gap-3 items-center border-b border-default bg-elevated px-5 py-3 text-[11px] uppercase tracking-wider text-muted font-mono">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={toggleAll}
            aria-label="Select all"
            className="accent-signal"
          />
          <div>Product</div>
          <div>Store</div>
          <div>First seen</div>
          <div></div>
        </div>
        {items.map((item) => {
          const isSelected = selected.has(item.id);
          return (
            <div
              key={item.id}
              className={`grid grid-cols-[28px_2fr_1fr_1fr_auto] items-center gap-3 border-b border-default px-5 py-3 last:border-b-0 text-sm transition ${isSelected ? "bg-signal/5" : "hover:bg-elevated"}`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleOne(item.id)}
                aria-label={`Select ${item.title}`}
                className="accent-signal"
              />
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 min-w-0"
              >
                <div
                  className="h-10 w-10 rounded-md flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(${(item.id.charCodeAt(0) * 13) % 360},20%,18%), hsl(${(item.id.charCodeAt(0) * 13 + 30) % 360},25%,28%))`,
                  }}
                />
                <div className="min-w-0">
                  <div className="truncate font-medium hover:underline">
                    {item.title ?? "(untitled)"}
                  </div>
                  <div className="truncate text-xs text-muted font-mono">
                    /products/{extractHandle(item.url)}
                  </div>
                </div>
              </a>
              <div className="text-xs text-muted font-mono truncate">
                {item.storeDomain}
              </div>
              <div className="text-xs text-muted font-mono">
                {formatRelative(new Date(item.firstSeen))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTrack(item.id)}
                  disabled={pending}
                  title="Track this product"
                  className="rounded-md bg-signal text-white px-2.5 py-1 text-xs font-medium hover:bg-red-600 disabled:opacity-50"
                >
                  + Track
                </button>
                <button
                  type="button"
                  onClick={() => handleDismiss(item.id)}
                  disabled={pending}
                  title="Dismiss"
                  className="rounded-md border border-default bg-surface px-2.5 py-1 text-xs text-muted hover:border-strong hover:text-foreground disabled:opacity-50"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function extractHandle(url: string): string {
  const m = url.match(/\/products\/([^/?#]+)/);
  return m ? m[1] : "";
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
