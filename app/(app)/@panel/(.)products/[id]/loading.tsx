"use client";

import { useRouter } from "next/navigation";
import { SlideOverShell } from "@/components/slide-over";

/**
 * Skeleton shown immediately on click — Next.js renders this while the
 * intercepted page's data fetches resolve. Without it the user saw a
 * second of nothing before the panel slid in.
 */
export default function PanelLoading() {
  const router = useRouter();
  return (
    <SlideOverShell onClose={() => router.back()}>
      <div className="px-6 py-6 animate-pulse">
        <div className="flex items-start gap-6">
          <div className="h-20 w-20 rounded-lg bg-elevated flex-shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-elevated" />
            <div className="h-6 w-2/3 rounded bg-elevated" />
            <div className="h-3 w-44 rounded bg-elevated" />
          </div>
          <div className="flex flex-col gap-2">
            <div className="h-8 w-20 rounded-md bg-elevated" />
            <div className="h-8 w-20 rounded-md bg-elevated" />
          </div>
        </div>
        <div className="mt-6 h-24 rounded-lg bg-elevated" />
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="h-20 rounded-lg bg-elevated" />
          <div className="h-20 rounded-lg bg-elevated" />
          <div className="h-20 rounded-lg bg-elevated" />
          <div className="h-20 rounded-lg bg-elevated" />
        </div>
        <div className="mt-8 h-64 rounded-lg bg-elevated" />
        <div className="mt-8 h-64 rounded-lg bg-elevated" />
      </div>
    </SlideOverShell>
  );
}
