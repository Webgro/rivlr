/**
 * Collapsible description section for a tracked product. Renders Shopify's
 * raw HTML description inside a styled <details>/<summary> so users can
 * click to expand and read specs.
 *
 * Note on safety: we render with dangerouslySetInnerHTML because the
 * content is HTML from Shopify. In v1 (single password gate, you're the
 * only viewer) this is fine. When we move to multi-user we should pipe it
 * through DOMPurify or similar to strip <script> / event handlers.
 */
export function DescriptionSection({
  description,
}: {
  description: string | null;
}) {
  if (!description) return null;

  return (
    <details className="mt-6 group rounded-lg border border-default bg-elevated">
      <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-surface/50 select-none">
        <span className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-muted font-mono">
            Description
          </span>
          <span className="text-xs text-muted">
            (from competitor's product page)
          </span>
        </span>
        <span className="text-muted text-xs font-mono group-open:rotate-90 transition-transform inline-block">
          ›
        </span>
      </summary>
      <div
        className="prose-rivlr px-4 py-4 border-t border-default text-sm"
        dangerouslySetInnerHTML={{ __html: description }}
      />
    </details>
  );
}
