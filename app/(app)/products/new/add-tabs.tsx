"use client";

import { useState } from "react";
import { NewProductForm } from "./new-product-form";
import { ScanStore } from "./scan-store";

/**
 * Tab switcher between "Paste URLs" (the original add flow) and
 * "Scan a whole store" (the new catalogue scanner). Renders both
 * children but only mounts the active one to avoid running the
 * /products.json fetch when the user is on the URL tab.
 */
export function AddTabs({
  inPanel,
  initialTab,
  initialScanUrl,
}: {
  inPanel?: boolean;
  /** Deep-link support: /products/new?tab=store opens the scanner. */
  initialTab?: "urls" | "store";
  /** With ?scan=<domain>, the scanner opens prefilled and runs. */
  initialScanUrl?: string;
}) {
  const [tab, setTab] = useState<"urls" | "store">(
    initialScanUrl ? "store" : (initialTab ?? "urls"),
  );

  return (
    <div>
      <div
        className="flex items-center gap-1 rounded-lg border border-default bg-elevated p-1"
        role="tablist"
      >
        <TabButton
          active={tab === "urls"}
          onClick={() => setTab("urls")}
          icon={<UrlIcon />}
          title="Paste URLs"
          subtitle="Products or collections"
        />
        <TabButton
          active={tab === "store"}
          onClick={() => setTab("store")}
          icon={<StoreIcon />}
          title="Scan a whole store"
          subtitle="Crawl the catalogue first"
        />
      </div>

      <div className="mt-6">
        {tab === "urls" ? (
          <NewProductForm inPanel={inPanel} />
        ) : (
          <ScanStore initialUrl={initialScanUrl} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-2.5 text-left transition ${
        active
          ? "bg-surface text-foreground border border-default shadow-sm"
          : "text-muted hover:text-foreground"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`flex-shrink-0 ${active ? "text-signal" : "text-muted-strong"}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium leading-tight">{title}</div>
          <div className="text-[11px] text-muted leading-tight mt-0.5">
            {subtitle}
          </div>
        </div>
      </div>
    </button>
  );
}

function UrlIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13 a5 5 0 0 0 7.54 .54 l3 -3 a5 5 0 0 0 -7.07 -7.07 l-1.72 1.71" />
      <path d="M14 11 a5 5 0 0 0 -7.54 -.54 l-3 3 a5 5 0 0 0 7.07 7.07 l1.71 -1.71" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7 L5 4 H19 L20 7" />
      <path d="M4 7 V20 H20 V7" />
      <path d="M4 7 H20" />
      <path d="M9 7 V11 a3 3 0 0 1 -6 0 V7" />
      <path d="M15 7 V11 a3 3 0 0 1 -6 0 V7" />
      <path d="M21 7 V11 a3 3 0 0 1 -6 0 V7" />
    </svg>
  );
}
