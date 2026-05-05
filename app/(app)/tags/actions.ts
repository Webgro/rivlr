"use server";

import { revalidatePath } from "next/cache";
import { db, schema, type TagColor, TAG_COLOR_NAMES } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { requireUser, getCurrentUser } from "@/lib/auth/current-user";

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
  const user = await requireUser();
  const name = normaliseTagName(String(formData.get("name") ?? ""));
  const colorRaw = String(formData.get("color") ?? "gray");
  if (!name) return;
  const color = isValidColor(colorRaw) ? colorRaw : "gray";
  await db
    .insert(schema.tags)
    .values({ name, color, userId: user.id })
    .onConflictDoUpdate({
      target: schema.tags.name,
      set: { color },
    });
  revalidatePath("/tags");
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

export async function setTagColor(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "");
  const colorRaw = String(formData.get("color") ?? "gray");
  const color = isValidColor(colorRaw) ? colorRaw : "gray";
  if (!name) return;
  await db
    .update(schema.tags)
    .set({ color })
    .where(
      and(eq(schema.tags.name, name), eq(schema.tags.userId, user.id)),
    );
  revalidatePath("/tags");
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

/**
 * Delete a tag. Removes the tag from the user's metadata table AND from
 * every of their products' tags array.
 */
export async function deleteTag(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "");
  if (!name) return;
  await db.execute(sql`
    UPDATE tracked_products
    SET tags = ARRAY_REMOVE(tags, ${name})
    WHERE user_id = ${user.id}::uuid
  `);
  await db
    .delete(schema.tags)
    .where(
      and(eq(schema.tags.name, name), eq(schema.tags.userId, user.id)),
    );
  revalidatePath("/tags");
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

/**
 * Returns all tag metadata for the current user. Tags that exist on the
 * user's products but haven't been registered (legacy or freshly bulk-
 * added) are auto-registered with the default 'gray' colour.
 */
export async function getAllTagsWithMeta() {
  const user = await getCurrentUser();
  if (!user) return [];

  const meta = await db
    .select()
    .from(schema.tags)
    .where(eq(schema.tags.userId, user.id));

  // Find tag names actually used on this user's products that aren't in
  // meta yet.
  const usedRows = await db.execute<{ name: string }>(sql`
    SELECT DISTINCT UNNEST(tags) AS name FROM tracked_products
    WHERE user_id = ${user.id}::uuid
      AND COALESCE(ARRAY_LENGTH(tags, 1), 0) > 0
  `);

  const knownNames = new Set(meta.map((m) => m.name));
  const orphans = usedRows.map((r) => r.name).filter((n) => !knownNames.has(n));

  if (orphans.length > 0) {
    await db
      .insert(schema.tags)
      .values(orphans.map((name) => ({ name, color: "gray", userId: user.id })))
      .onConflictDoNothing();
  }

  // Re-fetch with usage counts (scoped to this user's products).
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
      WHERE user_id = ${user.id}::uuid
      GROUP BY tag_name
    ) u ON u.tag_name = t.name
    WHERE t.user_id = ${user.id}::uuid
    ORDER BY usage DESC, t.name ASC
  `);

  return final.map((r) => ({
    name: r.name,
    color: (isValidColor(r.color) ? r.color : "gray") as TagColor,
    usage: r.usage,
    createdAt: r.created_at,
  }));
}
