"use server";

import { db, schema } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current-user";

/**
 * Share-link actions for a single product. One active link per product;
 * creating returns the existing active link when there is one, revoking
 * stamps revoked_at (the row stays so the old URL is permanently dead).
 */

export async function getOrCreateShareLink(productId: string): Promise<{
  ok: boolean;
  token?: string;
  error?: string;
}> {
  const user = await requireUser();

  // Ownership check — never mint a link for someone else's product.
  const [product] = await db
    .select({ id: schema.trackedProducts.id })
    .from(schema.trackedProducts)
    .where(
      and(
        eq(schema.trackedProducts.id, productId),
        eq(schema.trackedProducts.userId, user.id),
      ),
    )
    .limit(1);
  if (!product) return { ok: false, error: "Product not found." };

  const [existing] = await db
    .select({ id: schema.shareLinks.id })
    .from(schema.shareLinks)
    .where(
      and(
        eq(schema.shareLinks.targetId, productId),
        eq(schema.shareLinks.userId, user.id),
        isNull(schema.shareLinks.revokedAt),
      ),
    )
    .limit(1);
  if (existing) return { ok: true, token: existing.id };

  const [created] = await db
    .insert(schema.shareLinks)
    .values({ userId: user.id, kind: "product", targetId: productId })
    .returning({ id: schema.shareLinks.id });
  return { ok: true, token: created.id };
}

export async function revokeShareLink(productId: string): Promise<{
  ok: boolean;
}> {
  const user = await requireUser();
  await db
    .update(schema.shareLinks)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.shareLinks.targetId, productId),
        eq(schema.shareLinks.userId, user.id),
        isNull(schema.shareLinks.revokedAt),
      ),
    );
  return { ok: true };
}
