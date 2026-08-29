"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

const gradeBands = ["1-5", "6-9", "10-11", "12-13", "campus"] as const;
const classSizeTypes = ["group", "individual"] as const;

const createBatchSchema = z.object({
  ownerType: z.enum(["teacher", "class"]),
  title: z.string().trim().min(2),
  mode: z.enum(["online", "physical"]),
  classSizeType: z.enum(classSizeTypes).optional(),
  location: z.string().trim().optional(),
  scheduleNote: z.string().trim().optional(),
  teacherLabel: z.string().trim().optional(),
  taughtByTeacherId: z.string().uuid().optional(),
  gradeBand: z.enum(gradeBands).optional(),
  courseCode: z.string().trim().max(30).optional(),
});

export async function createBatch(input: {
  ownerType: "teacher" | "class";
  title: string;
  mode: "online" | "physical";
  classSizeType?: "group" | "individual";
  location: string;
  scheduleNote: string;
  teacherLabel?: string;
  taughtByTeacherId?: string;
  gradeBand: string;
  courseCode?: string;
}): Promise<ActionResult> {
  const parsed = createBatchSchema.safeParse({
    ownerType: input.ownerType,
    title: input.title,
    mode: input.mode,
    classSizeType: input.classSizeType || undefined,
    location: input.location || undefined,
    scheduleNote: input.scheduleNote || undefined,
    teacherLabel: input.teacherLabel || undefined,
    taughtByTeacherId: input.taughtByTeacherId || undefined,
    gradeBand: input.gradeBand || undefined,
    courseCode: input.courseCode || undefined,
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
    class_size_type: parsed.data.classSizeType ?? "group",
    location: parsed.data.location || null,
    schedule_note: parsed.data.scheduleNote || null,
    teacher_label: parsed.data.ownerType === "class" ? parsed.data.teacherLabel || null : null,
    taught_by_teacher_id: parsed.data.ownerType === "class" ? parsed.data.taughtByTeacherId ?? null : null,
    grade_band: parsed.data.gradeBand ?? null,
    course_code: parsed.data.courseCode ?? null,
  });
  if (error) {
    return { error: "Couldn't create the batch. Please try again." };
  }
  return {};
}

const updateBatchSchema = z.object({
  title: z.string().trim().min(2),
  mode: z.enum(["online", "physical"]),
  classSizeType: z.enum(classSizeTypes),
  location: z.string().trim().optional(),
  scheduleNote: z.string().trim().optional(),
  gradeBand: z.enum(gradeBands).optional(),
  courseCode: z.string().trim().max(30).optional(),
});

export async function updateBatch(
  batchId: string,
  input: {
    title: string;
    mode: "online" | "physical";
    classSizeType: "group" | "individual";
    location: string;
    scheduleNote: string;
    gradeBand: string;
    courseCode?: string;
  },
): Promise<ActionResult> {
  if (!batchId) {
    return { error: "Invalid class." };
  }
  const parsed = updateBatchSchema.safeParse({
    title: input.title,
    mode: input.mode,
    classSizeType: input.classSizeType,
    location: input.location || undefined,
    scheduleNote: input.scheduleNote || undefined,
    gradeBand: input.gradeBand || undefined,
    courseCode: input.courseCode || undefined,
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

  const { error } = await supabase
    .from("batches")
    .update({
      title: parsed.data.title,
      mode: parsed.data.mode,
      class_size_type: parsed.data.classSizeType,
      location: parsed.data.location || null,
      schedule_note: parsed.data.scheduleNote || null,
      grade_band: parsed.data.gradeBand ?? null,
      course_code: parsed.data.courseCode ?? null,
    })
    .eq("id", batchId)
    .eq("owner_type", "teacher")
    .eq("owner_id", user.id);
  if (error) {
    return { error: "Couldn't update this class. Please try again." };
  }
  return {};
}

/**
 * advertisements.batch_id is ON DELETE CASCADE (0039) — a search-results ad
 * is meaningless without the batch it promotes, so deleting the batch would
 * silently take the ad down too with no separate confirmation. Blocking
 * here while an ad is active is deliberate (chosen over "warn, then allow")
 * so a teacher can never lose a live listing by mistake; every other table
 * that references a batch (enrollments, notes, question bank, assignments,
 * live classes, exams) falls back to "unscoped/general" instead of
 * breaking, so this is the one case that actually needs a guard.
 */
export async function deleteBatch(batchId: string): Promise<ActionResult> {
  if (!batchId) {
    return { error: "Invalid class." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: activeAd } = await supabase
    .from("advertisements")
    .select("id")
    .eq("batch_id", batchId)
    .eq("status", "active")
    .maybeSingle();
  if (activeAd) {
    return { error: "This class has a live ad. Pause or remove it in the Advertisement tab before deleting this class." };
  }

  const { error } = await supabase
    .from("batches")
    .delete()
    .eq("id", batchId)
    .eq("owner_type", "teacher")
    .eq("owner_id", user.id);
  if (error) {
    return { error: "Couldn't delete this class. Please try again." };
  }
  return {};
}

/**
 * Used both from the ad-landing page (/ad/[id]) and the student dashboard's
 * batch browser. For a teacher, this is a pending request the teacher must
 * accept before it unlocks anything (0039/0040) — the enrollments insert
 * policy enforces status='pending' for owner_type='teacher', so this can't
 * be bypassed into an instant accept. Institute ('class') joins stay
 * instant/accepted for now — there's no institute-side accept/decline UI
 * yet, so the RLS policy requires 'accepted' there instead; see 0040.
 */
/**
 * Routed through rejoin_after_decline (0066) rather than a plain insert —
 * enrollments' unique (student_id, owner_type, owner_id) constraint (0013)
 * means a previously-declined request still occupies that row, so a plain
 * insert would always hit a duplicate-key error and report the misleading
 * "already sent a request" message even though the student was actually
 * turned down. The RPC transparently handles both the fresh-join and
 * re-request-after-decline cases in one atomic step.
 */
export async function requestToJoin(batchId: string): Promise<ActionResult> {
  if (!batchId) {
    return { error: "Invalid class." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase.rpc("rejoin_after_decline", { p_batch_id: batchId });
  if (error) {
    if (error.message.includes("class_not_found")) {
      return { error: "That class couldn't be found." };
    }
    if (error.message.includes("already_requested")) {
      return { error: "You've already sent a request (or joined) this teacher." };
    }
    return { error: "Couldn't send your request. Please try again." };
  }
  return {};
}

export async function respondToJoinRequest(
  enrollmentId: string,
  accept: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("enrollments")
    .update({ status: accept ? "accepted" : "declined" })
    .eq("id", enrollmentId);
  if (error) {
    return { error: "Couldn't update this request. Please try again." };
  }
  return {};
}

