import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current-user";
import { destroyCurrentSession } from "@/lib/auth/session";
import {
  cancelSubscriptionImmediately,
  deleteStripeCustomer,
} from "@/lib/billing";

/**
 * POST /api/account/delete
 *
 * Hard-deletes the current user account. Sequence:
 *   1. Cancel Stripe subscription immediately (no refund, no final
 *      invoice). Best-effort — failures don't block deletion.
 *   2. Delete Stripe customer (right-to-be-forgotten). Best-effort.
 *   3. Delete users row. ON DELETE CASCADE removes everything
 *      keyed off user_id: subscriptions, sessions, products, settings,
 *      tags, groups, link suggestions, discoveries, user_emails, etc.
 *   4. Destroy the current session cookie (the row was already cascaded).
 *   5. Redirect to /login?deleted=1.
 *
 * Confirmation gate: the form must POST a `confirm-email` field that
 * matches the signed-in user's email exactly. This is the typed-
 * confirmation friction — server-side enforcement so a malformed
 * client-side state can't accidentally delete an account.
 */
export async function POST(request: Request) {
  const user = await requireUser();

  const formData = await request.formData();
  const confirmEmail = String(formData.get("confirm-email") ?? "")
    .trim()
    .toLowerCase();
  if (!confirmEmail || confirmEmail !== user.email.toLowerCase()) {
    return new NextResponse(
      "Email confirmation didn't match. Account NOT deleted.",
      { status: 400 },
    );
  }

  // 1 + 2: Stripe cleanup. Both helpers are best-effort + caught.
  await cancelSubscriptionImmediately(user.id);
  await deleteStripeCustomer(user.stripeCustomerId);

  // 3: Cascade everything. The users row is the root; FKs do the rest.
  await db.delete(schema.users).where(eq(schema.users.id, user.id));

  // 4: Cookie cleanup. The session row is already gone via cascade,
  // so this just clears the cookie on the client side.
  await destroyCurrentSession();

  // 5: Off you go. Banner on /login picks up the ?deleted=1 hint.
  const url = new URL("/login?deleted=1", request.url);
  return NextResponse.redirect(url, { status: 303 });
}
