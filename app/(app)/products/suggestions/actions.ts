"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { eq, inArray, and } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current-user";

export async function acceptSuggestion(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [s] = await db
    .select()
    .from(schema.linkSuggestions)
    .where(
      and(
        eq(schema.linkSuggestions.id, id),
        eq(schema.linkSuggestions.userId, user.id),
      ),
    )
    .limit(1);
  if (!s) return;

  const both = await db
    .select()
    .from(schema.trackedProducts)
    .where(
      and(
        inArray(schema.trackedProducts.id, [s.productAId, s.productBId]),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );
  const a = both.find((p) => p.id === s.productAId);
  const b = both.find((p) => p.id === s.productBId);
  if (!a || !b) return;

  let groupId = a.groupId ?? b.groupId;
  if (!groupId) {
    const [created] = await db
      .insert(schema.productGroups)
      .values({ userId: user.id, name: a.title ?? a.handle })
      .returning();
    groupId = created.id;
  }

  await db
    .update(schema.trackedProducts)
    .set({ groupId })
    .where(
      and(
        inArray(schema.trackedProducts.id, [s.productAId, s.productBId]),
        eq(schema.trackedProducts.userId, user.id),
      ),
    );

  await db
    .update(schema.linkSuggestions)
    .set({ status: "accepted" })
    .where(
      and(
        eq(schema.linkSuggestions.id, id),
        eq(schema.linkSuggestions.userId, user.id),
      ),
    );

  revalidatePath("/products/suggestions");
  revalidatePath("/products");
  revalidatePath("/dashboard");
}

export async function dismissSuggestion(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db
    .update(schema.linkSuggestions)
    .set({ status: "dismissed" })
    .where(
      and(
        eq(schema.linkSuggestions.id, id),
        eq(schema.linkSuggestions.userId, user.id),
      ),
    );
  revalidatePath("/products/suggestions");
}

export async function regenerateSuggestions() {
  const user = await requireUser();
  const { generateLinkSuggestions } = await import(
    "@/lib/crawler/link-suggestions"
  );
  const result = await generateLinkSuggestions(user.id);
  revalidatePath("/products/suggestions");
  return result;
}
