"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/current-user";
import { createUserOnBehalf, type CompPlan } from "@/lib/admin";

/**
 * Server action wrapping createUserOnBehalf. Handles requireAdmin gate,
 * normalises errors into a discriminated union the form can switch on.
 */
export async function createUserAction(input: {
  email: string;
  compPlan: CompPlan;
  compReason: string;
}): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const me = await requireAdmin();

  try {
    const result = await createUserOnBehalf({
      actor: me,
      email: input.email,
      compPlan: input.compPlan,
      compReason: input.compReason,
    });
    revalidatePath("/admin/users");
    return { ok: true, userId: result.userId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Couldn't create user.",
    };
  }
}
