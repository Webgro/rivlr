import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db, schema } from "@/lib/db";
import { eq, sql, isNull } from "drizzle-orm";
import { consumeMagicLink } from "@/lib/auth/magic-link";
import { createSession } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

/**
 * Magic-link landing endpoint. Three flows handled here:
 *
 *  1. First-ever sign-up: create the user AND adopt every existing
 *     untenanted row (NULL user_id) into their account. This carries
 *     the operator's pre-Phase-3 data forward without manual migration.
 *
 *  2. Returning user OR additional authorised email: lookup the email
 *     across users.email AND user_emails.email, resolve to the parent
 *     user, create a session.
 *
 *  3. Unknown email after at least one user exists: reject. We're in
 *     single-account-mode for now — random sign-ups would otherwise
 *     create competing accounts that see no data and confuse everyone.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing-token", url));
  }

  const result = await consumeMagicLink(token);
  if (!result.ok) {
    const code =
      result.error === "expired"
        ? "expired"
        : result.error === "used"
          ? "used"
          : "invalid";
    return NextResponse.redirect(new URL(`/login?error=${code}`, url));
  }

  const email = result.email.toLowerCase();

  // 1. Resolve the email → user via union of users.email + user_emails.email.
  let user = await resolveUserByEmail(email);

  // 2. No user yet for this email. Two sub-cases:
  if (!user) {
    const [{ count: existingUserCount }] = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int AS count FROM users
    `);

    if (existingUserCount === 0) {
      // First-ever signup — create the user AND adopt all NULL-userId rows.
      [user] = await db
        .insert(schema.users)
        .values({
          email,
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
        })
        .returning();
      await adoptAllExistingData(user.id);

      // Fire welcome email — best effort, don't block the redirect.
      try {
        const built = welcomeEmail({ email });
        await sendEmail({
          to: [email],
          subject: built.subject,
          html: built.html,
          text: built.text,
        });
      } catch {
        // best effort
      }
    } else {
      // Single-account-mode: an account exists but this email isn't on it.
      // Reject with a clear message rather than silently creating a competing
      // tenant that would see no data.
      return NextResponse.redirect(
        new URL("/login?error=not-invited", url),
      );
    }
  } else {
    // Existing user (or authorised secondary email). Bump lastLogin /
    // verified state.
    await db
      .update(schema.users)
      .set({
        lastLoginAt: new Date(),
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      })
      .where(eq(schema.users.id, user.id));

    // If the matched email is a secondary, bump its lastUsedAt too.
    await db
      .update(schema.userEmails)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.userEmails.email, email));
  }

  // Idempotent post-deploy migration. Phase 3 part 2 adopted the
  // tracked-products etc. but app_settings + stores prefs weren't part
  // of that batch. This runs on every sign-in until the legacy state
  // (singleton settings row, is_my_store flags on the stores table) is
  // gone, then no-ops forever.
  await migrateLegacyDataForUser(user.id);

  const h = await headers();
  await createSession({
    userId: user.id,
    ip: h.get("x-forwarded-for") ?? null,
    userAgent: h.get("user-agent") ?? null,
  });

  // Resolve safe redirect — only allow same-origin paths.
  const redirectTo =
    result.redirectTo && result.redirectTo.startsWith("/")
      ? result.redirectTo
      : "/dashboard";

  return NextResponse.redirect(new URL(redirectTo, url));
}

/**
 * Look up a user by primary email OR any authorised additional email.
 * Returns the parent user row in either case.
 */
async function resolveUserByEmail(email: string) {
  const [primary] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (primary) return primary;

  const [secondary] = await db
    .select({ user: schema.users })
    .from(schema.userEmails)
    .innerJoin(schema.users, eq(schema.users.id, schema.userEmails.userId))
    .where(eq(schema.userEmails.email, email))
    .limit(1);
  return secondary?.user ?? null;
}

/**
 * One-shot adoption of pre-Phase-3 untenanted rows. Runs once when the
 * very first user signs up. Wraps every per-user table's UPDATE in a
 * single transaction so partial-failure leaves nothing inconsistent.
 *
 * Any row with user_id IS NULL gets claimed. Subsequent users start
 * with their own scope (no claim runs again because the FROM users
 * count check above gates this branch).
 */
