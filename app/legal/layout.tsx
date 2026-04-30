import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

/**
 * Public-facing layout for /legal/* pages — no sidebar, no auth requirement,
 * lighter chrome appropriate for sharing externally.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface text-foreground">
      <header className="border-b border-default">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/dashboard">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-4 text-xs uppercase tracking-wider font-mono text-muted">
            <Link href="/legal/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/legal/cookies" className="hover:text-foreground">
              Cookies
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-default mt-12">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6 text-xs text-muted font-mono">
          <span>© Webgro Ltd · Rivlr</span>
          <span>support@rivlr.app</span>
        </div>
      </footer>
    </div>
  );
}
