import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Sign up · Rivlr" };

type SearchParams = Promise<{ source?: string; url?: string }>;

export default async function SignupPage(props: { searchParams: SearchParams }) {
  const { source, url } = await props.searchParams;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-paper" data-theme="dark">
      <header className="border-b border-neutral-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Wordmark />
          </Link>
          <Link
            href="/"
            className="text-xs uppercase tracking-wider text-neutral-400 hover:text-paper font-mono"
          >
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-16">
        <div className="text-center">
          <span className="inline-block rounded-full bg-signal/10 border border-signal/30 px-3 py-1 text-[11px] uppercase tracking-wider text-signal font-mono">
            Pre-launch · join the waitlist
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">
            Be first when Rivlr opens.
          </h1>
          <p className="mt-3 text-sm text-neutral-400">
            We&apos;re finishing the multi-user version and rolling out access
            to the waitlist over the next few weeks. Early signups get a
            month free and locked-in pricing for the first year.
          </p>
        </div>

        <div className="mt-10">
          <SignupForm
            source={source ?? "signup"}
            initialStoreUrl={url ?? ""}
          />
        </div>

        <div className="mt-12 rounded-xl border border-neutral-800 bg-[#141414] p-5 text-xs text-neutral-400">
          <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono mb-2">
            What you&apos;re signing up for
          </div>
          <ul className="space-y-1.5 leading-relaxed">
            <li>· Early access ahead of public launch</li>
            <li>· One month free on any paid tier when launched</li>
            <li>· Founding-customer pricing locked for 12 months</li>
            <li>· Direct line to the team for feedback &amp; feature requests</li>
          </ul>
        </div>

        <p className="mt-8 text-center text-xs text-neutral-500 font-mono">
          By joining you agree to our{" "}
          <Link href="/legal/terms" className="underline hover:text-paper">
            Terms
          </Link>{" "}
          &amp;{" "}
          <Link href="/legal/privacy" className="underline hover:text-paper">
            Privacy Policy
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
