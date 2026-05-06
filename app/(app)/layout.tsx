import { Sidebar } from "@/components/sidebar";
import { CrawlProgress } from "@/components/crawl-progress";
import { CookieBanner } from "@/components/cookie-banner";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { isAdminUser } from "@/lib/auth/current-user";
import { getSession } from "@/lib/auth/session";

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
 * banner when an admin has used /admin → "Sign in as" — that banner sits
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

  return (
    <div className="min-h-screen bg-surface text-foreground">
      {impersonator && user && (
        <ImpersonationBanner
          targetEmail={user.email}
          adminEmail={impersonator.email}
        />
      )}
      <Sidebar isAdmin={isAdmin} />
      <main className="md:ml-60">{children}</main>
      {panel}
      <CrawlProgress />
      <CookieBanner />
    </div>
  );
}
