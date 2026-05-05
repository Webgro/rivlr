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
    ];
  },
};

export default nextConfig;
