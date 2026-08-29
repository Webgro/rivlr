import { SlideOver } from "@/components/slide-over";
import { AddTabs } from "@/app/(app)/products/new/add-tabs";

export const dynamic = "force-dynamic";

/**
 * Slide-over intercept for /products/new. More specific than the
 * (.)products/[id] intercept, so Next.js prefers this match — meaning
 * the [id] intercept's loading skeleton no longer flashes when a user
 * clicks "+ New product" from inside the dashboard.
 *
 * Direct URL hits and refreshes still get the full-page route at
 * app/(app)/products/new/page.tsx.
 */
export default async function PanelNewProductPage(props: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await props.searchParams;
  return (
    <SlideOver>
      <div className="px-6 py-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Track competitor products
        </h1>
        <p className="mt-1 text-sm text-muted">
          Paste URLs or scan a whole store catalogue.
        </p>

        <div className="mt-6">
          <AddTabs
            inPanel
            initialTab={params.tab === "store" ? "store" : undefined}
            initialScanUrl={params.scan || undefined}
          />
        </div>
      </div>
    </SlideOver>
  );
}
