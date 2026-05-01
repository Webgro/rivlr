"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import {
  parseShopifyUrl,
  parseShopifyCollectionUrl,
  fetchShopifyCollection,
  inferMarketFromDomain,
} from "@/lib/crawler/shopify";
import { dispatchCrawl } from "@/lib/crawler/dispatch";
import { generateLinkSuggestions } from "@/lib/crawler/link-suggestions";
import { inArray } from "drizzle-orm";

const MAX_PRODUCTS_PER_COLLECTION = 1000;

/**
 * Bulk add. Accepts a mix of Shopify product URLs and collection URLs.
 * Collection URLs are expanded server-side via /collections/{handle}/products.json
 * before insertion. Everything else is handled identically to single-product
 * adds: validate format, dedupe, bulk-insert with last_crawled_at = NULL,
 * trigger background crawl + suggestions via after().
 *
 * Extracted from the page so both the full-page route and the slide-over
 * intercepted route can share a single action.
 */
export async function addProducts(formData: FormData) {
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
    redirect(`/products?added=0&failed=${invalid + collectionFailed}&dup=0`);
  }

  const seen = new Set<string>();
  const uniqueEntries = productEntries.filter((e) => {
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  });

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

  const chunkSize = 500;
  let added = 0;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const slice = toInsert.slice(i, i + chunkSize);
    await db
      .insert(schema.trackedProducts)
      .values(
        slice.map(({ url, parsed: p }) => {
          const market = inferMarketFromDomain(p.storeDomain);
          return {
            url,
            handle: p.handle,
            storeDomain: p.storeDomain,
            title: null,
            imageUrl: null,
            currency: market.currency,
            marketCountry: market.country,
            marketCurrency: market.currency,
          };
        }),
      )
      .onConflictDoNothing();
    added += slice.length;
  }

  after(async () => {
    try {
      await dispatchCrawl({});
    } catch {
      /* cron will pick up regardless */
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
