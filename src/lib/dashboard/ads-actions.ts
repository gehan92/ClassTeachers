"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

const updateOwnProfileAdSchema = z.object({
  ownerType: z.enum(["teacher", "class"]),
  content: z.string().trim().min(1),
});

/**
 * The teacher/institute Ads tab manages a single `own_profile` promotion —
 * no plan/placement picker in the UI yet (that's the paid /advertise flow,
 * out of scope here), so this defaults plan to 'basic' and title to a
 * fixed label rather than exposing fields the UI doesn't have.
 */
export async function updateOwnProfileAd(input: {
  ownerType: "teacher" | "class";
  content: string;
}): Promise<ActionResult> {
  const parsed = updateOwnProfileAdSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please write some promotion text first." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  let ownerId = user.id;
  if (parsed.data.ownerType === "class") {
    const { data: classProfile } = await supabase
      .from("class_profiles")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!classProfile) {
      return { error: "No institute profile found for this account." };
    }
    ownerId = classProfile.id;
  }

  const { data: existing } = await supabase
    .from("advertisements")
    .select("id")
    .eq("owner_type", parsed.data.ownerType)
    .eq("owner_id", ownerId)
    .eq("placement", "own_profile")
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("advertisements").update({ content: parsed.data.content }).eq("id", existing.id)
    : await supabase.from("advertisements").insert({
        owner_type: parsed.data.ownerType,
        owner_id: ownerId,
        title: "Profile promotion",
        content: parsed.data.content,
        placement: "own_profile",
        plan: "basic",
      });
  if (error) {
    return { error: "Couldn't save your promotion. Please try again." };
  }
  return {};
}

const upsertBatchAdSchema = z.object({
  batchId: z.string().uuid(),
  subjectId: z.string().uuid(),
  title: z.string().trim().min(2),
  content: z.string().trim().min(1),
});

/**
 * A search-results ad promotes one specific batch (0039), unlike the single
 * own_profile promotion above. Saving here also stamps the batch's
 * subject_id if it isn't set yet — there's no separate "edit batch" UI, so
 * this is the one place a teacher assigns a batch's subject.
 */
export async function upsertBatchAd(input: {
  batchId: string;
  subjectId: string;
  title: string;
  content: string;
}): Promise<ActionResult> {
  const parsed = upsertBatchAdSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please fill in the subject, title and details, then try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: batch } = await supabase
    .from("batches")
    .select("id, subject_id")
    .eq("id", parsed.data.batchId)
    .eq("owner_type", "teacher")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!batch) {
    return { error: "That class couldn't be found." };
  }

  const { data: subjectLink } = await supabase
    .from("subject_links")
    .select("subject_id")
    .eq("owner_type", "teacher")
    .eq("owner_id", user.id)
    .eq("subject_id", parsed.data.subjectId)
    .maybeSingle();
  if (!subjectLink) {
    return { error: "Add that subject to your profile first, then try again." };
  }

  if (batch.subject_id !== parsed.data.subjectId) {
    const { error: batchError } = await supabase
      .from("batches")
      .update({ subject_id: parsed.data.subjectId })
      .eq("id", batch.id);
    if (batchError) {
      return { error: "Couldn't save this ad. Please try again." };
    }
  }

  const { data: existing } = await supabase
    .from("advertisements")
    .select("id")
    .eq("owner_type", "teacher")
    .eq("owner_id", user.id)
    .eq("batch_id", batch.id)
    .eq("placement", "search_results")
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("advertisements")
        .update({
          title: parsed.data.title,
          content: parsed.data.content,
          subject_id: parsed.data.subjectId,
          status: "active",
        })
        .eq("id", existing.id)
    : await supabase.from("advertisements").insert({
        owner_type: "teacher",
        owner_id: user.id,
        batch_id: batch.id,
        subject_id: parsed.data.subjectId,
        title: parsed.data.title,
        content: parsed.data.content,
        placement: "search_results",
        plan: "basic",
      });
  if (error) {
    return { error: "Couldn't save this ad. Please try again." };
  }
  return {};
}

export async function setBatchAdActive(adId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("advertisements")
    .update({ status: active ? "active" : "removed" })
    .eq("id", adId)
    .eq("owner_type", "teacher")
    .eq("owner_id", user.id);
  if (error) {
    return { error: "Couldn't update this ad. Please try again." };
  }
  return {};
}
