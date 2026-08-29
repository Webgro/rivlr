import { AddTabs } from "./add-tabs";

type SearchParams = Promise<Record<string, string>>;

/**
 * Full-page bulk-add. Direct URL hits and "Open full page" links land
 * here; navigation from inside the dashboard goes through the slide-over
 * intercept at @panel/(.)products/new/page.tsx.
 *
 * Two ways in: paste URLs directly (handles + collections) or scan a
 * whole store catalogue and pick from a preview grid. Tabs let the
 * user switch without losing their place.
 */
export default async function NewProductPage(props: {
  searchParams: SearchParams;
}) {
  await props.searchParams;

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <a
        href="/products"
        className="text-xs font-medium text-muted hover:text-foreground"
      >
        ← Back to products
      </a>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        Track competitor products
      </h1>
      <p className="mt-2 text-sm text-muted">
        Paste product or collection URLs, or scan a whole store and pick
        from the catalogue.
      </p>

      <div className="mt-8">
        <AddTabs />
      </div>
    </section>
  );
}
