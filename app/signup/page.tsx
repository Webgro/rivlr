import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { SignupForm } from "./signup-form";
import { PLAN_PRODUCTS } from "@/lib/pricing";

export const metadata = { title: "Sign up · Rivlr" };

type SearchParams = Promise<{
  source?: string;
  url?: string;
  sent?: string;
  email?: string;
}>;

export default async function SignupPage(props: { searchParams: SearchParams }) {
  const { url, sent, email } = await props.searchParams;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-paper" data-theme="dark">
      <header className="border-b border-neutral-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Wordmark />
          </Link>
          <Link
            href="/login"
            className="text-xs uppercase tracking-wider text-neutral-400 hover:text-paper font-mono"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-16">
        {sent === "1" ? (
          <CheckYourInbox email={email ?? ""} />
        ) : (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-semibold tracking-tight">
                Start tracking your competitors.
              </h1>
              <p className="mt-3 text-sm text-neutral-400">
                Free for {PLAN_PRODUCTS.free} products. No card needed, and
                nothing to install on your store.
              </p>
            </div>

            <div className="mt-10">
              <SignupForm initialStoreUrl={url ?? ""} />
            </div>

            <div className="mt-12 rounded-xl border border-neutral-800 bg-[#141414] p-5 text-xs text-neutral-400">
              <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono mb-2">
                What happens next
              </div>
              <ul className="space-y-1.5 leading-relaxed">
                <li>· Tell us your store and one competitor</li>
                <li>· We find the products you both sell and link them up</li>
                <li>· You get an email when their price or stock changes</li>
              </ul>
            </div>

            <p className="mt-8 text-center text-xs text-neutral-500 font-mono">
              By signing up you agree to our{" "}
              <Link href="/legal/terms" className="underline hover:text-paper">
                Terms
              </Link>{" "}
              &amp;{" "}
              <Link
                href="/legal/privacy"
                className="underline hover:text-paper"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function CheckYourInbox({ email }: { email: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#141414] p-6 text-center">
      <div className="text-3xl">✓</div>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">
        Check your inbox
      </h1>
      <p className="mt-2 text-sm text-neutral-400">
        We&apos;ve sent a sign-in link to{" "}
        <span className="font-mono text-paper">{email}</span>. It works once
        and expires in 15 minutes.
      </p>
      <p className="mt-4 text-xs text-neutral-600">
        Nothing arrived? Check spam, or{" "}
        <Link href="/signup" className="underline hover:text-paper">
          try a different address
        </Link>
        .
      </p>
    </div>
  );
}
