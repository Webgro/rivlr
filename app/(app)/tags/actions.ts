"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema, type TagColor, TAG_COLOR_NAMES } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { isAuthed } from "@/lib/auth";

function isValidColor(c: string): c is TagColor {
  return (TAG_COLOR_NAMES as readonly string[]).includes(c);
}

function normaliseTagName(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (!t || t.length > 32) return null;
  if (!/^[a-z0-9][a-z0-9 _\-]{0,30}[a-z0-9]?$/.test(t)) return null;
  return t;
}

export async function createTag(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const name = normaliseTagName(String(formData.get("name") ?? ""));
  const colorRaw = String(formData.get("color") ?? "gray");
  if (!name) return;
  const color = isValidColor(colorRaw) ? colorRaw : "gray";
  await db
    .insert(schema.tags)
    .values({ name, color })
    .onConflictDoUpdate({
      target: schema.tags.name,
      set: { color },
    });
  revalidatePath("/tags");
  revalidatePath("/dashboard");
}

export async function setTagColor(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const name = String(formData.get("name") ?? "");
  const colorRaw = String(formData.get("color") ?? "gray");
  const color = isValidColor(colorRaw) ? colorRaw : "gray";
  if (!name) return;
  await db
    .update(schema.tags)
    .set({ color })
    .where(eq(schema.tags.name, name));
  revalidatePath("/tags");
  revalidatePath("/dashboard");
}

/**
 * Delete a tag. Removes the tag from the metadata table AND from every
 * product's tags array.
 */
export async function deleteTag(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const name = String(formData.get("name") ?? "");
  if (!name) return;
  await db.execute(sql`
    UPDATE tracked_products SET tags = ARRAY_REMOVE(tags, ${name})
  `);
  await db.delete(schema.tags).where(eq(schema.tags.name, name));
  revalidatePath("/tags");
  revalidatePath("/dashboard");
}

/**
 * Returns all tag metadata. Tags that exist on products but haven't been
 * registered (legacy or freshly bulk-added) are auto-registered with the
 * default 'gray' colour and returned alongside.
 */
export async function getAllTagsWithMeta() {
  const meta = await db.select().from(schema.tags);

  // Find tag names actually used on products that aren't in meta yet.
  const usedRows = await db.execute<{ name: string }>(sql`
    SELECT DISTINCT UNNEST(tags) AS name FROM tracked_products
    WHERE COALESCE(ARRAY_LENGTH(tags, 1), 0) > 0
  `);

  const knownNames = new Set(meta.map((m) => m.name));
  const orphans = usedRows.map((r) => r.name).filter((n) => !knownNames.has(n));

  if (orphans.length > 0) {
    await db
      .insert(schema.tags)
      .values(orphans.map((name) => ({ name, color: "gray" })))
      .onConflictDoNothing();
  }

  // Re-fetch with usage counts.
  const final = await db.execute<{
    name: string;
    color: string;
    created_at: string;
    usage: number;
  }>(sql`
    SELECT t.name, t.color, t.created_at,
      COALESCE(u.cnt, 0)::int AS usage
    FROM tags t
    LEFT JOIN (
      SELECT UNNEST(tags) AS tag_name, COUNT(*)::int AS cnt
      FROM tracked_products
      GROUP BY tag_name
    ) u ON u.tag_name = t.name
    ORDER BY usage DESC, t.name ASC
  `);

  return final.map((r) => ({
    name: r.name,
    color: (isValidColor(r.color) ? r.color : "gray") as TagColor,
    usage: r.usage,
    createdAt: r.created_at,
  }));
}
