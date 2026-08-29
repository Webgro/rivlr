import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { CrawlProgress } from "@/components/crawl-progress";
import { CookieBanner } from "@/components/cookie-banner";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { isAdminUser } from "@/lib/auth/current-user";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

/**
 * Layout for everything behind the password gate. Login lives outside this
 * group so it gets a clean full-page auth screen with no sidebar.
 *
 * The @panel parallel slot is used by intercepting routes (see
 * @panel/(.)products/[id]/page.tsx) to render product detail as a slide-over
 * when navigated from within the group, while still allowing direct URLs to
 * render the standalone page.
 *
 * Reads the full session here so we can also surface the impersonation
 * banner when an admin has used /admin "Sign in as" — that banner sits
 * above the sidebar so it's impossible to miss.
 */
export default async function AppLayout({
  children,
  panel,
}: {
  children: React.ReactNode;
  panel: React.ReactNode;
}) {
  // Single getSession call — covers user + impersonator + (via isAdminUser)
  // admin status. Anonymous users never reach this layout — proxy.ts
  // redirects them to /login.
  const session = await getSession();
  const user = session?.user ?? null;
  const impersonator = session?.impersonator ?? null;
  const isAdmin = !!user && isAdminUser(user);

  // A brand-new account has nothing to show — no store, no competitors,
  // no products — so every page in here would render an empty state.
  // Guided setup gets them to something worth looking at first, and
  // sets onboardedAt on the way out (or when skipped), so this fires
  // once per account and never again. Impersonated sessions are exempt:
  // an admin dropping into an account to help should land where the
  // user is, not be handed their setup wizard.
  if (user && !user.onboardedAt && !impersonator) {
    redirect("/welcome");
  }

  return (
    <div className="min-h-screen bg-surface text-foreground">
      {impersonator && user && (
        <ImpersonationBanner
          targetEmail={user.email}
          adminEmail={impersonator.email}
        />
      )}
      <MobileNav isAdmin={isAdmin} />
      <Sidebar isAdmin={isAdmin} />
      <main className="md:ml-60">{children}</main>
      {panel}
      <CrawlProgress />
      <CookieBanner />
    </div>
  );
}
