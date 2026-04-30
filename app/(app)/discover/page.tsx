import Link from "next/link";
import { db, schema } from "@/lib/db";
import { eq, sql, desc } from "drizzle-orm";
import { DiscoverList } from "./discover-list";
import { RunDiscoveryButton } from "./run-discovery-button";
import { getPlanFeatures } from "@/lib/plan";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

type SearchParams = Promise<{
  store?: string;
  q?: string;
  page?: string;
}>;

export default async function DiscoverPage(props: { searchParams: SearchParams }) {
  const params = await props.searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const q = params.q?.trim().toLowerCase() ?? "";

  // Fetch all 'new' discoveries (filtered server-side by store + search).
  const result = await db.execute<{
    id: string;
    store_domain: string;
    handle: string;
    title: string | null;
    image_url: string | null;
    url: string;
    first_seen: string;
  }>(sql`
    SELECT id, store_domain, handle, title, image_url, url, first_seen
    FROM discovered_products
    WHERE status = 'new'
      ${params.store ? sql`AND store_domain = ${params.store}` : sql``}
      ${
        q
          ? sql`AND (LOWER(COALESCE(title, '')) LIKE ${"%" + q + "%"} OR LOWER(handle) LIKE ${"%" + q + "%"})`
          : sql``
      }
    ORDER BY first_seen DESC
  `);
  const all = Array.from(result).map((r) => ({
    id: r.id,
    storeDomain: r.store_domain,
    handle: r.handle,
    title: r.title,
    imageUrl: r.image_url,
    url: r.url,
    firstSeen: new Date(r.first_seen),
  }));

  const totalCount = all.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const paged = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Plan gating. Free / Starter users see only the first N rows; the rest
  // are blurred + uninteractive with an upgrade CTA below.
  const { plan, features } = await getPlanFeatures();
  const visibleLimit = features.discoverVisible;
  const lockedFromIndex =
    visibleLimit !== Infinity && paged.length > visibleLimit
      ? visibleLimit
      : undefined;
  const isLocked = lockedFromIndex !== undefined;

  // List of stores with new products (for the filter dropdown).
  const storesRows = await db.execute<{ store_domain: string; n: number }>(sql`
    SELECT store_domain, COUNT(*)::int AS n
    FROM discovered_products
    WHERE status = 'new'
    GROUP BY store_domain
    ORDER BY n DESC, store_domain ASC
  `);
  const stores = Array.from(storesRows);

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Discover
          </h1>
          <p className="mt-1 text-sm text-muted">
            New products on stores you already watch. Daily catalogue scan
            at 05:00 GMT. Track the ones that matter, dismiss the rest.
          </p>
        </div>
        <RunDiscoveryButton />
      </div>

      {stores.length > 0 || q ? (
        <form
          method="get"
          className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-default bg-elevated px-4 py-3"
          key={`${params.store ?? ""}|${q}`}
        >
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search title or handle…"
            className="flex-1 min-w-[200px] rounded-md border border-default bg-surface px-3 py-1.5 text-sm text-foreground placeholder-muted outline-none focus:border-strong"
          />
          <select
            name="store"
            defaultValue={params.store ?? ""}
            className="rounded-md border border-default bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-strong"
          >
            <option value="">All stores</option>
            {stores.map((s) => (
              <option key={s.store_domain} value={s.store_domain}>
                {s.store_domain} ({s.n})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-surface"
          >
            Apply
          </button>
          {(params.store || q) && (
            <Link
              href="/discover"
              className="text-xs text-muted hover:text-foreground"
            >
              Clear
            </Link>
          )}
          <span className="ml-auto text-xs text-muted font-mono">
            {totalCount} pending
          </span>
        </form>
      ) : null}

      {paged.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed border-default px-8 py-16 text-center text-sm text-muted">
          {params.store
            ? `No new products discovered on ${params.store}.`
            : `No new products discovered yet. The daily scan runs at 05:00 GMT, or hit "Run scan now" to discover immediately.`}
        </div>
      ) : (
        <>
          <div className="relative">
            <DiscoverList
              items={paged.map((d) => ({
                id: d.id,
                storeDomain: d.storeDomain,
                title: d.title,
                imageUrl: d.imageUrl,
                url: d.url,
                firstSeen: d.firstSeen.toISOString(),
              }))}
              lockedFromIndex={lockedFromIndex}
            />
            {isLocked && (
              <div className="mt-4 rounded-xl border border-signal/30 bg-gradient-to-b from-signal/5 to-transparent p-6 text-center">
                <div className="text-[10px] uppercase tracking-[0.2em] text-signal font-mono">
                  Plan limit
                </div>
                <h3 className="mt-2 text-lg font-semibold tracking-tight">
                  Unlock all {totalCount} discoveries
                </h3>
                <p className="mt-2 text-sm text-muted max-w-md mx-auto">
                  Your current plan ({plan}) shows the top {visibleLimit} new
                  products per scan. Upgrade to see and track every discovery
                  on every store you watch.
                </p>
                <Link
                  href="/settings#billing"
                  className="mt-5 inline-block rounded-md bg-signal px-5 py-2.5 text-sm font-medium text-white hover:bg-red-600"
                >
                  See plans →
                </Link>
              </div>
            )}
          </div>

          {totalPages > 1 && !isLocked && (
            <nav className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-default bg-elevated px-4 py-3">
              <Link
                href={pageHref(page - 1, params)}
                aria-disabled={page === 1}
                className={`rounded-md border border-default px-3 py-1.5 text-sm transition ${page === 1 ? "opacity-40 pointer-events-none" : "hover:border-strong"}`}
              >
                ← Previous
              </Link>
              <span className="text-xs text-muted font-mono">
                Page {page} of {totalPages}
              </span>
              <Link
                href={pageHref(page + 1, params)}
                aria-disabled={page === totalPages}
                className={`rounded-md border border-default px-3 py-1.5 text-sm transition ${page === totalPages ? "opacity-40 pointer-events-none" : "hover:border-strong"}`}
              >
                Next →
              </Link>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

function pageHref(p: number, params: { store?: string }): string {
  const sp = new URLSearchParams();
  if (params.store) sp.set("store", params.store);
  if (p > 1) sp.set("page", String(p));
  const q = sp.toString();
  return `/discover${q ? "?" + q : ""}`;
}
