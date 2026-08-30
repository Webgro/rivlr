import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Disable HTTP caching on per-user pages. `dynamic = "force-dynamic"`
   * already opts these out of Next's full-route cache, but doesn't stop
   * browsers / Vercel's CDN from caching the rendered HTML response.
   *
   * Without this, a user can complete Checkout, the webhook updates
   * their plan in the DB, but their browser keeps showing them the
   * pre-payment HTML for hours.
   */
  async headers() {
    const NO_STORE = [
      {
        key: "Cache-Control",
        value: "no-store, no-cache, must-revalidate, max-age=0",
      },
      // Defensive — some intermediaries respect these even when they
      // ignore Cache-Control.
      { key: "Pragma", value: "no-cache" },
      { key: "Expires", value: "0" },
    ];
    return [
      { source: "/billing", headers: NO_STORE },
      { source: "/billing/:path*", headers: NO_STORE },
      { source: "/profile", headers: NO_STORE },
      { source: "/settings", headers: NO_STORE },
      { source: "/dashboard", headers: NO_STORE },
      // Guided setup advances by re-rendering the same URL as the
      // background imports finish. Missing from this list, it was
      // served from cache: both catalogues completed in about forty
      // seconds and the progress screen stayed up for five minutes.
      // The client also force-navigates as a backstop, but this is the
      // actual cause.
      { source: "/welcome", headers: NO_STORE },
    ];
  },

  /**
   * The navigation went from six entries that mirrored the database to
   * four that mirror the job. These keep old links, bookmarks and
   * emails working. Permanent, because the old names are not coming
   * back.
   *
   * Only /discover actually moved. /activity, /tags and the full
   * watchlist left the nav but still exist and are still linked to
   * from the pages that replaced them, so redirecting those would
   * bounce the links straight back where they came from.
   */
  async redirects() {
    return [
      { source: "/discover", destination: "/discovery", permanent: true },
    ];
  },
};

export default nextConfig;
