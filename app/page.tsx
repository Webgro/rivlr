/**
 * Phase 1 root.
 *
 * Today this just redirects to /dashboard (handled in proxy.ts to avoid a
 * double redirect for authenticated users). When Phase 5 lands, this becomes
 * the public marketing landing page.
 */
import { redirect } from "next/navigation";

export default function RootPage() {
  // Belt-and-braces — proxy.ts handles this server-side, but if anything
  // ever bypasses it, redirect from here too.
  redirect("/dashboard");
}
