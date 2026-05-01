/**
 * Empty intercept for /products/compare. Defensive: without this, the
 * (.)products/[id] catch-all matched and rendered its loading skeleton
 * before the non-UUID 'compare' value triggered our return-null guard.
 * This specific match short-circuits that flash. Returning null in a
 * parallel slot just means @panel/default.tsx (also null) renders.
 */
export default function PanelComparePage() {
  return null;
}