async function adoptAllExistingData(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // Per-row tables — null user_id rows become this user's.
    await tx.execute(sql`
      UPDATE tracked_products SET user_id = ${userId} WHERE user_id IS NULL
    `);
    await tx.execute(sql`
      UPDATE discovered_products SET user_id = ${userId} WHERE user_id IS NULL
    `);
    await tx.execute(sql`
      UPDATE tags SET user_id = ${userId} WHERE user_id IS NULL
    `);
    await tx.execute(sql`
      UPDATE product_groups SET user_id = ${userId} WHERE user_id IS NULL
    `);
    await tx.execute(sql`
      UPDATE link_suggestions SET user_id = ${userId} WHERE user_id IS NULL
    `);

    // app_settings: pre-Phase-3 was a single 'singleton' row. Copy the
    // singleton (if it exists) to a new row keyed by the user's id, then
    // drop the singleton. After this, every read is by id = user.id.
    await tx.execute(sql`
      INSERT INTO app_settings (
        id, user_id, notification_emails, crawl_cadence,
        multi_market_countries, cart_probe_enabled,
        days_cover_threshold, updated_at
      )
      SELECT
        ${userId}, ${userId}::uuid, notification_emails, crawl_cadence,
        multi_market_countries, cart_probe_enabled,
        days_cover_threshold, updated_at
      FROM app_settings
      WHERE id = 'singleton'
      ON CONFLICT (id) DO NOTHING
    `);
    await tx.execute(sql`
      DELETE FROM app_settings WHERE id = 'singleton'
    `);

    // stores: per-user attributes (is_my_store, auto_track_new) move into
    // the user_store_prefs junction. We read the existing flags from the
    // global stores table and write one prefs row per (user, domain) pair
    // that had ANY flag set true. Stores without flags don't need a
    // prefs row — defaults of false apply.
    await tx.execute(sql`
      INSERT INTO user_store_prefs (user_id, domain, is_my_store, auto_track_new, set_at)
      SELECT ${userId}::uuid, domain, is_my_store, auto_track_new, NOW()
      FROM stores
      WHERE is_my_store = true OR auto_track_new = true
      ON CONFLICT DO NOTHING
    `);
  });
}

/**
 * Idempotent migration for an existing user. Runs on every sign-in but
 * is a fast no-op once the legacy state is cleaned up.
 *
 *   - Copies the legacy app_settings.id='singleton' row into a new row
 *     keyed by user.id, then deletes the singleton.
 *   - Copies stores.is_my_store / auto_track_new into the user_store_prefs
 *     junction (only for THIS user, only for stores they actually have
 *     tracked products on — to avoid claiming flags on stores that
 *     belong to other users in a multi-user future).
 */
async function migrateLegacyDataForUser(userId: string): Promise<void> {
  // Bail fast if user already has settings.
  const [existing] = await db
    .select({ id: schema.appSettings.id })
    .from(schema.appSettings)
    .where(eq(schema.appSettings.id, userId))
    .limit(1);
  const userHasSettings = !!existing;

  // Check if there are stores with legacy flags this user should claim.
  const [legacyStoresRow] = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count
    FROM stores s
    WHERE (s.is_my_store = true OR s.auto_track_new = true)
      AND EXISTS (
        SELECT 1 FROM tracked_products tp
        WHERE tp.store_domain = s.domain AND tp.user_id = ${userId}::uuid
      )
      AND NOT EXISTS (
        SELECT 1 FROM user_store_prefs usp
        WHERE usp.user_id = ${userId}::uuid AND usp.domain = s.domain
      )
  `);
  const hasLegacyStores = (legacyStoresRow?.count ?? 0) > 0;

  if (userHasSettings && !hasLegacyStores) return;

  await db.transaction(async (tx) => {
    if (!userHasSettings) {
      // Try copying from singleton; if that doesn't exist, just create
      // a default empty settings row.
      const [singleton] = await tx
        .select()
        .from(schema.appSettings)
        .where(eq(schema.appSettings.id, "singleton"))
        .limit(1);

      if (singleton) {
        await tx
          .insert(schema.appSettings)
          .values({
            id: userId,
            userId,
            notificationEmails: singleton.notificationEmails,
            crawlCadence: singleton.crawlCadence,
            multiMarketCountries: singleton.multiMarketCountries,
            cartProbeEnabled: singleton.cartProbeEnabled,
            daysCoverThreshold: singleton.daysCoverThreshold,
            updatedAt: singleton.updatedAt,
          })
          .onConflictDoNothing();
        await tx
          .delete(schema.appSettings)
          .where(eq(schema.appSettings.id, "singleton"));
      } else {
        // No prior settings — create defaults.
        await tx
          .insert(schema.appSettings)
          .values({ id: userId, userId })
          .onConflictDoNothing();
      }
    }

    if (hasLegacyStores) {
      // Copy is_my_store / auto_track_new from stores rows where this user
      // has tracked products. The double-EXISTS in the WHERE prevents
      // claiming flags on stores that belong to a different user (defensive
      // for the future-multi-user case).
      await tx.execute(sql`
        INSERT INTO user_store_prefs (user_id, domain, is_my_store, auto_track_new, set_at)
        SELECT ${userId}::uuid, s.domain, s.is_my_store, s.auto_track_new, NOW()
        FROM stores s
        WHERE (s.is_my_store = true OR s.auto_track_new = true)
          AND EXISTS (
            SELECT 1 FROM tracked_products tp
            WHERE tp.store_domain = s.domain AND tp.user_id = ${userId}::uuid
          )
          AND NOT EXISTS (
            SELECT 1 FROM user_store_prefs usp
            WHERE usp.user_id = ${userId}::uuid AND usp.domain = s.domain
          )
      `);
    }
  });
}

// Keep the unused-import suppression friendly.
void Resend;
void isNull;
