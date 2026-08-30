"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/dashboard/notify";

type ActionResult = { error: string } | { error?: undefined };

const lookingForOptions = ["teacher", "institute"] as const;
const modeOptions = ["online", "physical", "both"] as const;

const wantedAdSchema = z.object({
  lookingFor: z.enum(lookingForOptions),
  subjectId: z.string().uuid().optional(),
  mode: z.enum(modeOptions).optional(),
  gradeLevel: z.string().trim().optional(),
  title: z.string().trim().min(2),
  description: z.string().trim().optional(),
});

export async function createWantedAd(input: {
  lookingFor: string;
  subjectId: string;
  mode: string;
  gradeLevel: string;
  title: string;
  description: string;
}): Promise<ActionResult> {
  const parsed = wantedAdSchema.safeParse({
    lookingFor: input.lookingFor,
    subjectId: input.subjectId || undefined,
    mode: input.mode || undefined,
    gradeLevel: input.gradeLevel,
    title: input.title,
    description: input.description,
  });
  if (!parsed.success) {
    return { error: "Please fill in a title and what you're looking for, then try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase.from("wanted_ads").insert({
    student_id: user.id,
    looking_for: parsed.data.lookingFor,
    subject_id: parsed.data.subjectId ?? null,
    mode: parsed.data.mode ?? null,
    grade_level: parsed.data.gradeLevel || null,
    title: parsed.data.title,
    description: parsed.data.description || null,
  });
  if (error) {
    return { error: "Couldn't post your ad. Please try again." };
  }
  return {};
}

export async function updateWantedAd(
  adId: string,
  input: {
    lookingFor: string;
    subjectId: string;
    mode: string;
    gradeLevel: string;
    title: string;
    description: string;
  },
): Promise<ActionResult> {
  const parsed = wantedAdSchema.safeParse({
    lookingFor: input.lookingFor,
    subjectId: input.subjectId || undefined,
    mode: input.mode || undefined,
    gradeLevel: input.gradeLevel,
    title: input.title,
    description: input.description,
  });
  if (!parsed.success) {
    return { error: "Please fill in a title and what you're looking for, then try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("wanted_ads")
    .update({
      looking_for: parsed.data.lookingFor,
      subject_id: parsed.data.subjectId ?? null,
      mode: parsed.data.mode ?? null,
      grade_level: parsed.data.gradeLevel || null,
      title: parsed.data.title,
      description: parsed.data.description || null,
    })
    .eq("id", adId)
    .eq("student_id", user.id);
  if (error) {
    return { error: "Couldn't save your changes. Please try again." };
  }
  return {};
}

export async function setWantedAdStatus(adId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("wanted_ads")
    .update({ status: active ? "active" : "closed" })
    .eq("id", adId)
    .eq("student_id", user.id);
  if (error) {
    return { error: "Couldn't update this ad. Please try again." };
  }
  return {};
}

export async function deleteWantedAd(adId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase.from("wanted_ads").delete().eq("id", adId).eq("student_id", user.id);
  if (error) {
    return { error: "Couldn't delete this ad. Please try again." };
  }
  return {};
}

const respondToWantedAdSchema = z.object({
  wantedAdId: z.string().uuid(),
  message: z.string().trim().min(1),
});

/**
 * One message, not a thread — same shape as replyToInquiry (0037/0042).
 * The responder_type/responder_id are resolved from the caller's own role
 * server-side rather than trusted from the client, then enforced again by
 * the insert policy (0072) so a teacher can't respond as if they were an
 * institute or vice versa.
 */
export async function respondToWantedAd(wantedAdId: string, message: string): Promise<ActionResult> {
  const parsed = respondToWantedAdSchema.safeParse({ wantedAdId, message });
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

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || (profile.role !== "teacher" && profile.role !== "class")) {
    return { error: "Only teacher or institute accounts can respond to requests." };
  }

  let responderType: "teacher" | "class" = "teacher";
  let responderId = user.id;
  if (profile.role === "class") {
    const { data: classProfile } = await supabase
      .from("class_profiles")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!classProfile) {
      return { error: "No institute profile found for this account." };
    }
    responderType = "class";
    responderId = classProfile.id;
  }

  const { error } = await supabase.from("wanted_ad_responses").insert({
    wanted_ad_id: parsed.data.wantedAdId,
    responder_type: responderType,
    responder_id: responderId,
    message: parsed.data.message,
  });
  if (error) {
    if (error.code === "23505") {
      return { error: "You've already responded to this request." };
    }
    return { error: "Couldn't send your response. Please try again." };
  }

  const { data: wantedAd } = await supabase.from("wanted_ads").select("student_id").eq("id", parsed.data.wantedAdId).maybeSingle();
  await notify(supabase, wantedAd?.student_id, "wanted_ad_response", { responderType }, "wantedAds");
  return {};
}

/** Mirrors markInquiryRead (0037) — same 'new'/'read' shape, scoped by RLS
 * (0073) to the student who posted the ad this response belongs to. */
export async function markWantedAdResponseRead(responseId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase.from("wanted_ad_responses").update({ status: "read" }).eq("id", responseId);
  if (error) {
    return { error: "Couldn't update this. Please try again." };
  }
  return {};
}
