"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { isAuthed } from "@/lib/auth";
import {
  type Cadence,
  isCadenceAllowed,
  getCurrentPlan,
} from "@/lib/plan";
import { KNOWN_MARKETS } from "@/lib/crawler/multi-market";
import { sendEmail } from "@/lib/email/send";
import { testEmail } from "@/lib/email/templates";

const SETTINGS_ID = "singleton";

export async function saveNotificationEmails(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
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

  // Upsert the singleton settings row.
  await db
    .insert(schema.appSettings)
    .values({
      id: SETTINGS_ID,
      notificationEmails: emails,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.appSettings.id,
      set: { notificationEmails: emails, updatedAt: new Date() },
    });

  revalidatePath("/settings");
}

/**
 * Fires a test email to every address in app_settings.notification_emails
 * so users can sanity-check their config without waiting for a real
 * price drop or stock change. Returns counts so the UI can show
 * "Sent to 2, skipped 1 (unsubscribed)" feedback.
 */
export async function sendTestNotification(): Promise<{
  ok: boolean;
  sent: number;
  skipped: number;
  recipients: number;
  error?: string;
}> {
  if (!(await isAuthed())) {
    return { ok: false, sent: 0, skipped: 0, recipients: 0, error: "unauthorized" };
  }
  const [row] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.id, SETTINGS_ID))
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
  const [row] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.id, SETTINGS_ID))
    .limit(1);
  return row ?? null;
}

const VALID_CADENCES: Cadence[] = ["daily", "every-6h", "hourly"];

/**
 * Update crawl cadence. Plan-gated: silently rejects values not allowed by
 * the user's plan (UI never exposes them as picks anyway).
 */
export async function updateCrawlCadence(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const value = String(formData.get("cadence") ?? "");
  if (!VALID_CADENCES.includes(value as Cadence)) return;
  const cadence = value as Cadence;
  const plan = await getCurrentPlan();
  if (!isCadenceAllowed(cadence, plan)) return;

  await db
    .insert(schema.appSettings)
    .values({ id: SETTINGS_ID, crawlCadence: cadence, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.appSettings.id,
      set: { crawlCadence: cadence, updatedAt: new Date() },
    });
  revalidatePath("/settings");
}

/**
 * Update the days-cover threshold for the "About to go dark" Opportunities
 * section. Clamped to a sensible 1–90 day range.
 */
export async function updateDaysCoverThreshold(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const raw = String(formData.get("threshold") ?? "");
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return;
  const clamped = Math.min(90, Math.max(1, n));
  await db
    .insert(schema.appSettings)
    .values({
      id: SETTINGS_ID,
      daysCoverThreshold: clamped,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.appSettings.id,
      set: { daysCoverThreshold: clamped, updatedAt: new Date() },
    });
  revalidatePath("/settings");
  revalidatePath("/opportunities");
}

/**
 * Toggle the global cart-add inventory probe. When off, the daily cron
 * skips probing entirely. When on, only products with hidden inventory
 * + non-blocked stores get probed (orchestrator handles those filters).
 */
export async function updateCartProbeEnabled(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const enabled = String(formData.get("enabled") ?? "") === "true";
  await db
    .insert(schema.appSettings)
    .values({
      id: SETTINGS_ID,
      cartProbeEnabled: enabled,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.appSettings.id,
      set: { cartProbeEnabled: enabled, updatedAt: new Date() },
    });
  revalidatePath("/settings");
}

/**
 * Update the list of countries the daily multi-market price scan polls.
 * Validated against the KNOWN_MARKETS whitelist; unknown codes are dropped.
 * Empty list reverts to defaults.
 */
export async function updateMultiMarketCountries(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const raw = formData.getAll("country").map((v) => String(v).toUpperCase());
  const cleaned = Array.from(
    new Set(raw.filter((c) => /^[A-Z]{2}$/.test(c) && KNOWN_MARKETS[c])),
  );
  await db
    .insert(schema.appSettings)
    .values({
      id: SETTINGS_ID,
      multiMarketCountries: cleaned,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.appSettings.id,
      set: { multiMarketCountries: cleaned, updatedAt: new Date() },
    });
  revalidatePath("/settings");
}
