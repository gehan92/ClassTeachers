"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = { error: string } | { error?: undefined };

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return { error: "You don't have permission to do that." };
  }
  return { userId: user.id };
}

/**
 * Approve/reject buttons on Admin -> Approvals. teacher_profiles and
 * class_profiles RLS already lets an admin update any row (0004/0005:
 * `auth.uid() = id/owner_id or is_admin()`), so this just needs to confirm
 * the caller actually is one before writing — same status column the
 * teacher/institute self-service publish toggle uses (setListingPublished
 * in actions.ts), just admin-driven instead of owner-driven.
 */
export async function resolveApproval(input: {
  kind: "teacher" | "class";
  id: string;
  decision: "approved" | "rejected";
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) {
    return { error: admin.error };
  }

  const supabase = await createClient();
  const table = input.kind === "teacher" ? "teacher_profiles" : "class_profiles";
  const { error } = await supabase.from(table).update({ status: input.decision }).eq("id", input.id);
  if (error) {
    return { error: "Couldn't update this listing. Please try again." };
  }
  return {};
}

/**
 * Verify/unverify toggle on Admin -> Users, campus-lecturer rows only
 * (0075). Deliberately its own action rather than folded into
 * updateTeacherProfile (actions.ts) — that one is owner-driven and never
 * touches institution_verified, so a teacher can't self-verify even though
 * teacher_profiles' RLS technically allows a self-update (same discipline
 * as `status` above).
 */
export async function setInstitutionVerified(input: { teacherId: string; verified: boolean }): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) {
    return { error: admin.error };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("teacher_profiles")
    .update({ institution_verified: input.verified })
    .eq("id", input.teacherId);
  if (error) {
    return { error: "Couldn't update this. Please try again." };
  }
  return {};
}

/**
 * "Suspend"/"Reactivate" on Admin -> Users. There's no profiles.status
 * column — suspension is enforced at the Supabase Auth layer via
 * ban_duration, which actually blocks the account from signing in, rather
 * than a cosmetic flag nothing else checks. Requires the service-role
 * client (src/lib/supabase/admin.ts), so this re-verifies the caller is an
 * admin itself rather than relying on RLS (which the service-role key
 * bypasses entirely).
 */
export async function setUserSuspended(input: { userId: string; suspended: boolean }): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) {
    return { error: admin.error };
  }
  if (input.userId === admin.userId) {
    return { error: "You can't suspend your own account." };
  }

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(input.userId, {
    ban_duration: input.suspended ? "87600h" : "none",
  });
  if (error) {
    return { error: "Couldn't update this user. Please try again." };
  }
  return {};
}

/**
 * "+ New ad slot" on Admin -> Site-wide Ads. `advertisements` (0014) was
 * already built to cover this exact case: owner_type = 'site' with a null
 * owner_id, tied to whoever booked it (purchased_by) rather than a
 * teacher/institute — there's no self-serve purchase flow yet, so
 * purchased_by stays null and only an admin can create these (RLS).
 */
export async function createSiteAd(input: {
  sponsor: string;
  plan: "basic" | "featured" | "homepage_spotlight";
  placement: "search_results" | "homepage_banner" | "homepage_spotlight";
  expiresAt: string | null;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) {
    return { error: admin.error };
  }
  if (input.sponsor.trim().length === 0) {
    return { error: "Please enter a sponsor name." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("advertisements").insert({
    owner_type: "site",
    owner_id: null,
    title: input.sponsor.trim(),
    plan: input.plan,
    placement: input.placement,
    expires_at: input.expiresAt,
  });
  if (error) {
    return { error: "Couldn't create this ad. Please try again." };
  }
  return {};
}

/**
 * Keep/Remove on Admin -> Flagged Reviews. `reviews.is_flagged` (0015) is
 * the queue source; nothing sets it to true yet (the student/teacher/
 * institute review tabs are still mock data, not wired), so this queue will
 * be empty until those are fixed too — that's correct behavior, not a bug
 * in this action.
 */
export async function resolveFlaggedReview(input: { id: string; decision: "keep" | "remove" }): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) {
    return { error: admin.error };
  }

  const supabase = await createClient();
  if (input.decision === "remove") {
    const { error } = await supabase.from("reviews").delete().eq("id", input.id);
    if (error) {
      return { error: "Couldn't remove this review. Please try again." };
    }
    return {};
  }

  const { error } = await supabase.from("reviews").update({ is_flagged: false }).eq("id", input.id);
  if (error) {
    return { error: "Couldn't update this review. Please try again." };
  }
  return {};
}

/**
 * "Plan pricing" Save on Admin -> Subscriptions. platform_subscriptions
 * (0017) deliberately stores plan/status, not price — this is the only
 * place a price for MRR math lives. Generic key/value store (0030), not
 * subscriptions-specific columns, since the price isn't part of any one
 * subscription row.
 */
export async function updatePlatformSetting(input: { key: string; value: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) {
    return { error: admin.error };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .upsert({ key: input.key, value: input.value }, { onConflict: "key" });
  if (error) {
    return { error: "Couldn't save this setting. Please try again." };
  }
  return {};
}
