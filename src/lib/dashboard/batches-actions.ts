"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notify } from "./notify";
import { TEACHER_CONNECTION_FEE, CLASS_JOIN_FEE, INSTITUTE_UNLOCK_FEE } from "@/lib/payhere/fees";

type ActionResult = { error: string } | { error?: undefined };

const gradeBands = ["1-5", "6-9", "10-11", "12-13", "campus", "adult"] as const;
const classSizeTypes = ["group", "individual"] as const;

const createBatchSchema = z.object({
  ownerType: z.enum(["teacher", "class"]),
  title: z.string().trim().min(2),
  mode: z.enum(["online", "physical", "travels_to_student"]),
  classSizeType: z.enum(classSizeTypes).optional(),
  location: z.string().trim().optional(),
  scheduleNote: z.string().trim().optional(),
  description: z.string().trim().max(2000).optional(),
  teacherLabel: z.string().trim().optional(),
  taughtByTeacherId: z.string().uuid().optional(),
  gradeBand: z.enum(gradeBands).optional(),
  courseCode: z.string().trim().max(30).optional(),
  /** Campus lecturer only, same UI-gated convention as courseCode above —
   * a batch with this set reads as a "Course" (multi-session, structured)
   * rather than an ongoing "Class" (0139, Course Ad). */
  totalSessions: z.number().int().positive().optional(),
  subjectName: z.string().trim().min(1).max(80).optional(),
  isOpenEnrollment: z.boolean().optional(),
  capacity: z.number().int().positive().optional(),
});

export async function createBatch(input: {
  ownerType: "teacher" | "class";
  title: string;
  mode: "online" | "physical" | "travels_to_student";
  classSizeType?: "group" | "individual";
  location: string;
  scheduleNote: string;
  description?: string;
  teacherLabel?: string;
  taughtByTeacherId?: string;
  gradeBand: string;
  courseCode?: string;
  totalSessions?: number;
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
    totalSessions: input.totalSessions,
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
      total_sessions: parsed.data.totalSessions ?? null,
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
  mode: z.enum(["online", "physical", "travels_to_student"]),
  classSizeType: z.enum(classSizeTypes).optional(),
  location: z.string().trim().optional(),
  scheduleNote: z.string().trim().optional(),
  description: z.string().trim().max(2000).optional(),
  teacherLabel: z.string().trim().optional(),
  taughtByTeacherId: z.string().uuid().optional(),
  gradeBand: z.enum(gradeBands).optional(),
  courseCode: z.string().trim().max(30).optional(),
  totalSessions: z.number().int().positive().optional(),
  subjectName: z.string().trim().min(1).max(80).optional(),
  isOpenEnrollment: z.boolean().optional(),
  capacity: z.number().int().positive().optional(),
});

export async function updateBatch(
  batchId: string,
  input: {
    ownerType: "teacher" | "class";
    title: string;
    mode: "online" | "physical" | "travels_to_student";
    classSizeType?: "group" | "individual";
    location: string;
    scheduleNote: string;
    description?: string;
    teacherLabel?: string;
    taughtByTeacherId?: string;
    gradeBand: string;
    courseCode?: string;
    totalSessions?: number;
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
    totalSessions: input.totalSessions,
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
      total_sessions: parsed.data.totalSessions ?? null,
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
      // Accepting no longer drops the student straight into "in" —
      // qna_open is the free Q&A step the platform-fee funnel inserts
      // before a paid/waived "joined" (see 0146's header comment).
      status: accept ? "qna_open" : "declined",
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
    if (accept) {
      // Opens the Q&A thread the student and owner will actually talk in —
      // idempotent, safe even if this ever runs twice for the same row.
      await supabase.rpc("open_qna_thread", { p_enrollment_id: enrollmentId });
    }
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
      // Both cases stay in the student's connections view now — an accept
      // only opens Q&A, it doesn't land the student in My Classes anymore
      // (that only happens once they've actually paid/waived and joined).
      "connections",
      "joinRequestUpdates",
    );
  }
  return {};
}

/**
 * Flow A step 4 / Flow B step 4's "Join" click — only valid once the owner
 * has accepted (status='qna_open'). Waives the platform fee on a student's
 * very first-ever completed platform payment (globally, not per-owner, see
 * is_first_platform_connection, 0147); otherwise creates a pending
 * platform_payments row for the caller to redirect into PayHere checkout
 * with. Nothing here ever sets status='joined' directly except the waiver
 * path — a real payment only reaches 'joined' via mark_payment_completed(),
 * called from the PayHere notify webhook once the fee is actually paid.
 */
