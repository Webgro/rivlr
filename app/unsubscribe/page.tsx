import Link from "next/link";
import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ token?: string }>;

/**
 * Public unsubscribe landing page. Lives outside the (app) auth gate so
 * email recipients can unsubscribe without ever signing in. Token is
 * HMAC-signed (see lib/email/unsubscribe.ts) so the link can't be forged.
 *
 * Side effects: inserts into email_unsubscribes (idempotent) AND removes
 * the address from app_settings.notification_emails so future cron sends
 * skip it without even hitting the unsubscribe filter.
 *
 * Supports GET (link click) and POST (RFC 8058 one-click) — Gmail/Outlook
 * fire a POST when the user clicks the inbox-level unsubscribe button.
 */
export default async function UnsubscribePage(props: {
  searchParams: SearchParams;
}) {
  const params = await props.searchParams;
  const token = params.token ?? "";

  const verified = verifyUnsubscribeToken(token);

  if (!verified) {
    return (
      <Wrap>
        <Heading>Link expired or invalid</Heading>
        <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
          This unsubscribe link couldn&apos;t be verified. If you no longer
          want emails from Rivlr, email{" "}
          <a
            href="mailto:support@rivlr.app?subject=Unsubscribe"
            className="text-paper underline-offset-4 hover:underline"
          >
            support@rivlr.app
          </a>{" "}
          and we&apos;ll handle it manually within 1 working day.
        </p>
      </Wrap>
    );
  }

  const email = verified.email.toLowerCase();

  // Record the unsubscribe (idempotent on PK).
  await db
    .insert(schema.emailUnsubscribes)
    .values({ email, source: "one-click" })
    .onConflictDoNothing();

  // And drop from notification_emails so the next cron skip is even cheaper.
  await db.execute(sql`
    UPDATE app_settings
    SET notification_emails = array_remove(notification_emails, ${email}),
        updated_at = NOW()
    WHERE id = 'singleton'
  `);

  return (
    <Wrap>
      <Heading>You&apos;ve unsubscribed</Heading>
      <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
        We won&apos;t send any more emails to{" "}
        <span className="font-mono text-paper">{email}</span>. If this was a
        mistake, you can re-add the address from the{" "}
        <Link
          href="/settings#alerts"
          className="text-paper underline-offset-4 hover:underline"
        >
          Settings page
        </Link>
        .
      </p>
      <div className="mt-8">
        <Link
          href="/dashboard"
          className="inline-block rounded-md bg-signal text-white px-5 py-2.5 text-sm font-medium hover:bg-red-600"
        >
          Back to Rivlr →
        </Link>
      </div>
    </Wrap>
  );
}

/**
 * Some inbox providers (notably Gmail's "Block sender" / List-Unsubscribe)
 * fire POST without rendering the page. We accept and treat as the same
 * action — record + drop from list, return 200.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const verified = verifyUnsubscribeToken(token);
  if (!verified) {
    return new Response("invalid token", { status: 400 });
  }
  const email = verified.email.toLowerCase();
  await db
    .insert(schema.emailUnsubscribes)
    .values({ email, source: "list-unsubscribe-header" })
    .onConflictDoNothing();
  await db.execute(sql`
    UPDATE app_settings
    SET notification_emails = array_remove(notification_emails, ${email}),
        updated_at = NOW()
    WHERE id = 'singleton'
  `);
  return new Response("ok", { status: 200 });
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="min-h-screen bg-[#0a0a0a] text-paper flex items-center justify-center px-6"
      data-theme="dark"
    >
      <div className="w-full max-w-md text-center">
        <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 font-mono mb-3">
          rivlr · email preferences
        </div>
        {children}
        <p className="mt-12 text-xs text-neutral-600 font-mono">
          Rivlr · a Webgro Ltd product.
        </p>
      </div>
    </main>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
      {children}
    </h1>
  );
}
