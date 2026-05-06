"use server";

import { requireUser } from "@/lib/auth/current-user";
import { fetchShopifyCollection } from "@/lib/crawler/shopify";
import { getProductQuota, type Plan } from "@/lib/plan";

/**
 * Catalogue scan — used by the "Track a whole store" tab on /products/new.
 *
 * Scans up to SCAN_MAX_PRODUCTS via the public /collections/all/products.json
 * endpoint, returns:
 *   - total found,
 *   - first PREVIEW_CAP products (image + title + URL only — no price/stock,
 *     this is just discovery; the user picks which to actually track),
 *   - the user's current quota so the client can render the plan
 *     recommendation banner without a second round-trip.
 *
 * No DB writes here. Selected products go through the existing
 * addProducts action when the user confirms.
 */

const SCAN_MAX_PRODUCTS = 1000;
const PREVIEW_CAP = 50;

export interface ScanProduct {
  handle: string;
  title: string;
  imageUrl: string | null;
  url: string;
}

export type ScanResult =
  | {
      ok: true;
      storeDomain: string;
      /** Number of products fetched. May equal SCAN_MAX_PRODUCTS if the
       *  store has more — `capped` lets the UI signal that. */
      total: number;
      capped: boolean;
      /** First N products for the selection grid. */
      preview: ScanProduct[];
      previewCap: number;
      quota: {
        plan: Plan;
        current: number;
        limit: number | null;
        remaining: number | null;
      };
    }
  | { ok: false; error: string };

/**
 * Server action invoked from the client component on the "scan" form
 * submit. Returns a discriminated union the UI can switch on.
 */
export async function scanStoreCatalogue(
  storeUrl: string,
): Promise<ScanResult> {
  const user = await requireUser();

  const domain = parseStoreDomain(storeUrl);
  if (!domain) {
    return {
      ok: false,
      error:
        "That doesn't look like a store URL. Try something like gymshark.com or https://allbirds.co.uk.",
    };
  }

  let products: Array<{
    handle: string;
    title: string;
    imageUrl: string | null;
  }>;
  try {
    products = await fetchShopifyCollection(domain, "all", {
      maxProducts: SCAN_MAX_PRODUCTS,
    });
  } catch {
    return {
      ok: false,
      error:
        "Couldn't reach that store, or it isn't a Shopify store. Check the URL and try again.",
    };
  }

  if (products.length === 0) {
    return {
      ok: false,
      error:
        "We couldn't find any public products on that store. Some merchants hide their /products.json endpoint.",
    };
  }

  const quota = await getProductQuota(user.id);

  return {
    ok: true,
    storeDomain: domain,
    total: products.length,
    capped: products.length === SCAN_MAX_PRODUCTS,
    previewCap: PREVIEW_CAP,
    preview: products.slice(0, PREVIEW_CAP).map((p) => ({
      handle: p.handle,
      title: p.title,
      imageUrl: p.imageUrl,
      url: `https://${domain}/products/${p.handle}`,
    })),
    quota: {
      plan: quota.plan,
      current: quota.current,
      limit: quota.limit,
      remaining: quota.remaining,
    },
  };
}

/**
 * Normalise a user-typed store URL down to a bare domain. Accepts:
 *   gymshark.com
 *   www.gymshark.com
 *   https://gymshark.com
 *   https://www.gymshark.com/collections/featured
 * Rejects anything that doesn't look like a domain.
 */
function parseStoreDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  let domain = trimmed.replace(/^https?:\/\//, "").replace(/^www\./, "");
  // Drop path, query, fragment.
  domain = domain.split("/")[0].split("?")[0].split("#")[0];
  // Loose domain check — at least one dot, valid characters, recognisable TLD.
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(domain)) return null;
  return domain;
}
