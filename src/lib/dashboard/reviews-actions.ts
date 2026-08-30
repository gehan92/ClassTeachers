"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notify, notifyAdmins } from "@/lib/dashboard/notify";

type ActionResult = { error: string } | { error?: undefined };

const postReviewSchema = z.object({
  targetType: z.enum(["teacher", "class"]),
  targetId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(1),
});

/**
 * A student posting/editing their review of a teacher or institute they've
 * joined. Upserted on (reviewer_id, target_type, target_id) — reviews has a
 * unique constraint there (0015), so re-posting acts as an edit rather than
 * erroring. RLS's insert policy requires is_enrolled(...); its update policy
 * doesn't re-check that for an edit of your own existing review, which is
 * fine — you don't stop having legitimately reviewed someone.
 */
export async function postReview(input: {
  targetType: "teacher" | "class";
  targetId: string;
  rating: number;
  comment: string;
}): Promise<ActionResult> {
  const parsed = postReviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please pick who you're reviewing, a rating, and a comment." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase.from("reviews").upsert(
    {
      reviewer_id: user.id,
      target_type: parsed.data.targetType,
      target_id: parsed.data.targetId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    },
    { onConflict: "reviewer_id,target_type,target_id" },
  );
  if (error) {
    return { error: "You need to have joined this teacher or institute to review them." };
  }

  let recipientId = parsed.data.targetId;
  if (parsed.data.targetType === "class") {
    const { data: cp } = await supabase.from("class_profiles").select("owner_id").eq("id", parsed.data.targetId).maybeSingle();
    recipientId = cp?.owner_id ?? parsed.data.targetId;
  }
  await notify(supabase, recipientId, "review_posted", { rating: parsed.data.rating }, "reviews");
  return {};
}

/**
 * The reviewed teacher/institute posting a public reply. RLS's update
 * policy also allows the reviewer or admin to hit this same column, but
 * only ever sending `reply_text` here (never rating/comment) is what keeps
 * "who may touch which column" correct — see 0015's own comment on why that
 * split isn't enforced by RLS itself.
 */
export async function replyToReview(input: { id: string; replyText: string }): Promise<ActionResult> {
  const replyText = input.replyText.trim();
  if (!replyText) {
    return { error: "Please write a reply first." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: updated, error } = await supabase
    .from("reviews")
    .update({ reply_text: replyText })
    .eq("id", input.id)
    .select("reviewer_id")
    .maybeSingle();
  if (error) {
    return { error: "Couldn't post your reply. Please try again." };
  }
  await notify(supabase, updated?.reviewer_id, "review_replied", {}, "reviews");
  return {};
}

/**
 * The reviewed teacher/institute flagging a review for admin moderation —
 * this is what feeds Admin -> Flagged Reviews (previously always empty:
 * nothing set is_flagged, see admin-actions.ts's resolveFlaggedReview).
 */
export async function flagReview(input: { id: string; reason: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("reviews")
    .update({ is_flagged: true, flagged_reason: input.reason.trim() || null })
    .eq("id", input.id);
  if (error) {
    return { error: "Couldn't flag this review. Please try again." };
  }
  await notifyAdmins(supabase, "review_flagged", {}, "flagged");
  return {};
}
