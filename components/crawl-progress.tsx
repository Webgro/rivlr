"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Status {
  pending: number;
  running: number;
  ok: number;
  failed: number;
  pendingFirstCrawl: number;
}

const STORAGE_KEY = "rivlr-crawl-widget-min";

/**
 * Floating bottom-right widget that polls /api/crawl/status while there's
 * work in flight. Two display modes:
 *   - Expanded: full card with progress bar and per-status counts
 *   - Minimised: small pill showing just '◐ 47%' — click to expand again
 *
 * Minimisation is persisted to localStorage so the user's preference
 * sticks across navigation and reloads.
 */
export function CrawlProgress() {
  const [status, setStatus] = useState<Status | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();

  // Hydrate the minimised preference from localStorage on mount.
  useEffect(() => {
    try {
      setMinimised(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  function setMin(value: boolean) {
    setMinimised(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    let stopped = false;
    let lastActive = false;

    async function poll() {
      try {
        const res = await fetch("/api/crawl/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Status;
        if (stopped) return;
        setStatus(data);

        const active =
          data.pending > 0 || data.running > 0 || data.pendingFirstCrawl > 0;

        if (lastActive && !active) {
          setShowDone(true);
          router.refresh();
          setTimeout(() => setShowDone(false), 4000);
        }
        lastActive = active;
      } catch {
        // ignore
      }
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [router]);

  if (!hydrated) return null;
  if (!status) return null;

  const active = status.pending + status.running + status.pendingFirstCrawl;
  if (active === 0 && !showDone) return null;

  // 'Done' confirmation always shows even when minimised (it auto-disappears
  // after 4s anyway).
  if (showDone && active === 0) {
    return (
      <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-default bg-elevated px-4 py-3 shadow-lg flex items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        <span className="text-sm">Crawl complete</span>
      </div>
    );
  }

  const total =
    status.pending +
    status.running +
    status.ok +
    status.failed +
    status.pendingFirstCrawl;
  const done = status.ok + status.failed;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (minimised) {
    return (
      <button
        type="button"
        onClick={() => setMin(false)}
        title="Expand crawl progress"
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-default bg-elevated pl-2 pr-3.5 py-1.5 shadow-lg hover:border-strong transition"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-signal opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
        </span>
        <span className="text-xs font-mono text-muted-strong">
          Crawl {pct}%
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 rounded-lg border border-default bg-elevated p-4 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-wider text-muted font-mono">
          Crawling
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted">{pct}%</span>
          <button
            type="button"
            onClick={() => setMin(true)}
            title="Minimise"
            aria-label="Minimise"
            className="rounded p-0.5 text-muted hover:text-foreground hover:bg-surface"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6h8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-2 h-1.5 w-full rounded-full bg-surface overflow-hidden">
        <div
          className="h-full bg-signal transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono">
        <Stat label="Done" value={done} />
        <Stat label="Pending" value={status.pending + status.pendingFirstCrawl} />
        <Stat label="Running" value={status.running} />
        <Stat
          label="Failed"
          value={status.failed}
          highlight={status.failed > 0}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border border-default rounded px-2 py-1">
      <span className="text-muted uppercase tracking-wider">{label}</span>
      <span className={highlight ? "text-signal font-semibold" : ""}>
        {value}
      </span>
    </div>
  );
}
