"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { trackDiscovered, dismissDiscovered } from "@/app/(app)/discover/actions";

export interface UntrackedItem {
  id: string;
  handle: string;
  title: string | null;
  imageUrl: string | null;
  url: string;
  firstSeen: string;
}

/**
 * Per-store untracked discoveries list. Mirrors /discover but scoped to
 * one store. Newest first, with quick Track + Dismiss buttons that update
 * server-side and refresh the route.
 */
export function UntrackedList({ items }: { items: UntrackedItem[] }) {
  const [pending, startTransition] = useTransition();
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const router = useRouter();

  const visible = items.filter((i) => !removed.has(i.id));

  function track(id: string) {
    setRemoved((prev) => new Set(prev).add(id));
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await trackDiscovered(fd);
      router.refresh();
    });
  }

  function dismiss(id: string) {
    setRemoved((prev) => new Set(prev).add(id));
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await dismissDiscovered(fd);
      router.refresh();
    });
  }

  if (visible.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-default px-5 py-6 text-center text-xs text-muted">
        Nothing new from the daily catalogue scan.
      </div>
    );
  }

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-default">
      {visible.map((it) => (
        <div
          key={it.id}
          className="flex items-center gap-3 border-b border-default px-4 py-3 last:border-b-0"
        >
          <a
            href={it.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80"
          >
            {it.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={it.imageUrl}
                alt=""
                loading="lazy"
                className="h-10 w-10 rounded-md bg-elevated object-cover flex-shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-md bg-elevated flex-shrink-0" />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {it.title ?? it.handle}
              </div>
              <div className="truncate text-[11px] text-muted font-mono">
                /products/{it.handle} · {timeAgo(it.firstSeen)}
              </div>
            </div>
          </a>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => track(it.id)}
              disabled={pending}
              className="rounded-md bg-signal text-white px-2.5 py-1 text-xs font-medium hover:bg-red-600 disabled:opacity-50"
            >
              + Track
            </button>
            <button
              type="button"
              onClick={() => dismiss(it.id)}
              disabled={pending}
              title="Dismiss"
              className="rounded-md border border-default bg-surface px-2.5 py-1 text-xs text-muted hover:border-strong hover:text-foreground disabled:opacity-50"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
