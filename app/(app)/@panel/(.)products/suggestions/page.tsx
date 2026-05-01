import { SlideOver } from "@/components/slide-over";
import { SuggestionsContent } from "@/app/(app)/products/suggestions/suggestions-content";

export const dynamic = "force-dynamic";

/**
 * Slide-over intercept for /products/suggestions. Specific match wins
 * over the catch-all (.)products/[id] intercept, which previously showed
 * its loading skeleton then errored on the non-UUID 'suggestions' value.
 */
export default function PanelSuggestionsPage() {
  return (
    <SlideOver>
      <div className="px-6 py-6">
        <SuggestionsContent inPanel />
      </div>
    </SlideOver>
  );
}
