import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current-user";
import { CreateUserForm } from "./create-user-form";

export const metadata = { title: "New user · Admin · Rivlr" };
export const dynamic = "force-dynamic";

/**
 * Admin-only "create a user on behalf of a prospect" form. Used for
 * the demo / sales motion: spin up an account, comp them to unlimited,
 * use the impersonation flow to populate it, then send the prospect a
 * sign-in link to take ownership.
 */
export default async function AdminNewUserPage() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="text-xs text-muted">
        <Link
          href="/admin/users"
          className="text-foreground underline-offset-4 hover:underline"
        >
          ← All users
        </Link>
      </div>

      <header className="mt-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Create user on behalf
        </h1>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Set up an account for a prospect. After creating, use{" "}
          <strong>Sign in as user</strong> to populate it during the demo,
          then <strong>Send sign-in link</strong> when you&apos;re ready to
          hand it over. The prospect lands on a normal sign-in flow — no
          weird "account set up by Webgro" framing.
        </p>
      </header>

      <CreateUserForm />
    </main>
  );
}
