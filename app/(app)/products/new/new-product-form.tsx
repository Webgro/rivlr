import { addProducts } from "./actions";
import { SubmitButton } from "./submit-button";
import { CsvUploadButton } from "./csv-upload";

const MAX_PRODUCTS_PER_COLLECTION = 1000;

/**
 * Shared form rendered both as the full-page route and inside the
 * slide-over intercept. Doesn't include any wrapping section / heading
 * chrome — caller decides that.
 */
export function NewProductForm({ inPanel }: { inPanel?: boolean }) {
  return (
    <>
      <div
        className={`${inPanel ? "" : "mt-4"} rounded-md border border-default bg-elevated px-4 py-3 text-xs text-muted font-mono leading-5 space-y-1`}
      >
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
            rows={inPanel ? 8 : 12}
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

        <div className="flex flex-wrap items-center gap-3 justify-between">
          <CsvUploadButton textareaId="urls" />
          <SubmitButton />
        </div>
      </form>
    </>
  );
}
