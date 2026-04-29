"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { isAuthed } from "@/lib/auth";

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

export async function getSettings() {
  const [row] = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.id, SETTINGS_ID))
    .limit(1);
  return row ?? null;
}
