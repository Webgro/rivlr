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

/**
 * Floating bottom-right widget that polls /api/crawl/status while there's
 * work in flight. Auto-hides when the queue empties (with a brief 'done'
 * confirmation). Refreshes the dashboard once everything settles so new
 * data appears without a manual reload.
 */
export function CrawlProgress() {
  const [status, setStatus] = useState<Status | null>(null);
  const [showDone, setShowDone] = useState(false);
  const router = useRouter();

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

        // Transitioned active → idle: refresh dashboard, flash 'done'.
        if (lastActive && !active) {
          setShowDone(true);
          router.refresh();
          setTimeout(() => setShowDone(false), 4000);
        }
        lastActive = active;
      } catch {
        // ignore — next tick will try again
      }
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [router]);

  if (!status) return null;

  const active = status.pending + status.running + status.pendingFirstCrawl;
  if (active === 0 && !showDone) return null;

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

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 rounded-lg border border-default bg-elevated p-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted font-mono">
          Crawling
        </div>
        <div className="text-xs font-mono text-muted">{pct}%</div>
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
