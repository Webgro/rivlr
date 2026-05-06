import { Sidebar } from "@/components/sidebar";
import { CrawlProgress } from "@/components/crawl-progress";
import { CookieBanner } from "@/components/cookie-banner";
import { getCurrentUser, isAdminUser } from "@/lib/auth/current-user";

/**
 * Layout for everything behind the password gate. Login lives outside this
 * group so it gets a clean full-page auth screen with no sidebar.
 *
 * The @panel parallel slot is used by intercepting routes (see
 * @panel/(.)products/[id]/page.tsx) to render product detail as a slide-over
 * when navigated from within the group, while still allowing direct URLs to
 * render the standalone page.
 */
export default async function AppLayout({
  children,
  panel,
}: {
  children: React.ReactNode;
  panel: React.ReactNode;
}) {
  // Resolve admin status server-side so the (client) sidebar can render
  // the /admin link without an extra DB call. Anonymous users never reach
  // this layout — proxy.ts redirects them to /login.
  const user = await getCurrentUser();
  const isAdmin = !!user && isAdminUser(user);

  return (
    <div className="min-h-screen bg-surface text-foreground">
      <Sidebar isAdmin={isAdmin} />
      <main className="md:ml-60">{children}</main>
      {panel}
      <CrawlProgress />
      <CookieBanner />
    </div>
  );
}
