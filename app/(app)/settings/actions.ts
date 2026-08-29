"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireUser, getCurrentUser } from "@/lib/auth/current-user";
import { KNOWN_MARKETS } from "@/lib/crawler/multi-market";
import { sendEmail } from "@/lib/email/send";
import { testEmail } from "@/lib/email/templates";

/**
 * Per-user settings actions. Every read/write is keyed by user.id —
 * the legacy 'singleton' row is migrated by /auth/verify on first
 * sign-in after the Phase 3 part 3 deploy.
 *
 * upsert helper: app_settings.id == user.id by convention; user_id
 * column duplicates that for FK clarity in joins.
 */

async function upsertSettings(
  userId: string,
  patch: Partial<typeof schema.appSettings.$inferInsert>,
) {
  await db
    .insert(schema.appSettings)
    .values({
      id: userId,
      userId,
      updatedAt: new Date(),
      ...patch,
    })
    .onConflictDoUpdate({
      target: schema.appSettings.id,
      set: { ...patch, updatedAt: new Date() },
    });
}

export async function saveNotificationEmails(formData: FormData) {
  const user = await requireUser();
  const raw = String(formData.get("emails") ?? "");
  const emails = Array.from(
    new Set(
      raw
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
        .filter((e) => e.length <= 254),
    ),
  );
  await upsertSettings(user.id, { notificationEmails: emails });
  revalidatePath("/settings");
}

/**
 * Fires a test email to every address in the user's notification_emails
 * so users can sanity-check their config without waiting for a real
 * price drop or stock change.
 */
export async function sendTestNotification(): Promise<{
  ok: boolean;
  sent: number;
  skipped: number;
  recipients: number;
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, sent: 0, skipped: 0, recipients: 0, error: "unauthorized" };
  }
  const [row] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.id, user.id))
    .limit(1);
  const emails = row?.notificationEmails ?? [];
  if (emails.length === 0) {
    return {
      ok: false,
      sent: 0,
      skipped: 0,
      recipients: 0,
      error: "Add at least one email above and save before sending a test.",
    };
  }
  const built = testEmail();
  const result = await sendEmail({
    to: emails,
    subject: built.subject,
    html: built.html,
    text: built.text,
  });
  return {
    ok: true,
    sent: result.sent,
    skipped: result.skipped,
    recipients: emails.length,
    error: result.error,
  };
}

export async function getSettings() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [row] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.id, user.id))
    .limit(1);
  return row ?? null;
}

export async function updateDaysCoverThreshold(formData: FormData) {
  const user = await requireUser();
  const raw = String(formData.get("threshold") ?? "");
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return;
  const clamped = Math.min(90, Math.max(1, n));
  await upsertSettings(user.id, { daysCoverThreshold: clamped });
  revalidatePath("/settings");
  revalidatePath("/opportunities");
}

export async function updateCartProbeEnabled(formData: FormData) {
  const user = await requireUser();
  const enabled = String(formData.get("enabled") ?? "") === "true";
  await upsertSettings(user.id, { cartProbeEnabled: enabled });
  revalidatePath("/settings");
}

export async function updateMultiMarketCountries(formData: FormData) {
  const user = await requireUser();
  const raw = formData.getAll("country").map((v) => String(v).toUpperCase());
  const cleaned = Array.from(
    new Set(raw.filter((c) => /^[A-Z]{2}$/.test(c) && KNOWN_MARKETS[c])),
  );
  await upsertSettings(user.id, { multiMarketCountries: cleaned });
  revalidatePath("/settings");
}
