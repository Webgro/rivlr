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
 */
export default async function PanelProductPage(props: { params: Params }) {
  const { id } = await props.params;
  const data = await getProductData(id);
  if (!data) notFound();
  return (
    <SlideOver>
      <DetailContent data={data} variant="panel" />
    </SlideOver>
  );
}
