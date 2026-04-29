import { Sidebar } from "@/components/sidebar";

/**
 * Layout for everything behind the password gate (dashboard, products,
 * settings). Login lives outside this group so it gets a clean full-page
 * auth screen with no sidebar.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface text-foreground">
      <Sidebar />
      <main className="md:ml-56">{children}</main>
    </div>
  );
}
