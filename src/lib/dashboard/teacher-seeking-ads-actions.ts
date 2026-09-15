"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/dashboard/notify";

type ActionResult = { error: string } | { error?: undefined };

const gradeBands = ["1-5", "6-9", "10-11", "12-13", "campus", "adult"] as const;
const modeOptions = ["online", "physical", "travels_to_student"] as const;

const teacherSeekingAdSchema = z.object({
  subjectId: z.string().uuid().optional(),
  mode: z.enum(modeOptions).optional(),
  gradeBand: z.enum(gradeBands).optional(),
  title: z.string().trim().min(2),
  content: z.string().trim().min(1).max(2000),
});

export async function createTeacherSeekingAd(input: {
  subjectId: string;
  mode: string;
  gradeBand: string;
  title: string;
  content: string;
}): Promise<ActionResult> {
  const parsed = teacherSeekingAdSchema.safeParse({
    subjectId: input.subjectId || undefined,
    mode: input.mode || undefined,
    gradeBand: input.gradeBand || undefined,
    title: input.title,
    content: input.content,
  });
  if (!parsed.success) {
    return { error: "Please fill in a title and description, then try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase.from("teacher_seeking_ads").insert({
    teacher_id: user.id,
    subject_id: parsed.data.subjectId ?? null,
    mode: parsed.data.mode ?? null,
    grade_band: parsed.data.gradeBand ?? null,
    title: parsed.data.title,
    content: parsed.data.content,
  });
  if (error) {
    return { error: "Couldn't post your ad. Please try again." };
  }
  return {};
}

export async function updateTeacherSeekingAd(
  adId: string,
  input: { subjectId: string; mode: string; gradeBand: string; title: string; content: string },
): Promise<ActionResult> {
  const parsed = teacherSeekingAdSchema.safeParse({
    subjectId: input.subjectId || undefined,
    mode: input.mode || undefined,
    gradeBand: input.gradeBand || undefined,
    title: input.title,
    content: input.content,
  });
  if (!parsed.success) {
    return { error: "Please fill in a title and description, then try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("teacher_seeking_ads")
    .update({
      subject_id: parsed.data.subjectId ?? null,
      mode: parsed.data.mode ?? null,
      grade_band: parsed.data.gradeBand ?? null,
      title: parsed.data.title,
      content: parsed.data.content,
    })
    .eq("id", adId)
    .eq("teacher_id", user.id);
  if (error) {
    return { error: "Couldn't save your changes. Please try again." };
  }
  return {};
}

export async function setTeacherSeekingAdStatus(adId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("teacher_seeking_ads")
    .update({ status: active ? "active" : "closed" })
    .eq("id", adId)
    .eq("teacher_id", user.id);
  if (error) {
    return { error: "Couldn't update this ad. Please try again." };
  }
  return {};
}

export async function deleteTeacherSeekingAd(adId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase.from("teacher_seeking_ads").delete().eq("id", adId).eq("teacher_id", user.id);
  if (error) {
    return { error: "Couldn't delete this ad. Please try again." };
  }
  return {};
}

const respondSchema = z.object({
  teacherSeekingAdId: z.string().uuid(),
  message: z.string().trim().min(1),
});

/**
 * Only an institute ever responds here (a teacher wouldn't respond to
 * another teacher's own "seeking institute" ad) — resolved from the
 * caller's own class_profiles row server-side, never trusted from the
 * client, then enforced again by the insert policy (0137).
 */
export async function respondToTeacherSeekingAd(teacherSeekingAdId: string, message: string): Promise<ActionResult> {
  const parsed = respondSchema.safeParse({ teacherSeekingAdId, message });
  if (!parsed.success) {
    return { error: "Please write a message first." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: classProfile } = await supabase.from("class_profiles").select("id, name").eq("owner_id", user.id).maybeSingle();
  if (!classProfile) {
    return { error: "No institute profile found for this account." };
  }

  const { error } = await supabase.from("teacher_seeking_ad_responses").insert({
    teacher_seeking_ad_id: parsed.data.teacherSeekingAdId,
    institute_id: classProfile.id,
    message: parsed.data.message,
  });
  if (error) {
    if (error.code === "23505") {
      return { error: "You've already responded to this ad." };
    }
    return { error: "Couldn't send your response. Please try again." };
  }

  const { data: ad } = await supabase
    .from("teacher_seeking_ads")
    .select("teacher_id")
    .eq("id", parsed.data.teacherSeekingAdId)
    .maybeSingle();
  // No prefKey — the teacher dashboard's Settings tab doesn't use the
  // generic notification_prefs toggle list student/institute settings do
  // (it has its own small fixed set), so there's nothing to gate this on
  // yet. Omitting it here is honest about that rather than naming a pref
  // key no toggle ever sets.
  await notify(supabase, ad?.teacher_id, "teacher_seeking_ad_response", { instituteName: classProfile.name }, "institute");
  return {};
}

/**
 * The teacher's decision on one response to their ad — mirrors
 * respondToWantedAdDecision's own accept/decline shape, including checking
 * that the write actually landed: RLS (0137) already restricts this update
 * to the ad's own posting teacher, so a mismatched caller or a stale/
 * already-gone responseId must surface as an error here rather than a
 * silent no-op that looks like success.
 */
export async function respondToTeacherSeekingAdDecision(responseId: string, accepted: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: updated, error } = await supabase
    .from("teacher_seeking_ad_responses")
    .update({ status: accepted ? "accepted" : "declined" })
    .eq("id", responseId)
    .select("institute_id")
    .maybeSingle();
  if (error) {
    return { error: "Couldn't update this. Please try again." };
  }
  if (!updated) {
    return { error: "This response could not be found, or you don't have permission to update it." };
  }

  const { data: instituteProfile } = await supabase
    .from("class_profiles")
    .select("owner_id")
    .eq("id", updated.institute_id)
    .maybeSingle();
  // No dedicated notification-preference toggle for this yet, same call as
  // respondToWantedAdDecision — narrow and infrequent enough not to need
  // its own Settings entry right now.
  await notify(
    supabase,
    instituteProfile?.owner_id,
    accepted ? "teacher_seeking_ad_response_accepted" : "teacher_seeking_ad_response_declined",
    {},
    "teachers",
  );
  return {};
}
