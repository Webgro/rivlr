import { notFound } from "next/navigation";
import { getProductData } from "./data";
import { DetailContent } from "./detail-content";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function ProductDetailPage(props: { params: Params }) {
  const { id } = await props.params;
  const data = await getProductData(id);
  if (!data) notFound();
  return <DetailContent data={data} variant="page" />;
}
