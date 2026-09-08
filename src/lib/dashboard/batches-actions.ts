"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notify } from "./notify";

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
  description: z.string().trim().max(2000).optional(),
  teacherLabel: z.string().trim().optional(),
  taughtByTeacherId: z.string().uuid().optional(),
  gradeBand: z.enum(gradeBands).optional(),
  courseCode: z.string().trim().max(30).optional(),
  subjectName: z.string().trim().min(1).max(80).optional(),
  isOpenEnrollment: z.boolean().optional(),
  capacity: z.number().int().positive().optional(),
});

export async function createBatch(input: {
  ownerType: "teacher" | "class";
  title: string;
  mode: "online" | "physical";
  classSizeType?: "group" | "individual";
  location: string;
  scheduleNote: string;
  description?: string;
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
  /** Open-enrollment batch (0106) — any student self-joins via
   * join_open_batch, skipping the request/accept step every other batch
   * uses. capacity is the optional cap join_open_batch enforces; omitted
   * means unlimited. */
  isOpenEnrollment?: boolean;
  capacity?: number;
}): Promise<ActionResult & { id?: string }> {
  const parsed = createBatchSchema.safeParse({
    ownerType: input.ownerType,
    title: input.title,
    mode: input.mode,
    classSizeType: input.classSizeType || undefined,
    location: input.location || undefined,
    scheduleNote: input.scheduleNote || undefined,
    description: input.description || undefined,
    teacherLabel: input.teacherLabel || undefined,
    taughtByTeacherId: input.taughtByTeacherId || undefined,
    gradeBand: input.gradeBand || undefined,
    courseCode: input.courseCode || undefined,
    subjectName: input.ownerType === "class" ? input.subjectName || undefined : undefined,
    isOpenEnrollment: input.isOpenEnrollment,
    capacity: input.capacity,
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

  const { data: inserted, error } = await supabase
    .from("batches")
    .insert({
      owner_type: parsed.data.ownerType,
      owner_id: ownerId,
      title: parsed.data.title,
      mode: parsed.data.mode,
      class_size_type: parsed.data.classSizeType ?? "group",
      location: parsed.data.location || null,
      schedule_note: parsed.data.scheduleNote || null,
      description: parsed.data.description || null,
      teacher_label: parsed.data.ownerType === "class" ? parsed.data.teacherLabel || null : null,
      taught_by_teacher_id: parsed.data.ownerType === "class" ? parsed.data.taughtByTeacherId ?? null : null,
      grade_band: parsed.data.gradeBand ?? null,
      course_code: parsed.data.courseCode ?? null,
      subject_id: subjectId,
      is_open_enrollment: parsed.data.isOpenEnrollment ?? false,
      capacity: parsed.data.isOpenEnrollment ? (parsed.data.capacity ?? null) : null,
    })
    .select("id")
    .single();
  if (error) {
    return { error: "Couldn't create the batch. Please try again." };
  }
  // Returned so the Classes tab can immediately attach weekly schedule slots
  // (setBatchScheduleSlots) right after creation, in the same "Add batch"
  // step -- otherwise a fresh batch has no slots and never shows up in the
  // calendar view until a separate edit.
  return { id: inserted.id };
}

const updateBatchSchema = z.object({
  ownerType: z.enum(["teacher", "class"]),
  title: z.string().trim().min(2),
  mode: z.enum(["online", "physical"]),
  classSizeType: z.enum(classSizeTypes).optional(),
  location: z.string().trim().optional(),
  scheduleNote: z.string().trim().optional(),
  description: z.string().trim().max(2000).optional(),
  teacherLabel: z.string().trim().optional(),
  taughtByTeacherId: z.string().uuid().optional(),
  gradeBand: z.enum(gradeBands).optional(),
  courseCode: z.string().trim().max(30).optional(),
  subjectName: z.string().trim().min(1).max(80).optional(),
  isOpenEnrollment: z.boolean().optional(),
  capacity: z.number().int().positive().optional(),
});

export async function updateBatch(
  batchId: string,
  input: {
    ownerType: "teacher" | "class";
    title: string;
    mode: "online" | "physical";
    classSizeType?: "group" | "individual";
    location: string;
    scheduleNote: string;
    description?: string;
    teacherLabel?: string;
    taughtByTeacherId?: string;
    gradeBand: string;
    courseCode?: string;
    subjectName?: string;
    isOpenEnrollment?: boolean;
    capacity?: number;
  },
): Promise<ActionResult> {
  if (!batchId) {
    return { error: "Invalid class." };
  }
  const parsed = updateBatchSchema.safeParse({
    ownerType: input.ownerType,
    title: input.title,
    mode: input.mode,
    classSizeType: input.classSizeType || undefined,
    location: input.location || undefined,
    scheduleNote: input.scheduleNote || undefined,
    description: input.description || undefined,
    teacherLabel: input.ownerType === "class" ? input.teacherLabel || undefined : undefined,
    taughtByTeacherId: input.ownerType === "class" ? input.taughtByTeacherId || undefined : undefined,
    gradeBand: input.gradeBand || undefined,
    courseCode: input.courseCode || undefined,
    subjectName: input.ownerType === "class" ? input.subjectName || undefined : undefined,
    isOpenEnrollment: input.isOpenEnrollment,
    capacity: input.capacity,
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
  let instituteName: string | null = null;
  if (parsed.data.ownerType === "class") {
    const { data: classProfile } = await supabase
      .from("class_profiles")
      .select("id, name")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!classProfile) {
      return { error: "No institute profile found for this account." };
    }
    ownerId = classProfile.id;
    instituteName = classProfile.name;
  }

  // Read before the update below overwrites it -- the only way to tell
  // "newly assigned to this teacher" from "already was this teacher" so the
  // notification below doesn't refire on every unrelated edit to the batch.
  let previousTeacherId: string | null = null;
  if (parsed.data.ownerType === "class") {
    const { data: existingBatch } = await supabase
      .from("batches")
      .select("taught_by_teacher_id")
      .eq("id", batchId)
      .maybeSingle();
    previousTeacherId = existingBatch?.taught_by_teacher_id ?? null;
  }

  let subjectId: string | null | undefined = undefined;
  if (parsed.data.ownerType === "class") {
    if (parsed.data.subjectName) {
      const { data: resolvedSubjectId, error: subjectError } = await supabase.rpc("resolve_subject", {
        subject_name: parsed.data.subjectName,
      });
      if (subjectError || !resolvedSubjectId) {
        return { error: "Couldn't resolve that subject. Please try again." };
      }
      subjectId = resolvedSubjectId;
    } else {
      subjectId = null;
    }
  }

  const { error } = await supabase
    .from("batches")
    .update({
      title: parsed.data.title,
      mode: parsed.data.mode,
      ...(parsed.data.classSizeType ? { class_size_type: parsed.data.classSizeType } : {}),
      location: parsed.data.location || null,
      schedule_note: parsed.data.scheduleNote || null,
      description: parsed.data.description || null,
      grade_band: parsed.data.gradeBand ?? null,
      course_code: parsed.data.courseCode ?? null,
      ...(parsed.data.ownerType === "class"
        ? {
            teacher_label: parsed.data.teacherLabel || null,
            taught_by_teacher_id: parsed.data.taughtByTeacherId ?? null,
            subject_id: subjectId,
          }
        : {}),
      ...(parsed.data.isOpenEnrollment !== undefined
        ? {
            is_open_enrollment: parsed.data.isOpenEnrollment,
            capacity: parsed.data.isOpenEnrollment ? (parsed.data.capacity ?? null) : null,
          }
        : {}),
    })
    .eq("id", batchId)
    .eq("owner_type", parsed.data.ownerType)
    .eq("owner_id", ownerId);
  if (error) {
    return { error: "Couldn't update this class. Please try again." };
  }

  if (
    parsed.data.ownerType === "class" &&
    parsed.data.taughtByTeacherId &&
    parsed.data.taughtByTeacherId !== previousTeacherId
  ) {
    await notify(
      supabase,
      parsed.data.taughtByTeacherId,
      "institute_batch_assigned",
      { batchTitle: parsed.data.title, instituteName: instituteName ?? "—" },
      "institute",
    );
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
export async function deleteBatch(batchId: string, ownerType: "teacher" | "class" = "teacher"): Promise<ActionResult> {
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

  let ownerId = user.id;
  if (ownerType === "class") {
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
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId);
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
 * Open-enrollment batches (0106) skip requestToJoin's pending step entirely
 * — join_open_batch inserts (or flips) the enrollment straight to
 * 'accepted', gated server-side on batches.is_open_enrollment and, when
 * set, capacity, since the RLS insert policy itself only ever allows a
 * client to insert 'pending'.
 */
export async function joinOpenBatch(batchId: string): Promise<ActionResult> {
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

  const { error } = await supabase.rpc("join_open_batch", { p_batch_id: batchId });
  if (error) {
    if (error.message.includes("class_not_found")) {
      return { error: "That class couldn't be found." };
    }
    if (error.message.includes("batch_full")) {
      return { error: "This class is full." };
    }
    return { error: "Couldn't join this class. Please try again." };
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
 *
 * declineReason is optional (Gehan: a decline shouldn't require an essay) —
 * only ever written when accept is false; ignored otherwise.
 */
export async function respondToJoinRequest(
  enrollmentId: string,
  accept: boolean,
  batchId?: string,
  declineReason?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: updated, error } = await supabase
    .from("enrollments")
    .update({
      status: accept ? "accepted" : "declined",
      ...(accept && batchId ? { batch_id: batchId } : {}),
      ...(!accept ? { decline_reason: declineReason?.trim() || null } : {}),
    })
    .eq("id", enrollmentId)
    .select("student_id, owner_type, owner_id")
    .maybeSingle();
  if (error) {
    if (error.message.includes("duplicate key") || error.code === "23505") {
      return { error: "This student already has a request for that class." };
    }
    return { error: "Couldn't update this request. Please try again." };
  }

  if (updated) {
    let ownerName = "—";
    if (updated.owner_type === "teacher") {
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", updated.owner_id).maybeSingle();
      ownerName = p?.full_name ?? "—";
    } else {
      const { data: cp } = await supabase.from("class_profiles").select("name").eq("id", updated.owner_id).maybeSingle();
      ownerName = cp?.name ?? "—";
    }
    await notify(
      supabase,
      updated.student_id,
      accept ? "join_request_accepted" : "join_request_declined",
      accept ? { ownerName } : { ownerName, reason: declineReason?.trim() || null },
      // Accepted requests land the student in My Classes; a decline stays
      // visible (with its reason) in the Requests tab, not My Classes.
      accept ? "classes" : "requests",
      "joinRequestUpdates",
    );
  }
  return {};
}

/**
 * Lets a student withdraw their own not-yet-decided request — the owner
 * hasn't acted on it, so there's nothing on their side to reverse, just the
 * row itself to remove. Reuses the existing "a student can leave; admin can
 * remove any enrollment" DELETE policy (0013, no status restriction there),
 * with the status='pending' filter enforced here so a student can't delete
 * an already-accepted or already-declined record through this action.
 */
export async function cancelJoinRequest(enrollmentId: string): Promise<ActionResult> {
  if (!enrollmentId) {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("enrollments")
    .delete()
    .eq("id", enrollmentId)
    .eq("student_id", user.id)
    .eq("status", "pending");
  if (error) {
    return { error: "Couldn't cancel this request. Please try again." };
  }
  return {};
}

/**
 * General "Join this institute" apply — no batch chosen yet (see
 * request_to_join_class, 0103). Distinct from requestToJoin(batchId) above,
 * which is always batch-scoped. The institute assigns a batch later, if it
 * wants to, when accepting (see respondToJoinRequest's batchId param).
 */
const scheduleSlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

/**
 * Replace-all, not a diff — the editor always sends its whole current list,
 * same "delete then re-insert the full set" shape as this app already uses
 * for exam/live-class participants when a teacher edits an existing list.
 * Nothing else references a schedule slot by id, so there's no downstream
 * data that a full replace could orphan.
 */
export async function setBatchScheduleSlots(
  batchId: string,
  ownerType: "teacher" | "class",
  slots: { dayOfWeek: number; startTime: string; endTime: string }[],
): Promise<ActionResult> {
  if (!batchId) {
    return { error: "Invalid class." };
  }
  const parsed = z.array(scheduleSlotSchema).safeParse(slots);
  if (!parsed.success) {
    return { error: "Please check the schedule times and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  let ownerId = user.id;
  if (ownerType === "class") {
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

  const { error: deleteError } = await supabase
    .from("batch_schedule_slots")
    .delete()
    .eq("batch_id", batchId)
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId);
  if (deleteError) {
    return { error: "Couldn't save the weekly schedule. Please try again." };
  }

  if (parsed.data.length === 0) {
    return {};
  }

  const { error: insertError } = await supabase.from("batch_schedule_slots").insert(
    parsed.data.map((slot) => ({
      batch_id: batchId,
      owner_type: ownerType,
      owner_id: ownerId,
      day_of_week: slot.dayOfWeek,
      start_time: slot.startTime,
      end_time: slot.endTime,
    })),
  );
  if (insertError) {
    return { error: "Couldn't save the weekly schedule. Please try again." };
  }
  return {};
}

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

