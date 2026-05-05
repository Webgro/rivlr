import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy (formerly middleware) — gates the dashboard behind a per-user
 * magic-link session.
 *
 * - Public paths: /login, /signup, /auth/verify, marketing landing,
 *   /legal/*, /help/*, /unsubscribe, /api/auth/*, /api/preview,
 *   /api/waitlist, /api/public/*, Vercel cron endpoints, _next assets.
 * - Everything else requires the `rivlr_auth` cookie. Cookie presence is
 *   checked here; full session validation (auth_sessions row + sliding
 *   expiry) happens in route handlers / server components via getSession().
 *
 * In Next.js 16, this file is `proxy.ts` (renamed from `middleware.ts`)
 * and the function is named `proxy`. Runtime is Node.js.
 */

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/auth/verify",
  "/bot",
  "/unsubscribe",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static / Next internals — let through.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  // Cron endpoints authenticated by Vercel's CRON_SECRET, not by cookie.
  if (pathname.startsWith("/api/crawl/")) {
    return NextResponse.next();
  }

  // Public auth paths.
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Public-facing pages (legal, help, marketing landing, signup, preview API)
  // don't require auth — shareable externally and crawlable by search engines.
  if (
    pathname === "/" ||
    pathname === "/signup" ||
    pathname.startsWith("/api/preview") ||
    pathname.startsWith("/api/waitlist") ||
    pathname.startsWith("/api/public/") ||
    pathname.startsWith("/legal/") ||
    pathname === "/legal" ||
    pathname.startsWith("/help/") ||
    pathname === "/help"
  ) {
    return NextResponse.next();
  }

  // Everything else: require the per-user session cookie. The proxy can't
  // hit the DB, so we only check presence here; full validation runs in
  // route handlers / server components via getSession().
  const session = request.cookies.get("rivlr_auth")?.value;
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
