import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createMagicLink } from "@/lib/auth/magic-link";
import { sendMagicLinkEmail } from "@/lib/auth/send-magic-link";

type SearchParams = Promise<{
  next?: string;
  sent?: string;
  error?: string;
  email?: string;
}>;

/**
 * Sign-in page. Single field, magic-link-only auth — no passwords.
 *
 * Flow:
 *  1. User enters email
 *  2. Server action creates a magic link, fires it via Resend, redirects
 *     back to /login?sent=1&email=<masked>
 *  3. User clicks the link in their email → /auth/verify?token=...
 *  4. /auth/verify creates a session, drops them on /dashboard
 *
 * Auto-creates an account on first sign-in for a new email — no separate
 * signup screen. Same form serves both flows.
 */
async function sendLoginLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email) {
    redirect(`/login?error=invalid-email`);
  }

  const result = await createMagicLink({ email, redirectTo: next });
  if (!result.ok) {
    if (result.error === "rate-limited") {
      redirect(`/login?error=rate-limited&email=${encodeURIComponent(email)}`);
    }
    redirect(`/login?error=invalid-email`);
  }

  // Build the absolute URL — needs the request's host because rivlr.app
  // can be reached via custom domain or a vercel preview URL.
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "rivlr.app";
  const url = `${proto}://${host}/auth/verify?token=${result.token}`;

  // Always show "check your inbox" regardless of send success — email-
  // enumeration protection. Never confirm whether an address exists.
  await sendMagicLinkEmail({
    email,
    url,
    expiresInMinutes: 15,
  });

  redirect(`/login?sent=1&email=${encodeURIComponent(email)}`);
}

export default async function LoginPage(props: { searchParams: SearchParams }) {
  const { next = "/dashboard", sent, error, email } = await props.searchParams;

  return (
    <main
      className="min-h-screen bg-[#0a0a0a] text-paper flex items-center justify-center px-6"
      data-theme="dark"
    >
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <span className="inline-flex items-baseline gap-1.5 text-xl font-semibold tracking-tight text-paper">
            rivlr
            <span className="h-2 w-2 rounded-full bg-signal inline-block translate-y-[-1px]" aria-hidden />
          </span>
        </div>

        {sent === "1" ? (
          <CheckYourInbox email={email ?? ""} next={next} />
        ) : (
          <SignInForm
            next={next}
            error={error}
            initialEmail={email}
            action={sendLoginLink}
          />
        )}

        <p className="mt-12 text-xs text-neutral-600 font-mono">
          rivlr · a Webgro product
        </p>
      </div>
    </main>
  );
}

function SignInForm({
  next,
  error,
  initialEmail,
  action,
}: {
  next: string;
  error: string | undefined;
  initialEmail: string | undefined;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-paper">
        Sign in
      </h1>
      <p className="mt-1 text-sm text-neutral-400">
        We&apos;ll email you a one-time link. No password needed.
      </p>

      <form action={action} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label
            htmlFor="email"
            className="block text-xs uppercase tracking-wider text-neutral-500 font-mono"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            defaultValue={initialEmail ?? ""}
            placeholder="you@example.com"
            className="mt-2 block w-full rounded-md border border-neutral-700 bg-[#141414] px-3 py-2.5 text-sm text-paper placeholder-neutral-600 outline-none focus:border-signal/60 focus:ring-1 focus:ring-signal/40"
          />
        </div>

        {error === "invalid-email" && (
          <p className="text-sm text-signal">
            That email doesn&apos;t look right. Try again.
          </p>
        )}
        {error === "rate-limited" && (
          <p className="text-sm text-signal">
            Too many sign-in requests. Wait a moment, then try again.
          </p>
        )}
        {error === "not-invited" && (
          <p className="text-sm text-signal">
            That email isn&apos;t on any Rivlr account. Ask the account
            owner to invite you from <span className="font-mono">Settings → Team</span>.
          </p>
        )}
        {(error === "expired" || error === "used" || error === "invalid") && (
          <p className="text-sm text-signal">
            {error === "expired"
              ? "That link has expired. Get a fresh one below."
              : error === "used"
                ? "That link was already used. Get a fresh one below."
                : "Invalid sign-in link. Get a fresh one below."}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-md bg-signal px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-600"
        >
          Send sign-in link →
        </button>
      </form>

      <p className="mt-6 text-xs text-neutral-500 leading-relaxed">
        First time here? Just enter your email — we&apos;ll create your
        account when you click the link.
      </p>
    </>
  );
}

function CheckYourInbox({ email, next }: { email: string; next: string }) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight text-paper">
        Check your inbox
      </h1>
      <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
        We sent a sign-in link to{" "}
        <span className="text-paper font-mono">{email}</span>. Click the
        link in the email to continue. It expires in 15 minutes and works
        once.
      </p>
      <p className="mt-6 text-xs text-neutral-500 leading-relaxed">
        Email not arrived in a minute or two? Check spam, or{" "}
        <a
          href={`/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}`}
          className="text-paper underline-offset-4 hover:underline"
        >
          try again
        </a>
        .
      </p>
    </>
  );
}
