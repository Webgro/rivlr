import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/current-user";
import { CompPlanForm } from "./comp-plan-form";
import { AdminToggleForm } from "./admin-toggle-form";
import { AdminDeleteUserButton } from "./admin-delete-user-button";
import { HandoverCard } from "./handover-card";

export const metadata = { title: "User · Admin · Rivlr" };
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const UUID_RX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminUserDetailPage(props: { params: Params }) {
  const me = await requireAdmin();
  const { id } = await props.params;
  if (!UUID_RX.test(id)) notFound();

  const [target] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  if (!target) notFound();

  const [subscription] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, id))
    .limit(1);

  const [counts] = await db.execute<{
    products: number;
    stores: number;
    discoveries: number;
    additional_emails: number;
  }>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM tracked_products
        WHERE user_id = ${id}::uuid AND active = true) AS products,
      (SELECT COUNT(DISTINCT store_domain)::int FROM tracked_products
        WHERE user_id = ${id}::uuid AND active = true) AS stores,
      (SELECT COUNT(*)::int FROM discovered_products
        WHERE user_id = ${id}::uuid AND status = 'new') AS discoveries,
      (SELECT COUNT(*)::int FROM user_emails WHERE user_id = ${id}::uuid)
        AS additional_emails
  `);

  const auditEntries = await db
    .select()
    .from(schema.adminAuditLog)
    .where(eq(schema.adminAuditLog.targetUserId, id))
    .orderBy(desc(schema.adminAuditLog.occurredAt))
    .limit(50);

  const isSelf = me.id === target.id;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="text-xs text-muted">
        <Link
          href="/admin/users"
          className="text-foreground underline-offset-4 hover:underline"
        >
          ← All users
        </Link>
      </div>

      <header className="mt-3 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight font-mono">
            {target.email}
          </h1>
          <p className="mt-1 text-xs text-muted font-mono">{target.id}</p>
          {target.isAdmin && (
            <span className="mt-2 inline-block rounded bg-signal/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-signal font-mono">
              admin
            </span>
          )}
        </div>
        {!isSelf && (
          <form
            action="/api/admin/impersonate"
            method="post"
            className="flex-shrink-0"
          >
            <input type="hidden" name="user-id" value={target.id} />
            <button
              type="submit"
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-xs font-medium text-amber-500 hover:bg-amber-500/20 transition"
              title="Drop your session and sign in as this user. A banner stays visible across the app until you stop."
            >
              Sign in as user
            </button>
          </form>
        )}
      </header>


      {/* ─── Account facts ───────────────────────────────────────────── */}
      <section className="mt-8 rounded-lg border border-default bg-elevated p-5">
        <div className="text-xs font-medium text-muted">
          Account
        </div>
        <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <Field label="Joined" value={formatDate(target.createdAt)} />
          <Field
            label="Last sign-in"
            value={
              target.lastLoginAt ? formatDateTime(target.lastLoginAt) : "—"
            }
          />
          <Field
            label="Email verified"
            value={
              target.emailVerifiedAt
                ? formatDateTime(target.emailVerifiedAt)
                : "—"
            }
          />
          <Field
            label="Stripe customer"
            value={target.stripeCustomerId ?? "—"}
            mono
          />
        </dl>
      </section>

      {/* ─── Usage ───────────────────────────────────────────────────── */}
      <section className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Tracked products" value={counts?.products ?? 0} />
        <Stat label="Stores" value={counts?.stores ?? 0} />
        <Stat label="New discoveries" value={counts?.discoveries ?? 0} />
        <Stat label="Team emails" value={counts?.additional_emails ?? 0} />
      </section>

      {/* ─── Subscription ────────────────────────────────────────────── */}
      <section className="mt-6 rounded-lg border border-default bg-elevated p-5">
        <div className="text-xs font-medium text-muted">
          Subscription
        </div>
        {subscription ? (
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <Field
              label="Stripe sub id"
              value={subscription.stripeSubscriptionId ?? "—"}
              mono
            />
            <Field
              label="Plan"
              value={subscription.plan.toUpperCase()}
              mono
            />
            <Field label="Status" value={subscription.status} mono />
            <Field
              label="Cancel at period end"
              value={subscription.cancelAtPeriodEnd ? "Yes" : "No"}
            />
            <Field label="Overage packs" value={subscription.overagePacks} />
            <Field
              label="Period ends"
              value={
                subscription.currentPeriodEnd
                  ? formatDate(subscription.currentPeriodEnd)
                  : "—"
              }
            />
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted">
            No Stripe subscription. Resolves as <strong>free</strong> unless
            comped (see below).
          </p>
        )}
      </section>

      {/* ─── Comp plan ───────────────────────────────────────────────── */}
      <section className="mt-6 rounded-lg border border-default bg-elevated p-5">
        <div className="text-xs font-medium text-muted">
          Comp plan (admin override)
        </div>
        <p className="mt-2 text-xs text-muted leading-relaxed">
          Sets the plan resolver to return this value regardless of Stripe
          state. Useful for strategic customers, trial extensions, or
          fixing post-incident drift. Stripe billing is unaffected, set or
          unset on Stripe&apos;s side separately if needed.
        </p>
        {target.compPlan && (
          <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/[0.05] p-3 text-xs">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <span className="font-mono uppercase tracking-wider">
                  {target.compPlan}
                </span>
                <span className="ml-2 text-muted">
                  · set{" "}
                  {target.compSetAt
                    ? formatDateTime(target.compSetAt)
                    : "?"}
                </span>
              </div>
            </div>
            {target.compReason && (
              <div className="mt-1.5 text-muted leading-relaxed">
                &ldquo;{target.compReason}&rdquo;
              </div>
            )}
          </div>
        )}
        <div className="mt-4">
          <CompPlanForm
            userId={target.id}
            currentComp={target.compPlan ?? null}
          />
        </div>
      </section>

      {/* ─── Handover (send sign-in link) ────────────────────────────── */}
      {!isSelf && (
        <HandoverCard
          userId={target.id}
          email={target.email}
          lastLoginAt={target.lastLoginAt}
        />
      )}

      {/* ─── Admin role ──────────────────────────────────────────────── */}
      <section className="mt-6 rounded-lg border border-default bg-elevated p-5">
        <div className="text-xs font-medium text-muted">
          Admin role
        </div>
        <p className="mt-2 text-xs text-muted leading-relaxed">
          Promote a user to admin so they can use this section. Self-demotion
          is allowed but locks you out, recover via the ADMIN_USER_IDS
          env var.
        </p>
        <div className="mt-4">
          <AdminToggleForm
            userId={target.id}
            isAdmin={target.isAdmin}
            isSelf={isSelf}
          />
        </div>
      </section>

      {/* ─── Audit log ───────────────────────────────────────────────── */}
      <section className="mt-6 rounded-lg border border-default bg-elevated overflow-hidden">
        <div className="px-5 py-3 border-b border-default text-xs font-medium text-muted">
          Audit log (last 50)
        </div>
        {auditEntries.length === 0 ? (
          <div className="px-5 py-4 text-sm text-muted">
            No admin actions recorded against this user yet.
          </div>
        ) : (
          <ul className="divide-y divide-default text-sm">
            {auditEntries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start gap-3 px-5 py-3"
              >
                <span className="rounded bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-strong border border-default flex-shrink-0">
                  {entry.action}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted">
                    by{" "}
                    <span className="font-mono text-foreground">
                      {entry.actorEmail}
                    </span>{" "}
                    · {formatDateTime(entry.occurredAt)}
                  </div>
                  {entry.payload && Object.keys(entry.payload).length > 0 && (
                    <pre className="mt-1 text-[11px] text-muted font-mono whitespace-pre-wrap break-words">
                      {JSON.stringify(entry.payload, null, 2)}
                    </pre>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ─── Danger zone ─────────────────────────────────────────────── */}
      <section className="mt-6 rounded-lg border border-signal/30 bg-signal/[0.03] p-5">
        <div className="text-xs font-semibold text-signal">
          Danger zone
        </div>
        <h3 className="mt-2 text-lg font-semibold tracking-tight">
          Delete this user
        </h3>
        <p className="mt-1.5 text-xs text-muted leading-relaxed">
          Cancels their Stripe subscription, deletes their Stripe customer,
          removes every product / setting / observation / discovery / team
          email tied to their account. Audit log entries persist (FK
          retention is set null + email captured at write time). No undo.
        </p>
        <div className="mt-4">
          <AdminDeleteUserButton
            userId={target.id}
            email={target.email}
            isSelf={isSelf}
          />
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-muted">
        {label}
      </dt>
      <dd
        className={`mt-1 text-foreground ${mono ? "font-mono text-xs break-all" : "text-sm"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-default bg-elevated p-4">
      <div className="text-[11px] font-medium text-muted">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tracking-tight">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
