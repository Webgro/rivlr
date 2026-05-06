import Link from "next/link";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/current-user";

export const metadata = { title: "Admin · Rivlr" };
export const dynamic = "force-dynamic";

/**
 * Admin overview — small dashboard showing the headline numbers a
 * founder cares about: how many accounts, how many on each plan,
 * how many tracked products in total. Cheap aggregate query; no
 * heavy joins yet.
 */
export default async function AdminOverviewPage() {
  await requireAdmin();

  const [counts] = await db.execute<{
    total_users: number;
    total_admins: number;
    total_tracked: number;
    total_subs: number;
    active_subs: number;
    canceling_subs: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS total_users,
      (SELECT COUNT(*)::int FROM users WHERE is_admin = true) AS total_admins,
      (SELECT COUNT(*)::int FROM tracked_products WHERE active = true) AS total_tracked,
      (SELECT COUNT(*)::int FROM subscriptions) AS total_subs,
      (SELECT COUNT(*)::int FROM subscriptions WHERE status IN ('active','trialing')) AS active_subs,
      (SELECT COUNT(*)::int FROM subscriptions WHERE cancel_at_period_end = true) AS canceling_subs
  `);

  const planBreakdown = await db.execute<{ plan: string; n: number }>(sql`
    SELECT plan, COUNT(*)::int AS n
    FROM subscriptions
    WHERE status IN ('active','trialing')
    GROUP BY plan
    ORDER BY n DESC
  `);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Admin overview
        </h1>
        <p className="mt-1 text-sm text-muted">
          Headline numbers across the whole product. Drill into{" "}
          <Link
            href="/admin/users"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Users
          </Link>{" "}
          for per-account view + actions.
        </p>
      </header>

      <section className="mt-8 grid gap-4 grid-cols-2 md:grid-cols-3">
        <Stat label="Users" value={counts?.total_users ?? 0} />
        <Stat label="Admins" value={counts?.total_admins ?? 0} />
        <Stat label="Tracked products" value={counts?.total_tracked ?? 0} />
        <Stat
          label="Subscriptions (any state)"
          value={counts?.total_subs ?? 0}
        />
        <Stat label="Active / trialing" value={counts?.active_subs ?? 0} />
        <Stat
          label="Cancelling at period end"
          value={counts?.canceling_subs ?? 0}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold tracking-tight">
          Plan breakdown (active + trialing)
        </h2>
        <div className="mt-3 rounded-lg border border-default bg-elevated overflow-hidden">
          {planBreakdown.length === 0 ? (
            <div className="px-5 py-4 text-sm text-muted">
              No active subscriptions yet.
            </div>
          ) : (
            <ul className="divide-y divide-default">
              {Array.from(planBreakdown).map((p) => (
                <li
                  key={p.plan}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <span className="font-mono uppercase tracking-wider">
                    {p.plan}
                  </span>
                  <span className="text-muted">{p.n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-default bg-elevated p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted/70 font-mono">
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight">
        {value.toLocaleString()}
      </div>
    </div>
  );
}
