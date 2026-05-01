import { NewProductForm } from "./new-product-form";

type SearchParams = Promise<Record<string, string>>;

/**
 * Full-page bulk-add. Direct URL hits and "Open full page" links land
 * here; navigation from inside the dashboard goes through the slide-over
 * intercept at @panel/(.)products/new/page.tsx.
 */
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

      <NewProductForm />
    </section>
  );
}
