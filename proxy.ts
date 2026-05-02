import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Phase 1 password gate.
 *
 * This is a temporary single-password lock so the owner can use Rivlr before
 * real user accounts exist. Phase 2 replaces this with Better Auth.
 *
 * - Public paths: /login, /api/auth/*, Vercel cron endpoints, _next assets
 * - Everything else requires the `rivlr_session` cookie to match SESSION_TOKEN.
 *
 * In Next.js 16, this file is `proxy.ts` (renamed from `middleware.ts`) and
 * the function is named `proxy`. Runtime is Node.js.
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

  // Cron endpoints authenticated by Vercel's CRON_SECRET, not by the cookie.
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

  // Everything else: must have either the new per-user session cookie
  // OR the legacy single-password cookie. Both are accepted during the
  // Phase 3 cutover; legacy is removed in commit 3.
  const newSession = request.cookies.get("rivlr_auth")?.value;
  const legacySession = request.cookies.get("rivlr_session")?.value;
  const expected = process.env.SESSION_TOKEN;
  const authedNew = !!newSession; // proxy can't hit DB; full validation in route handlers
  const authedLegacy =
    !!legacySession && !!expected && legacySession === expected;
  const authed = authedNew || authedLegacy;

  if (!authed) {
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
