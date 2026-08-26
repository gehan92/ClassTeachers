"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
