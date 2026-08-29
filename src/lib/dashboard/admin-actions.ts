"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type ActionResult = { error: string } | { error?: undefined };
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

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

/** Best-effort trail for Admin -> everything below — audit_log (0018) was
 * always correctly RLS-locked but nothing ever wrote to it, so there was no
 * actual record of admin actions. Never blocks the action it's logging on
 * its own failure; the underlying change already happened by the time this
 * is called. */
async function logAdminAction(
  supabase: SupabaseClient,
  actorId: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  metadata: Record<string, Json> = {},
): Promise<void> {
  await supabase.from("audit_log").insert({ actor_id: actorId, action, target_type: targetType, target_id: targetId, metadata });
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
  await logAdminAction(supabase, admin.userId, "listing_approval_decision", input.kind, input.id, {
    decision: input.decision,
  });
  return {};
}

/**
 * Verify/unverify toggle on Admin -> Users. Originally campus-lecturer rows
 * only (0075); 0087 extended verification_document_path/institution_verified
 * to class_profiles too, so this now covers any teacher, campus lecturer, or
 * institute. `ownerId` is always the row's own id in `profiles` terms — for
 * ownerType "class" that's the institute's *owner*, not class_profiles' own
 * primary key, so it's resolved via owner_id rather than id. Deliberately
 * its own action rather than folded into updateTeacherProfile/institute
 * settings actions — those are owner-driven and never touch
 * institution_verified, so an owner can't self-verify even though RLS
 * technically allows a self-update (same discipline as `status` above).
 *
 * Verifying without evidence (0076) is refused outright — a badge with
 * nothing behind it is worse than no badge. Unverifying never needs a
 * document check, an admin can always revoke.
 */
export async function setInstitutionVerified(input: {
  ownerType: "teacher" | "class";
  ownerId: string;
  verified: boolean;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) {
    return { error: admin.error };
  }

  const supabase = await createClient();
  // .eq()'s column argument won't narrow correctly against a table picked at
  // runtime, so the owner-column lookup (id vs owner_id) needs its own
  // literal-typed branch rather than a shared variable.
  const { data: row } =
    input.ownerType === "teacher"
      ? await supabase.from("teacher_profiles").select("id, verification_document_path").eq("id", input.ownerId).maybeSingle()
      : await supabase.from("class_profiles").select("id, verification_document_path").eq("owner_id", input.ownerId).maybeSingle();
  if (!row) {
    return { error: "Couldn't find this account. Please try again." };
  }
  if (input.verified && !row.verification_document_path) {
    return { error: "No verification document has been submitted yet." };
  }

  const table = input.ownerType === "teacher" ? "teacher_profiles" : "class_profiles";
  const { error } = await supabase.from(table).update({ institution_verified: input.verified }).eq("id", row.id);
  if (error) {
    return { error: "Couldn't update this. Please try again." };
  }
  await logAdminAction(supabase, admin.userId, "institution_verified_change", input.ownerType, row.id, {
    verified: input.verified,
  });
  return {};
}

/**
 * "View document" on Admin -> Users. The verification-docs bucket (0076) is
 * private, so the admin needs a short-lived signed URL rather than a plain
 * public one — same hand-off shape as the notes file route, just as a
 * server action instead of a redirect route since it's opened from a button
 * click, not a link a student might bookmark. Same ownerId/ownerColumn
 * resolution as setInstitutionVerified above.
 */
export async function getVerificationDocumentUrl(
  ownerType: "teacher" | "class",
  ownerId: string,
): Promise<ActionResult & { url?: string }> {
  const admin = await requireAdmin();
  if ("error" in admin) {
    return { error: admin.error };
  }

  const supabase = await createClient();
  const { data: row } =
    ownerType === "teacher"
      ? await supabase.from("teacher_profiles").select("verification_document_path").eq("id", ownerId).maybeSingle()
      : await supabase.from("class_profiles").select("verification_document_path").eq("owner_id", ownerId).maybeSingle();
  if (!row?.verification_document_path) {
    return { error: "No document has been submitted." };
  }

  const { data: signed, error } = await supabase.storage
    .from("verification-docs")
    .createSignedUrl(row.verification_document_path, 60);
  if (error || !signed) {
    return { error: "Couldn't open this document. Please try again." };
  }
  return { url: signed.signedUrl };
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
  // Service-role client above bypasses RLS entirely, so the log write goes
  // through the caller's own RLS-bound client instead — audit_log's insert
  // policy requires actor_id = auth.uid(), which only that session has.
  await logAdminAction(await createClient(), admin.userId, "user_suspension_change", "profile", input.userId, {
    suspended: input.suspended,
  });
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
  content?: string;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) {
    return { error: admin.error };
  }
  if (input.sponsor.trim().length === 0) {
    return { error: "Please enter a sponsor name." };
  }

  const supabase = await createClient();
  const { data: ad, error } = await supabase
    .from("advertisements")
    .insert({
      owner_type: "site",
      owner_id: null,
      title: input.sponsor.trim(),
      content: input.content?.trim() || null,
      plan: input.plan,
      placement: input.placement,
      expires_at: input.expiresAt,
    })
    .select("id")
    .single();
  if (error) {
    return { error: "Couldn't create this ad. Please try again." };
  }
  await logAdminAction(supabase, admin.userId, "site_ad_created", "advertisement", ad?.id ?? null, {
    sponsor: input.sponsor.trim(),
    plan: input.plan,
    placement: input.placement,
  });
  return {};
}

/**
 * Keep/Remove on Admin -> Flagged Reviews. `reviews.is_flagged` (0015) is
 * the queue source, set by the reviewed teacher/institute's own flagReview
 * action (reviews-actions.ts).
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
    await logAdminAction(supabase, admin.userId, "review_removed", "review", input.id);
    return {};
  }

  const { error } = await supabase.from("reviews").update({ is_flagged: false }).eq("id", input.id);
  if (error) {
    return { error: "Couldn't update this review. Please try again." };
  }
  await logAdminAction(supabase, admin.userId, "review_kept", "review", input.id);
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
  await logAdminAction(supabase, admin.userId, "platform_setting_updated", "platform_setting", null, {
    key: input.key,
    value: input.value,
  });
  return {};
}
