import { redirect } from "next/navigation";
import { cookies } from "next/headers";

type SearchParams = Promise<{ next?: string; error?: string }>;

async function login(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  const expected = process.env.APP_PASSWORD;
  const sessionToken = process.env.SESSION_TOKEN;

  if (!expected || !sessionToken) {
    redirect("/login?error=missing_env");
  }

  if (password !== expected) {
    redirect("/login?error=wrong_password");
  }

  const cookieStore = await cookies();
  cookieStore.set("rivlr_session", sessionToken!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  redirect(next.startsWith("/") ? next : "/dashboard");
}

export default async function LoginPage(props: { searchParams: SearchParams }) {
  const { next = "/dashboard", error } = await props.searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <span className="inline-flex items-baseline gap-1.5 text-xl font-semibold tracking-tight text-ink">
            rivlr
            <span className="h-2 w-2 rounded-full bg-signal inline-block translate-y-[-1px]" aria-hidden />
          </span>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Enter the access password to continue.
        </p>

        <form action={login} className="mt-8 space-y-4">
          <input type="hidden" name="next" value={next} />
          <div>
            <label
              htmlFor="password"
              className="block text-xs uppercase tracking-wider text-neutral-500 font-mono"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoFocus
              required
              className="mt-2 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink"
            />
          </div>

          {error === "wrong_password" && (
            <p className="text-sm text-signal">Incorrect password.</p>
          )}
          {error === "missing_env" && (
            <p className="text-sm text-signal">
              Server misconfigured: set <code>APP_PASSWORD</code> and{" "}
              <code>SESSION_TOKEN</code> in Vercel.
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-neutral-800"
          >
            Sign in
          </button>
        </form>

        <p className="mt-10 text-xs text-neutral-500">
          rivlr — a Webgro product
        </p>
      </div>
    </main>
  );
}
