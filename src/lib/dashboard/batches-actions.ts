"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

const gradeBands = ["1-5", "6-9", "10-11", "12-13", "campus"] as const;

const createBatchSchema = z.object({
  ownerType: z.enum(["teacher", "class"]),
  title: z.string().trim().min(2),
  mode: z.enum(["online", "physical"]),
  location: z.string().trim().optional(),
  scheduleNote: z.string().trim().optional(),
  teacherLabel: z.string().trim().optional(),
  gradeBand: z.enum(gradeBands).optional(),
});

export async function createBatch(input: {
  ownerType: "teacher" | "class";
  title: string;
  mode: "online" | "physical";
  location: string;
  scheduleNote: string;
  teacherLabel?: string;
  gradeBand: string;
}): Promise<ActionResult> {
  const parsed = createBatchSchema.safeParse({
    ownerType: input.ownerType,
    title: input.title,
    mode: input.mode,
    location: input.location || undefined,
    scheduleNote: input.scheduleNote || undefined,
    teacherLabel: input.teacherLabel || undefined,
    gradeBand: input.gradeBand || undefined,
  });
  if (!parsed.success) {
    return { error: "Please check the highlighted fields and try again." };
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

  const { error } = await supabase.from("batches").insert({
    owner_type: parsed.data.ownerType,
    owner_id: ownerId,
    title: parsed.data.title,
    mode: parsed.data.mode,
    location: parsed.data.location || null,
    schedule_note: parsed.data.scheduleNote || null,
    teacher_label: parsed.data.ownerType === "class" ? parsed.data.teacherLabel || null : null,
    grade_band: parsed.data.gradeBand ?? null,
  });
  if (error) {
    return { error: "Couldn't create the batch. Please try again." };
  }
  return {};
}

export async function joinBatch(batchId: string): Promise<ActionResult> {
  if (!batchId) {
    return { error: "Invalid batch." };
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
    .select("owner_type, owner_id")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) {
    return { error: "That class couldn't be found." };
  }

  const { error } = await supabase.from("enrollments").insert({
    student_id: user.id,
    owner_type: batch.owner_type,
    owner_id: batch.owner_id,
    batch_id: batchId,
  });
  if (error) {
    if (error.code === "23505") {
      return { error: "You've already joined this class." };
    }
    return { error: "Couldn't join this class. Please try again." };
  }
  return {};
}
