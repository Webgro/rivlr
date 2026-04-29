"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { isAuthed } from "@/lib/auth";

export async function acceptSuggestion(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [s] = await db
    .select()
    .from(schema.linkSuggestions)
    .where(eq(schema.linkSuggestions.id, id))
    .limit(1);
  if (!s) return;

  const both = await db
    .select()
    .from(schema.trackedProducts)
    .where(inArray(schema.trackedProducts.id, [s.productAId, s.productBId]));
  const a = both.find((p) => p.id === s.productAId);
  const b = both.find((p) => p.id === s.productBId);
  if (!a || !b) return;

  let groupId = a.groupId ?? b.groupId;
  if (!groupId) {
    const [created] = await db
      .insert(schema.productGroups)
      .values({ name: a.title ?? a.handle })
      .returning();
    groupId = created.id;
  }

  await db
    .update(schema.trackedProducts)
    .set({ groupId })
    .where(inArray(schema.trackedProducts.id, [s.productAId, s.productBId]));

  await db
    .update(schema.linkSuggestions)
    .set({ status: "accepted" })
    .where(eq(schema.linkSuggestions.id, id));

  revalidatePath("/products/suggestions");
  revalidatePath("/dashboard");
}

export async function dismissSuggestion(formData: FormData) {
  if (!(await isAuthed())) redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .update(schema.linkSuggestions)
    .set({ status: "dismissed" })
    .where(eq(schema.linkSuggestions.id, id));
  revalidatePath("/products/suggestions");
}

export async function regenerateSuggestions() {
  if (!(await isAuthed())) redirect("/login");
  const { generateLinkSuggestions } = await import(
    "@/lib/crawler/link-suggestions"
  );
  const result = await generateLinkSuggestions();
  revalidatePath("/products/suggestions");
  return result;
}
