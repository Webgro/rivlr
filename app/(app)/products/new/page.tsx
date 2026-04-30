import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import {
  parseShopifyUrl,
  parseShopifyCollectionUrl,
  fetchShopifyCollection,
} from "@/lib/crawler/shopify";
import { dispatchCrawl } from "@/lib/crawler/dispatch";
import { generateLinkSuggestions } from "@/lib/crawler/link-suggestions";
import { inArray } from "drizzle-orm";
import { SubmitButton } from "./submit-button";

type SearchParams = Promise<Record<string, string>>;

const MAX_PRODUCTS_PER_COLLECTION = 1000;

/**
 * Bulk add. Accepts a mix of Shopify product URLs and collection URLs.
 * Collection URLs are expanded server-side via /collections/{handle}/products.json
 * before insertion. Everything else is handled identically to single-product
 * adds: validate format, dedupe, bulk-insert with last_crawled_at = NULL,
 * trigger background crawl + suggestions via after().
 */
async function addProducts(formData: FormData) {
  "use server";
  const raw = String(formData.get("urls") ?? "").trim();
  if (!raw) redirect("/products");

  const inputs = Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((u) => u.trim())
        .filter(Boolean),
    ),
  );

  if (inputs.length === 0) redirect("/products");

  // Classify each input.
  const productEntries: Array<{
    url: string;
    parsed: NonNullable<ReturnType<typeof parseShopifyUrl>>;
  }> = [];
  const collectionEntries: Array<{
    url: string;
    parsed: NonNullable<ReturnType<typeof parseShopifyCollectionUrl>>;
  }> = [];
  let invalid = 0;

  for (const url of inputs) {
    const productParse = parseShopifyUrl(url);
    if (productParse) {
      productEntries.push({ url, parsed: productParse });
      continue;
    }
    const collectionParse = parseShopifyCollectionUrl(url);
    if (collectionParse) {
      collectionEntries.push({ url, parsed: collectionParse });
      continue;
    }
    invalid += 1;
  }

  // Expand collections into product entries. We do this server-side
  // synchronously — most collections are small and the user expects
  // immediate feedback. For very large collections we cap at 1000 each.
  let expanded = 0;
  let collectionFailed = 0;
  for (const c of collectionEntries) {
    try {
      const products = await fetchShopifyCollection(
        c.parsed.storeDomain,
        c.parsed.handle,
        { maxProducts: MAX_PRODUCTS_PER_COLLECTION },
      );
      for (const p of products) {
        const productUrl = `https://${c.parsed.storeDomain}/products/${p.handle}`;
        productEntries.push({
          url: productUrl,
          parsed: {
            storeDomain: c.parsed.storeDomain,
            handle: p.handle,
            productJsUrl: `https://${c.parsed.storeDomain}/products/${p.handle}.js`,
          },
        });
        expanded += 1;
      }
    } catch {
      collectionFailed += 1;
    }
  }

  if (productEntries.length === 0) {
    revalidatePath("/products");
    revalidatePath("/dashboard");
    redirect(
      `/products?added=0&failed=${invalid + collectionFailed}&dup=0`,
    );
  }

  // Dedupe by URL within this batch.
  const seen = new Set<string>();
  const uniqueEntries = productEntries.filter((e) => {
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  });

  // Find duplicates already in DB.
  const existing = await db
    .select({ url: schema.trackedProducts.url })
    .from(schema.trackedProducts)
    .where(
      inArray(
        schema.trackedProducts.url,
        uniqueEntries.map((e) => e.url),
      ),
    );
  const existingSet = new Set(existing.map((e) => e.url));
  const toInsert = uniqueEntries.filter((e) => !existingSet.has(e.url));

  // Bulk insert in chunks of 500 (Postgres parameter-limit safety).
  const chunkSize = 500;
  let added = 0;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const slice = toInsert.slice(i, i + chunkSize);
    await db
      .insert(schema.trackedProducts)
      .values(
        slice.map(({ url, parsed: p }) => ({
          url,
          handle: p.handle,
          storeDomain: p.storeDomain,
          title: null,
          imageUrl: null,
        })),
      )
      .onConflictDoNothing();
    added += slice.length;
  }

  // Background work — survives past the redirect via after().
  after(async () => {
    try {
      await dispatchCrawl({});
    } catch {
      /* 5-min cron will pick up regardless */
    }
    try {
      await generateLinkSuggestions();
    } catch {
      /* non-critical */
    }
  });

  revalidatePath("/products");
  revalidatePath("/dashboard");
  redirect(
    `/products?added=${added}&failed=${invalid + collectionFailed}&dup=${existingSet.size}&col=${collectionEntries.length}&exp=${expanded}`,
  );
}

export default async function NewProductPage(props: {
  searchParams: SearchParams;
}) {
  await props.searchParams;

  return (
    <section className="mx-auto max-w-2xl px-6 py-12">
      <a
        href="/products"
        className="text-xs uppercase tracking-wider text-muted font-mono hover:text-foreground"
      >
        ← Back to products
      </a>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        Track competitor products
      </h1>
      <p className="mt-2 text-sm text-muted">
        Paste product URLs or collection URLs. Collection links expand into
        every product in the collection. Mix both freely.
      </p>

      <div className="mt-4 rounded-md border border-default bg-elevated px-4 py-3 text-xs text-muted font-mono leading-5 space-y-1">
        <div>
          <span className="text-foreground">product:</span>{" "}
          https://store.com<span className="text-foreground">/products/</span>
          handle
        </div>
        <div>
          <span className="text-foreground">collection:</span>{" "}
          https://store.com
          <span className="text-foreground">/collections/</span>handle
        </div>
      </div>

      <form action={addProducts} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="urls"
            className="block text-xs uppercase tracking-wider text-muted font-mono"
          >
            URLs
          </label>
          <textarea
            id="urls"
            name="urls"
            rows={12}
            placeholder={
              "https://store-a.com/products/some-handle\nhttps://store-b.com/collections/dog-food"
            }
            required
            autoFocus
            className="mt-2 block w-full rounded-md border border-default bg-elevated px-3 py-2.5 text-sm text-foreground shadow-sm outline-none font-mono leading-5 focus:border-strong"
          />
          <p className="mt-1 text-xs text-muted">
            Collections are capped at {MAX_PRODUCTS_PER_COLLECTION} products
            each. Duplicates and invalid URLs are skipped automatically.
          </p>
        </div>

        <SubmitButton />
      </form>
    </section>
  );
}
