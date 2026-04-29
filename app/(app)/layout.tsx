import { Sidebar } from "@/components/sidebar";
import { CrawlProgress } from "@/components/crawl-progress";

/**
 * Layout for everything behind the password gate. Login lives outside this
 * group so it gets a clean full-page auth screen with no sidebar.
 *
 * The @panel parallel slot is used by intercepting routes (see
 * @panel/(.)products/[id]/page.tsx) to render product detail as a slide-over
 * when navigated from within the group, while still allowing direct URLs to
 * render the standalone page.
 */
export default function AppLayout({
  children,
  panel,
}: {
  children: React.ReactNode;
  panel: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface text-foreground">
      <Sidebar />
      <main className="md:ml-56">{children}</main>
      {panel}
      <CrawlProgress />
    </div>
  );
}
