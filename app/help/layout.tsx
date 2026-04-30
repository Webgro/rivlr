import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export default function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface text-foreground">
      <header className="border-b border-default">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/dashboard">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-4 text-xs uppercase tracking-wider font-mono text-muted">
            <Link href="/help" className="hover:text-foreground">
              Help
            </Link>
            <Link href="/dashboard" className="hover:text-foreground">
              Dashboard →
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-default mt-12">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6 text-xs text-muted font-mono flex-wrap gap-3">
          <span>© Webgro Ltd · Rivlr</span>
          <div className="flex gap-4">
            <Link href="/legal/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/legal/cookies" className="hover:text-foreground">
              Cookies
            </Link>
            <a
              href="mailto:support@rivlr.app"
              className="hover:text-foreground"
            >
              support@rivlr.app
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