export async function joinAfterQna(
  enrollmentId: string,
): Promise<ActionResult & { waived?: boolean; payment?: { id: string; orderId: string; amount: number } }> {
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

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, owner_type, status")
    .eq("id", enrollmentId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (!enrollment) {
    return { error: "That request couldn't be found." };
  }
  if (enrollment.status !== "qna_open") {
    return { error: "This request isn't ready to join yet." };
  }

  const { data: waiveEligible } = await supabase.rpc("is_first_platform_connection");
  if (waiveEligible) {
    const { error } = await supabase
      .from("enrollments")
      .update({ status: "joined", platform_fee_waived: true })
      .eq("id", enrollmentId);
    if (error) {
      return { error: "Couldn't complete your join. Please try again." };
    }
    return { waived: true };
  }

  const purpose = enrollment.owner_type === "teacher" ? "teacher_connection" : "class_join";
  const amount = purpose === "teacher_connection" ? TEACHER_CONNECTION_FEE : CLASS_JOIN_FEE;
  const orderId = `${purpose}_${enrollmentId}_${Date.now()}`;
  const { data: payment, error: paymentError } = await supabase
    .from("platform_payments")
    .insert({ student_id: user.id, purpose, enrollment_id: enrollmentId, amount, payhere_order_id: orderId })
    .select("id")
    .single();
  if (paymentError || !payment) {
    return { error: "Couldn't start the payment. Please try again." };
  }
  return { payment: { id: payment.id, orderId, amount } };
}

/**
 * Flow B step 2's "Unlock institute" click. Idempotent: an existing
 * institute_access row (already unlocked) is a no-op success, never a
 * second charge. Otherwise creates a pending platform_payments row exactly
 * like joinAfterQna above, for the caller to redirect into PayHere
 * checkout with — completion still only ever happens via
 * mark_payment_completed() from the notify webhook.
 */
export async function unlockInstitute(
  instituteId: string,
): Promise<ActionResult & { alreadyUnlocked?: boolean; payment?: { id: string; orderId: string; amount: number } }> {
  if (!instituteId) {
    return { error: "Invalid institute." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: existing } = await supabase
    .from("institute_access")
    .select("id")
    .eq("student_id", user.id)
    .eq("institute_id", instituteId)
    .maybeSingle();
  if (existing) {
    return { alreadyUnlocked: true };
  }

  const orderId = `institute_unlock_${instituteId}_${user.id}_${Date.now()}`;
  const { data: payment, error: paymentError } = await supabase
    .from("platform_payments")
    .insert({
      student_id: user.id,
      purpose: "institute_unlock",
      institute_id: instituteId,
      amount: INSTITUTE_UNLOCK_FEE,
      payhere_order_id: orderId,
    })
    .select("id")
    .single();
  if (paymentError || !payment) {
    return { error: "Couldn't start the payment. Please try again." };
  }
  return { payment: { id: payment.id, orderId, amount: INSTITUTE_UNLOCK_FEE } };
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

const JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids look-alike mix-ups when read aloud or handwritten

function randomJoinCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)];
  }
  return code;
}

/**
 * (Re)generates a batch's join code — a short code the owner shares
 * out-of-band (WhatsApp, printed handout) so a student can join instantly
 * via joinBatchByCode below, independent of is_open_enrollment. Calling this
 * again always replaces the previous code, invalidating it — expected
 * behavior for a "regenerate," not a bug.
 */
export async function generateBatchJoinCode(
  batchId: string,
  ownerType: "teacher" | "class" = "teacher",
): Promise<{ code: string; error?: undefined } | { error: string; code?: undefined }> {
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
    const { data: classProfile } = await supabase.from("class_profiles").select("id").eq("owner_id", user.id).maybeSingle();
    if (!classProfile) {
      return { error: "No institute profile found for this account." };
    }
    ownerId = classProfile.id;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomJoinCode();
    const { error } = await supabase
      .from("batches")
      .update({ join_code: code })
      .eq("id", batchId)
      .eq("owner_type", ownerType)
      .eq("owner_id", ownerId);
    if (!error) return { code };
    if (error.code !== "23505") return { error: "Couldn't generate a join code. Please try again." };
    // 23505 = unique violation on join_code — extremely unlikely with a
    // 6-char, 33-symbol alphabet, but retry with a fresh code rather than fail.
  }
  return { error: "Couldn't generate a unique join code. Please try again." };
}

export type BulkEnrollResult = { phone: string; result: "enrolled" | "already_enrolled" | "not_found" };

/**
 * CSV bulk import, safe scope: matches against existing registered student
 * accounts by phone and enrolls them into a batch — no new accounts
 * created. See bulk_enroll_students_by_phone (0134).
 */
export async function bulkEnrollStudentsByPhone(
  batchId: string,
  phones: string[],
): Promise<{ results: BulkEnrollResult[]; error?: undefined } | { error: string; results?: undefined }> {
  const cleaned = [...new Set(phones.map((p) => p.trim()).filter(Boolean))];
  if (cleaned.length === 0) {
    return { error: "Paste at least one phone number." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data, error } = await supabase.rpc("bulk_enroll_students_by_phone", { p_batch_id: batchId, p_phones: cleaned });
  if (error) {
    if (error.message.includes("batch_not_found")) {
      return { error: "That class couldn't be found." };
    }
    return { error: "Couldn't import students. Please try again." };
  }
  return { results: data ?? [] };
}

export async function joinBatchByCode(code: string): Promise<ActionResult> {
  const trimmed = code.trim();
  if (!trimmed) {
    return { error: "Enter a join code." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase.rpc("join_batch_by_code", { p_code: trimmed });
  if (error) {
    if (error.message.includes("invalid_code")) {
      return { error: "That join code isn't valid. Double-check it with your teacher/institute." };
    }
    if (error.message.includes("batch_full")) {
      return { error: "This class is full." };
    }
    return { error: "Couldn't join this class. Please try again." };
  }
  return {};
}

