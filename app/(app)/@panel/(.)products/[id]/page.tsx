import { notFound } from "next/navigation";
import { getProductData } from "@/app/(app)/products/[id]/data";
import { DetailContent } from "@/app/(app)/products/[id]/detail-content";
import { SlideOver } from "@/components/slide-over";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

/**
 * Intercepted route — renders the product detail in a right-side slide-over
 * panel when navigated to from within the (app) group (e.g. from the
 * dashboard). Direct URL hits or page refreshes still render the standalone
 * page at app/(app)/products/[id]/page.tsx.
 *
 * Guard: `[id]` matches anything in this slot, including sibling routes
 * like `/products/new` and `/products/suggestions`. Without a UUID guard
 * those values flow into Postgres as `'new'::uuid` casts and trigger an
 * unhandled error (digest leaks to the user). When [id] isn't a UUID,
 * fall through to notFound — the panel slot then renders @panel/default.tsx
 * (i.e. nothing) and the main slot handles the real route as normal.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PanelProductPage(props: { params: Params }) {
  const { id } = await props.params;
  // Sibling static routes (`/products/new`, `/products/suggestions`,
  // `/products/compare`) flow through here too. Render nothing for them so
  // the main slot handles them cleanly. notFound() here would show the
  // global not-found page instead of falling back to default.tsx.
  if (!UUID_RE.test(id)) return null;
  const data = await getProductData(id);
  if (!data) notFound();
  return (
    <SlideOver>
      <DetailContent data={data} variant="panel" />
    </SlideOver>
  );
}
