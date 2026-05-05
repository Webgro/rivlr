import { requireUser } from "@/lib/auth/current-user";
import { listTeamMembers } from "./team-actions";
import { TeamPanel } from "./team-panel";
import { getCurrentPlan, PLAN_FEATURES } from "@/lib/plan";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile · Rivlr" };

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const teamMembers = await listTeamMembers();
  const plan = await getCurrentPlan();
  const planFeatures = PLAN_FEATURES[plan];

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted">
          Your account, sign-in access, and team. Anything that affects how
          Rivlr crawls or alerts lives in{" "}
          <a
            href="/settings"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Settings
          </a>
          .
        </p>

      </header>

      <nav className="sticky top-0 z-10 -mx-6 px-6 mt-6 py-3 bg-surface/90 backdrop-blur border-b border-default flex flex-wrap gap-2 text-xs">
        <SectionLink href="#account" label="Account" />
        <SectionLink href="#team" label="Team access" />
      </nav>

      {/* ─── Account ─────────────────────────────────────────────────── */}
      <SectionHeading id="account" title="Account" />
      <section className="mt-6 rounded-lg border border-default bg-elevated p-5">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
          <Field label="Primary email" value={user.email} mono />
          <Field
            label="Plan"
            value={
              <span className="inline-flex items-center gap-2">
                <span className="font-mono uppercase tracking-wider">
                  {plan}
                </span>
                <span className="text-[11px] text-muted">
                  {planFeatures.productLimit
                    ? `${planFeatures.productLimit} products`
                    : "unlimited"}
                </span>
              </span>
            }
          />
          <Field
            label="Joined"
            value={user.createdAt.toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          />
          <Field
            label="Last sign-in"
            value={
              user.lastLoginAt
                ? user.lastLoginAt.toLocaleString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"
            }
          />
        </dl>

        <div className="mt-6 pt-5 border-t border-default flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted">
            Signed in via magic link. Sessions last 30 days and renew on
            every visit.
          </p>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-md border border-default bg-surface px-3.5 py-1.5 text-xs font-medium text-foreground hover:border-strong transition"
            >
              Sign out
            </button>
          </form>
        </div>
      </section>

      {/* ─── Team access ─────────────────────────────────────────────── */}
      <SectionHeading id="team" title="Team access" />
      <section className="mt-6">
        <p className="text-sm text-muted leading-relaxed">
          Share this Rivlr account with staff or partners. Each invited
          email gets its own magic-link sign-in into <em>your</em> account
          — same products, same stores, same data. Up to 10 additional
          emails per account.
        </p>
        <TeamPanel initial={teamMembers} />
      </section>
    </main>
  );
}

function SectionLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-md border border-default bg-elevated px-3 py-1.5 hover:border-strong transition"
    >
      {label}
    </a>
  );
}

function SectionHeading({ id, title }: { id: string; title: string }) {
  return (
    <div id={id} className="mt-12 pt-2 border-t border-default scroll-mt-6">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted/70 font-mono mt-4">
        {title}
      </div>
    </div>
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
      <dt className="text-[10px] uppercase tracking-[0.18em] text-muted/70 font-mono">
        {label}
      </dt>
      <dd className={`mt-1.5 text-foreground ${mono ? "font-mono text-sm" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
