"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/current-user";
import {
  setCompPlan,
  clearCompPlan,
  setIsAdmin,
  writeAudit,
  type CompPlan,
} from "@/lib/admin";
import {
  cancelSubscriptionImmediately,
  deleteStripeCustomer,
} from "@/lib/billing";

/**
 * Server actions for the /admin/users/[id] page. Every action runs
 * requireAdmin() defensively in addition to the layout-level gate.
 */

const VALID_COMPS: CompPlan[] = [
  "free",
  "starter",
  "growth",
  "pro",
  "owner",
  "unlimited",
];

export async function applyCompPlan(formData: FormData) {
  const me = await requireAdmin();
  const targetUserId = String(formData.get("user-id") ?? "");
  const planRaw = String(formData.get("plan") ?? "");
  const reason = String(formData.get("reason") ?? "");
  if (!targetUserId) throw new Error("Missing user id.");
  if (!VALID_COMPS.includes(planRaw as CompPlan)) {
    throw new Error("Unknown plan.");
  }
  await setCompPlan({
    actor: me,
    targetUserId,
    plan: planRaw as CompPlan,
    reason,
  });
  revalidatePath(`/admin/users/${targetUserId}`);
}

export async function removeCompPlan(formData: FormData) {
  const me = await requireAdmin();
  const targetUserId = String(formData.get("user-id") ?? "");
  if (!targetUserId) throw new Error("Missing user id.");
  await clearCompPlan({ actor: me, targetUserId });
  revalidatePath(`/admin/users/${targetUserId}`);
}

export async function toggleAdminFlag(formData: FormData) {
  const me = await requireAdmin();
  const targetUserId = String(formData.get("user-id") ?? "");
  const grant = String(formData.get("grant") ?? "") === "true";
  if (!targetUserId) throw new Error("Missing user id.");
  await setIsAdmin({ actor: me, targetUserId, isAdmin: grant });
  revalidatePath(`/admin/users/${targetUserId}`);
}

/**
 * Admin-initiated user deletion. Same shape as /api/account/delete but
 * callable against another user. Defensive typed-confirmation: form must
 * include `confirm-email` matching the target email.
 */
export async function adminDeleteUser(formData: FormData) {
  const me = await requireAdmin();
  const targetUserId = String(formData.get("user-id") ?? "");
  const confirmEmail = String(formData.get("confirm-email") ?? "")
    .trim()
    .toLowerCase();
  if (!targetUserId) throw new Error("Missing user id.");

  const [target] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, targetUserId))
    .limit(1);
  if (!target) throw new Error("User not found.");
  if (confirmEmail !== target.email.toLowerCase()) {
    throw new Error(
      "Email confirmation didn't match — refusing to delete.",
    );
  }

  // Stripe cleanup (best-effort, same as user-initiated delete).
  await cancelSubscriptionImmediately(target.id);
  await deleteStripeCustomer(target.stripeCustomerId);

  // Cascade through every user_id FK.
  await db.delete(schema.users).where(eq(schema.users.id, target.id));

  // Audit. Target user_id is now null (cascaded), but we have the email.
  await writeAudit({
    actor: me,
    targetUserId: null,
    targetEmail: target.email,
    action: "delete_user",
    payload: { stripe_customer_id: target.stripeCustomerId },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users?deleted=" + encodeURIComponent(target.email));
}
