"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createMagicLink } from "@/lib/auth/magic-link";
import { sendMagicLinkEmail } from "@/lib/auth/send-magic-link";
import { parseStoreDomain } from "@/lib/onboarding";

/**
 * Start a signup. Same mechanism as signing in — there are no
 * passwords, so "create an account" and "sign in" are the same act of
 * proving you own an inbox. The account row is created on the other
 * side, in /auth/verify, once the link is actually clicked.
 *
 * If the visitor typed a store address on the landing page we carry it
 * through the link so guided setup can pre-fill its first question
 * rather than asking for something they have already given us.
 */
export async function startSignup(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const rawStoreUrl = String(formData.get("storeUrl") ?? "");

  if (!email) {
    return { error: "Enter your email address." };
  }

  const domain = parseStoreDomain(rawStoreUrl);
  const next = domain
    ? `/welcome?store=${encodeURIComponent(domain)}`
    : "/welcome";

  const result = await createMagicLink({ email, redirectTo: next });
  if (!result.ok) {
    if (result.error === "rate-limited") {
      return {
        error: "Too many attempts just now. Wait a moment and try again.",
      };
    }
    return { error: "That email doesn't look right. Try again." };
  }

  // rivlr.app is reachable on a custom domain and on preview URLs, so
  // the link has to be built from the request's own host.
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "rivlr.app";

  await sendMagicLinkEmail({
    email,
    url: `${proto}://${host}/auth/verify?token=${result.token}`,
    expiresInMinutes: 15,
  });

  redirect(`/signup?sent=1&email=${encodeURIComponent(email)}`);
}
