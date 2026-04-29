import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import {
  parseShopifyUrl,
  fetchShopifyProduct,
  penceToDecimal,
} from "@/lib/crawler/shopify";
import { eq } from "drizzle-orm";

type SearchParams = Promise<{ error?: string }>;

async function addProduct(formData: FormData) {
  "use server";
  const url = String(formData.get("url") ?? "").trim();
  if (!url) redirect("/products/new?error=no_url");

  const parsed = parseShopifyUrl(url);
  if (!parsed) redirect("/products/new?error=invalid_url");

  // Check for duplicates first.
  const existing = await db
    .select()
    .from(schema.trackedProducts)
    .where(eq(schema.trackedProducts.url, url))
    .limit(1);
  if (existing.length > 0) {
    redirect(`/products/${existing[0].id}`);
  }

  // Validate by fetching once.
  let product;
  try {
    product = await fetchShopifyProduct(parsed!.productJsUrl);
  } catch {
    redirect("/products/new?error=fetch_failed");
  }

  const [inserted] = await db
    .insert(schema.trackedProducts)
    .values({
      url,
      handle: parsed!.handle,
      storeDomain: parsed!.storeDomain,
      title: product!.title,
      imageUrl: product!.featured_image,
      lastCrawledAt: new Date(),
    })
    .returning();

  // Seed initial observations from the validation fetch.
  await db.insert(schema.priceObservations).values({
    productId: inserted.id,
    price: penceToDecimal(product!.price),
    currency: "GBP",
  });
  await db.insert(schema.stockObservations).values({
    productId: inserted.id,
    available: product!.available,
  });

  revalidatePath("/");
  redirect("/");
}

export default async function NewProductPage(props: {
  searchParams: SearchParams;
}) {
  const { error } = await props.searchParams;

  const errorMessages: Record<string, string> = {
    no_url: "Paste a Shopify product URL.",
    invalid_url:
      "That doesn't look like a Shopify product URL. Expected something like https://store.com/products/product-handle.",
    fetch_failed:
      "Couldn't fetch that product. Check the URL is publicly accessible and try again.",
  };

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <a
        href="/"
        className="text-xs uppercase tracking-wider text-neutral-500 font-mono hover:text-ink"
      >
        ← Back to dashboard
      </a>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-ink">
        Track a competitor product
      </h1>
      <p className="mt-2 text-sm text-neutral-600">
        Paste any Shopify product URL. We&apos;ll fetch it once now to
        confirm it works, then crawl it daily from tomorrow.
      </p>

      <form action={addProduct} className="mt-8 space-y-4">
        <div>
          <label
            htmlFor="url"
            className="block text-xs uppercase tracking-wider text-neutral-500 font-mono"
          >
            Shopify product URL
          </label>
          <input
            id="url"
            name="url"
            type="url"
            placeholder="https://example.com/products/some-handle"
            required
            autoFocus
            className="mt-2 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink"
          />
        </div>

        {error && errorMessages[error] && (
          <p className="text-sm text-signal">{errorMessages[error]}</p>
        )}

        <button
          type="submit"
          className="rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-neutral-800"
        >
          Track product
        </button>
      </form>
    </main>
  );
}
