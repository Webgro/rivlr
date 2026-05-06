import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current-user";

/**
 * Admin section gate. Every page nested under /admin runs this layout
 * first; non-admins are redirected to /dashboard. Renders a
 * one-line strip across the top so admins never forget which surface
 * they're on (mistaking /admin for /dashboard during a destructive
 * operation would be bad).
 */
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div>
      <div className="border-b border-signal/30 bg-signal/[0.04] px-6 py-2 text-[11px] uppercase tracking-[0.2em] font-mono text-signal flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span>Admin</span>
          <span className="text-muted">·</span>
          <Link
            href="/admin"
            className="text-signal/80 hover:text-signal transition"
          >
            Overview
          </Link>
          <Link
            href="/admin/users"
            className="text-signal/80 hover:text-signal transition"
          >
            Users
          </Link>
        </div>
        <Link
          href="/dashboard"
          className="text-muted/80 hover:text-foreground transition normal-case tracking-normal text-xs"
        >
          ← Exit admin
        </Link>
      </div>
      {children}
    </div>
  );
}
