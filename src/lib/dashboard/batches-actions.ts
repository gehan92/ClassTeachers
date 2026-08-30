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
  subjectName: z.string().trim().min(1).max(80).optional(),
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
  /** Institute class-builder only (Institute Blueprint step 5) — the
   * teacher's own batch builder deliberately has no subject field, since
   * upsertBatchAd/createIndividualAd is already the one place a teacher
   * assigns a batch's subject (see that file's own comment). Resolved via
   * resolve_subject() so an institute admin can type either a real
   * syllabus subject or an ad-hoc/open-course name. */
  subjectName?: string;
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
    subjectName: input.ownerType === "class" ? input.subjectName || undefined : undefined,
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

  let subjectId: string | null = null;
  if (parsed.data.subjectName) {
    const { data: resolvedSubjectId, error: subjectError } = await supabase.rpc("resolve_subject", {
      subject_name: parsed.data.subjectName,
    });
    if (subjectError || !resolvedSubjectId) {
      return { error: "Couldn't resolve that subject. Please try again." };
    }
    subjectId = resolvedSubjectId;
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
    subject_id: subjectId,
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
 * batch browser. Always a pending request the owner (teacher or institute)
 * must accept before it unlocks anything — the enrollments insert policy
 * enforces status='pending' regardless of owner_type (0040/0097), so this
 * can't be bypassed into an instant accept.
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
      return { error: "You've already sent a request (or joined) this class." };
    }
    return { error: "Couldn't send your request. Please try again." };
  }
  return {};
}

/**
 * batchId is only meaningful when accepting a general (batch_id IS NULL)
 * institute request — it lets the institute place the student into a
 * specific class as part of approval, since a general "Join this institute"
 * request (requestToJoinClass) never had one chosen at apply time, unlike a
 * batch-scoped request (requestToJoin) which already picked its batch. Left
 * undefined, approval just flips status, same as before.
 */
export async function respondToJoinRequest(
  enrollmentId: string,
  accept: boolean,
  batchId?: string,
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
    .update({
      status: accept ? "accepted" : "declined",
      ...(accept && batchId ? { batch_id: batchId } : {}),
    })
    .eq("id", enrollmentId);
  if (error) {
    if (error.message.includes("duplicate key") || error.code === "23505") {
      return { error: "This student already has a request for that class." };
    }
    return { error: "Couldn't update this request. Please try again." };
  }
  return {};
}

/**
 * General "Join this institute" apply — no batch chosen yet (see
 * request_to_join_class, 0103). Distinct from requestToJoin(batchId) above,
 * which is always batch-scoped. The institute assigns a batch later, if it
 * wants to, when accepting (see respondToJoinRequest's batchId param).
 */
export async function requestToJoinClass(classId: string): Promise<ActionResult> {
  if (!classId) {
    return { error: "Invalid institute." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase.rpc("request_to_join_class", { p_class_id: classId });
  if (error) {
    if (error.message.includes("class_not_found")) {
      return { error: "That institute couldn't be found." };
    }
    if (error.message.includes("already_requested")) {
      return { error: "You've already sent a request (or joined) this institute." };
    }
    return { error: "Couldn't send your request. Please try again." };
  }
  return {};
}

