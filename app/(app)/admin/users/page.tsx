import Link from "next/link";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/current-user";

export const metadata = { title: "Users · Admin · Rivlr" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = Promise<{ q?: string; page?: string }>;

type UserRow = {
  id: string;
  email: string;
  created_at: string;
  last_login_at: string | null;
  is_admin: boolean;
  comp_plan: string | null;
  plan: string | null;
  status: string | null;
  cancel_at_period_end: boolean | null;
  product_count: number;
  [key: string]: unknown;
};

export default async function AdminUsersPage(props: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const params = await props.searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const q = params.q?.trim().toLowerCase() ?? "";
  const offset = (page - 1) * PAGE_SIZE;

  // One query for the user list with each user's subscription summary
  // and product count joined. LEFT JOINs because most users won't
  // have a subscription row.
  const rows = await db.execute<UserRow>(sql`
    SELECT
      u.id,
      u.email,
      u.created_at,
      u.last_login_at,
      u.is_admin,
      u.comp_plan,
      s.plan,
      s.status,
      s.cancel_at_period_end,
      COALESCE(p.n, 0)::int AS product_count
    FROM users u
    LEFT JOIN subscriptions s ON s.user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*)::int AS n
      FROM tracked_products
      WHERE active = true
      GROUP BY user_id
    ) p ON p.user_id = u.id
    ${q ? sql`WHERE LOWER(u.email) LIKE ${"%" + q + "%"}` : sql``}
    ORDER BY u.created_at DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `);

  const [{ count: totalCount }] = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count FROM users
    ${q ? sql`WHERE LOWER(email) LIKE ${"%" + q + "%"}` : sql``}
  `);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted">
            {totalCount} total · page {page} of {totalPages}
          </p>
        </div>
        <form method="get" className="flex items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by email…"
            className="rounded-md border border-default bg-elevated px-3 py-1.5 text-sm text-foreground outline-none focus:border-strong w-72"
          />
          <button
            type="submit"
            className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-surface hover:opacity-90 transition"
          >
            Search
          </button>
          {q && (
            <Link
              href="/admin/users"
              className="text-xs text-muted hover:text-foreground transition"
            >
              Clear
            </Link>
          )}
        </form>
      </header>

      <div className="mt-6 rounded-lg border border-default bg-elevated overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-[0.15em] text-muted/70 font-mono">
            <tr className="border-b border-default">
              <Th>Email</Th>
              <Th>Plan</Th>
              <Th>Status</Th>
              <Th>Products</Th>
              <Th>Joined</Th>
              <Th>Last seen</Th>
              <Th className="text-right">Action</Th>
            </tr>
          </thead>
          <tbody>
            {Array.from(rows).map((u) => (
              <tr
                key={u.id}
                className="border-b border-default last:border-b-0 hover:bg-surface transition"
              >
                <Td>
                  <span className="font-mono">{u.email}</span>
                  {u.is_admin && (
                    <span className="ml-2 rounded bg-signal/15 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-signal font-mono">
                      admin
                    </span>
                  )}
                </Td>
                <Td>
                  <PlanBadge plan={u.plan} compPlan={u.comp_plan} />
                </Td>
                <Td>
                  <StatusBadge
                    status={u.status}
                    cancelAtPeriodEnd={u.cancel_at_period_end}
                  />
                </Td>
                <Td>
                  <span className="font-mono">{u.product_count}</span>
                </Td>
                <Td>{formatDate(u.created_at)}</Td>
                <Td>
                  {u.last_login_at ? formatDate(u.last_login_at) : "—"}
                </Td>
                <Td className="text-right">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="text-xs text-foreground underline-offset-4 hover:underline"
                  >
                    Open →
                  </Link>
                </Td>
              </tr>
            ))}
            {Array.from(rows).length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-8 text-center text-sm text-muted"
                >
                  No users matched.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination basePath="/admin/users" q={q} page={page} totalPages={totalPages} />
      )}
    </main>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-left font-normal ${className}`}>{children}</th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

function PlanBadge({
  plan,
  compPlan,
}: {
  plan: string | null;
  compPlan: string | null;
}) {
  const effective = compPlan ?? plan ?? "free";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono uppercase tracking-wider text-xs">
        {effective}
      </span>
      {compPlan && (
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-amber-500 font-mono">
          comp
        </span>
      )}
    </span>
  );
}

function StatusBadge({
  status,
  cancelAtPeriodEnd,
}: {
  status: string | null;
  cancelAtPeriodEnd: boolean | null;
}) {
  if (!status) {
    return <span className="text-xs text-muted">—</span>;
  }
  const ok = status === "active" || status === "trialing";
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span
        className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] font-mono ${
          ok
            ? "bg-green-500/15 text-green-500"
            : status === "past_due"
              ? "bg-signal/15 text-signal"
              : "bg-surface text-muted border border-default"
        }`}
      >
        {status}
      </span>
      {cancelAtPeriodEnd && (
        <span className="rounded bg-signal/15 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-signal font-mono">
          ending
        </span>
      )}
    </span>
  );
}

function Pagination({
  basePath,
  q,
  page,
  totalPages,
}: {
  basePath: string;
  q: string;
  page: number;
  totalPages: number;
}) {
  function url(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  }
  return (
    <div className="mt-6 flex items-center justify-center gap-3 text-xs text-muted">
      {page > 1 ? (
        <Link
          href={url(page - 1)}
          className="text-foreground underline-offset-4 hover:underline"
        >
          ← Prev
        </Link>
      ) : (
        <span className="opacity-40">← Prev</span>
      )}
      <span>
        Page {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={url(page + 1)}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Next →
        </Link>
      ) : (
        <span className="opacity-40">Next →</span>
      )}
    </div>
  );
}

function formatDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
