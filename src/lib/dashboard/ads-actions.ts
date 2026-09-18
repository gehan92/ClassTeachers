"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRichText } from "@/lib/dashboard/sanitize-rich-text";
import { hasRichText } from "@/lib/rich-text";

type ActionResult = { error: string } | { error?: undefined };

/**
 * A "max" rate only ever makes sense alongside its own "min" (the existing
 * hourlyRate/monthlyRate field) -- a max with no min, or a max that isn't
 * actually higher, is a malformed range rather than something to silently
 * drop. Shared by upsertBatchAd and createIndividualAd, the two teacher ad
 * forms that gained this optional range (0120).
 */
function validateRateRange(min: number | undefined, max: number | undefined): string | null {
  if (max === undefined) return null;
  if (min === undefined) return "Add a starting rate before setting an upper rate.";
  if (max <= min) return "The upper rate must be higher than the starting rate.";
  return null;
}

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
  medium: z.enum(["english", "sinhala", "tamil", "other"]),
  classType: z.enum(["new", "revision"]),
  hourlyRate: z.number().positive().optional(),
  monthlyRate: z.number().positive().optional(),
  hourlyRateMax: z.number().positive().optional(),
  monthlyRateMax: z.number().positive().optional(),
});

/**
 * A search-results ad promotes one specific batch (0039), unlike the single
 * own_profile promotion above. Saving here also stamps the batch's
 * subject_id if it isn't set yet — there's no separate "edit batch" UI, so
 * this is the one place a teacher assigns a batch's subject. hourlyRate/
 * monthlyRate (0041) are per-batch overrides of the teacher's profile rate —
 * omitted/undefined clears the override back to "inherit the default".
 * hourlyRateMax/monthlyRateMax (0120) turn that single rate into a range —
 * only meaningful alongside their own min, validated below.
 */
export async function upsertBatchAd(input: {
  batchId: string;
  subjectId: string;
  title: string;
  content: string;
  medium: "english" | "sinhala" | "tamil" | "other";
  classType: "new" | "revision";
  hourlyRate?: number;
  monthlyRate?: number;
  hourlyRateMax?: number;
  monthlyRateMax?: number;
}): Promise<ActionResult> {
  const parsed = upsertBatchAdSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please fill in the subject, title and details, then try again." };
  }
  const rangeError =
    validateRateRange(parsed.data.hourlyRate, parsed.data.hourlyRateMax) ??
    validateRateRange(parsed.data.monthlyRate, parsed.data.monthlyRateMax);
  if (rangeError) {
    return { error: rangeError };
  }
  const content = sanitizeRichText(parsed.data.content);
  if (!hasRichText(content)) {
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

  const { error: batchError } = await supabase
    .from("batches")
    .update({
      subject_id: parsed.data.subjectId,
      hourly_rate: parsed.data.hourlyRate ?? null,
      monthly_rate: parsed.data.monthlyRate ?? null,
      hourly_rate_max: parsed.data.hourlyRateMax ?? null,
      monthly_rate_max: parsed.data.monthlyRateMax ?? null,
      medium: parsed.data.medium,
      class_type: parsed.data.classType,
    })
    .eq("id", batch.id);
  if (batchError) {
    return { error: "Couldn't save this ad. Please try again." };
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
          content,
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
        content,
        placement: "search_results",
        plan: "basic",
      });
  if (error) {
    return { error: "Couldn't save this ad. Please try again." };
  }
  return {};
}

const lessonAdSchema = z.object({
  lessonId: z.string().uuid(),
  title: z.string().trim().min(2),
  content: z.string().trim().min(1),
});

/**
 * "Lesson/Grade-wise Ad" (0138) — a narrower promotion than upsertBatchAd's
 * ongoing Class Ad: one already-scheduled live class, offered as a one-off
 * trial/drop-in rather than a recurring arrangement. Find-or-update by
 * lesson_id, same upsert shape as upsertBatchAd (one ad per lesson, editing
 * re-runs this rather than erroring on a duplicate). Pause/resume and
 * delete reuse setBatchAdActive/deleteBatchAd below unchanged — neither
 * filters on batch_id, so they already work for any teacher-owned ad
 * regardless of whether it points at a batch or a lesson.
 */
export async function createLessonAd(input: { lessonId: string; title: string; content: string }): Promise<ActionResult> {
  const parsed = lessonAdSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please fill in the title and details, then try again." };
  }
  const content = sanitizeRichText(parsed.data.content);
  if (!hasRichText(content)) {
    return { error: "Please fill in the title and details, then try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: lesson } = await supabase
    .from("live_classes")
    .select("id, subject_id")
    .eq("id", parsed.data.lessonId)
    .eq("owner_type", "teacher")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!lesson) {
    return { error: "That lesson couldn't be found." };
  }

  const { data: existing } = await supabase
    .from("advertisements")
    .select("id")
    .eq("owner_type", "teacher")
    .eq("owner_id", user.id)
    .eq("lesson_id", lesson.id)
    .eq("placement", "search_results")
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("advertisements")
        .update({ title: parsed.data.title, content, status: "active" })
        .eq("id", existing.id)
    : await supabase.from("advertisements").insert({
        owner_type: "teacher",
        owner_id: user.id,
        lesson_id: lesson.id,
        subject_id: lesson.subject_id,
        title: parsed.data.title,
        content,
        placement: "search_results",
        plan: "basic",
      });
  if (error) {
    return { error: "Couldn't save this ad. Please try again." };
  }
  return {};
}

const createCourseAdSchema = z.object({
  courseTitle: z.string().trim().min(2),
  courseCode: z.string().trim().max(30).optional(),
  subjectId: z.string().uuid(),
  mode: z.enum(["online", "physical", "travels_to_student"]),
  totalSessions: z.number().int().positive(),
  medium: z.enum(["english", "sinhala", "tamil", "other"]),
  title: z.string().trim().min(2),
  content: z.string().trim().min(1),
  hourlyRate: z.number().positive().optional(),
  monthlyRate: z.number().positive().optional(),
  hourlyRateMax: z.number().positive().optional(),
  monthlyRateMax: z.number().positive().optional(),
});

/**
 * "Course Ad" (Gehan's mockup, section 2.3 Lecturer/Professor — Supply-Side)
 * — a structured, multi-session course rather than an ongoing tuition class.
 * Same "create the batch and its ad together" shape as createIndividualAd
 * above, with total_sessions (0139) as the field that actually distinguishes
 * a Course from a Class — grade_band is fixed to 'campus' since this row is
 * lecturer/professor-specific by definition. The resulting batch behaves
 * exactly like any other afterwards (Classes tab, search, roster), same as
 * createIndividualAd's own.
 */
export async function createCourseAd(input: {
  courseTitle: string;
  courseCode?: string;
  subjectId: string;
  mode: "online" | "physical" | "travels_to_student";
  totalSessions: number;
  medium: "english" | "sinhala" | "tamil" | "other";
  title: string;
  content: string;
  hourlyRate?: number;
  monthlyRate?: number;
  hourlyRateMax?: number;
  monthlyRateMax?: number;
}): Promise<ActionResult> {
  const parsed = createCourseAdSchema.safeParse({ ...input, courseCode: input.courseCode || undefined });
  if (!parsed.success) {
    return { error: "Please fill in the course title, subject, sessions and details." };
  }
  const rangeError =
    validateRateRange(parsed.data.hourlyRate, parsed.data.hourlyRateMax) ??
    validateRateRange(parsed.data.monthlyRate, parsed.data.monthlyRateMax);
  if (rangeError) {
    return { error: rangeError };
  }
  const content = sanitizeRichText(parsed.data.content);
  if (!hasRichText(content)) {
    return { error: "Please fill in the course title, subject, sessions and details." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
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

  const { data: batch, error: batchError } = await supabase
    .from("batches")
    .insert({
      owner_type: "teacher",
      owner_id: user.id,
      title: parsed.data.courseTitle,
      mode: parsed.data.mode,
      grade_band: "campus",
      course_code: parsed.data.courseCode ?? null,
      total_sessions: parsed.data.totalSessions,
      subject_id: parsed.data.subjectId,
      hourly_rate: parsed.data.hourlyRate ?? null,
      monthly_rate: parsed.data.monthlyRate ?? null,
      hourly_rate_max: parsed.data.hourlyRateMax ?? null,
      monthly_rate_max: parsed.data.monthlyRateMax ?? null,
      class_size_type: "group",
      medium: parsed.data.medium,
    })
    .select("id")
    .single();
  if (batchError || !batch) {
    return { error: "Couldn't create this course. Please try again." };
  }

  const { error: adError } = await supabase.from("advertisements").insert({
    owner_type: "teacher",
    owner_id: user.id,
    batch_id: batch.id,
    subject_id: parsed.data.subjectId,
    title: parsed.data.title,
    content,
    placement: "search_results",
    plan: "basic",
  });
  if (adError) {
    return { error: "Couldn't save this ad. Please try again." };
  }
  return {};
}

const classBatchAdContentSchema = z.object({
  title: z.string().trim().min(2),
  content: z.string().trim().min(1),
});

/**
 * An institute class can carry several ads at once (0104 dropped the
 * one-ad-per-batch cap 0103 originally copied from the teacher side) — so
 * creating and editing are separate actions instead of upsertBatchAd's
 * find-or-insert, and rate lives in its own updateClassBatchRate below
 * rather than in every ad's form (it's the class's rate, shared by however
 * many ads promote it — editing it from inside one ad card would silently
 * change what every other ad for the same class shows).
 */
export async function createClassBatchAd(input: { batchId: string; title: string; content: string }): Promise<ActionResult> {
  const parsed = classBatchAdContentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please fill in the title and details, then try again." };
  }
  const content = sanitizeRichText(parsed.data.content);
  if (!hasRichText(content)) {
    return { error: "Please fill in the title and details, then try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: classProfile } = await supabase.from("class_profiles").select("id").eq("owner_id", user.id).maybeSingle();
  if (!classProfile) {
    return { error: "No institute profile found for this account." };
  }

  const { data: batch } = await supabase
    .from("batches")
    .select("id, subject_id")
    .eq("id", input.batchId)
    .eq("owner_type", "class")
    .eq("owner_id", classProfile.id)
    .maybeSingle();
  if (!batch) {
    return { error: "That class couldn't be found." };
  }

  const { error } = await supabase.from("advertisements").insert({
    owner_type: "class",
    owner_id: classProfile.id,
    batch_id: batch.id,
    subject_id: batch.subject_id,
    title: parsed.data.title,
    content,
    placement: "search_results",
    plan: "basic",
  });
  if (error) {
    return { error: "Couldn't save this ad. Please try again." };
  }
  return {};
}

export async function updateClassBatchAd(adId: string, input: { title: string; content: string }): Promise<ActionResult> {
  const parsed = classBatchAdContentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please fill in the title and details, then try again." };
  }
  const content = sanitizeRichText(parsed.data.content);
  if (!hasRichText(content)) {
    return { error: "Please fill in the title and details, then try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: classProfile } = await supabase.from("class_profiles").select("id").eq("owner_id", user.id).maybeSingle();
  if (!classProfile) {
    return { error: "No institute profile found for this account." };
  }

  const { error } = await supabase
    .from("advertisements")
    .update({ title: parsed.data.title, content })
    .eq("id", adId)
    .eq("owner_type", "class")
    .eq("owner_id", classProfile.id);
  if (error) {
    return { error: "Couldn't save this ad. Please try again." };
  }
  return {};
}

export async function deleteClassBatchAd(adId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: classProfile } = await supabase.from("class_profiles").select("id").eq("owner_id", user.id).maybeSingle();
  if (!classProfile) {
    return { error: "No institute profile found for this account." };
  }

  // Soft delete (0109) — the row stays so it can show up in Ad history and
  // be restored later, rather than a hard .delete() with no way back.
  const { error } = await supabase
    .from("advertisements")
    .update({ status: "deleted" })
    .eq("id", adId)
    .eq("owner_type", "class")
    .eq("owner_id", classProfile.id);
  if (error) {
    return { error: "Couldn't delete this ad. Please try again." };
  }
  return {};
}

export async function deleteBatchAd(adId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  // Soft delete (0109), mirroring deleteClassBatchAd above — the teacher
  // side previously had no delete at all, only pause (setBatchAdActive).
  const { error } = await supabase
    .from("advertisements")
    .update({ status: "deleted" })
    .eq("id", adId)
    .eq("owner_type", "teacher")
    .eq("owner_id", user.id);
  if (error) {
    return { error: "Couldn't delete this ad. Please try again." };
  }
  return {};
}

const restoreAdSchema = z.object({ adId: z.string().uuid(), ownerType: z.enum(["teacher", "class"]) });

/**
 * Undo for deleteBatchAd/deleteClassBatchAd/deleteInstitutePromotion (0109)
 * — brings a deleted row back as 'removed' (paused), not straight back to
 * 'active', so the owner reviews it and flips it live again deliberately
 * rather than a restore silently making an old ad public again.
 */
export async function restoreAd(input: { adId: string; ownerType: "teacher" | "class" }): Promise<ActionResult> {
  const parsed = restoreAdSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Couldn't restore this ad. Please try again." };
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
    const { data: classProfile } = await supabase.from("class_profiles").select("id").eq("owner_id", user.id).maybeSingle();
    if (!classProfile) {
      return { error: "No institute profile found for this account." };
    }
    ownerId = classProfile.id;
  }

  const { error } = await supabase
    .from("advertisements")
    .update({ status: "removed" })
    .eq("id", parsed.data.adId)
    .eq("owner_type", parsed.data.ownerType)
    .eq("owner_id", ownerId);
  if (error) {
    return { error: "Couldn't restore this ad. Please try again." };
  }
  return {};
}

const createTeacherWiseAdSchema = z.object({
  teacherId: z.string().uuid(),
  title: z.string().trim().min(2),
  content: z.string().trim().min(1),
});

/**
 * "Teacher-Wise Ad" (0140, mockup section 2.4) — an institute-owned ad
 * about a specific staff member, e.g. "Meet our senior Physics lecturer".
 * Only ever a teacher genuinely on this institute's own roster (accepted,
 * not merely invited) can be featured — resolved from class_teachers
 * server-side, never trusted from the client. Editing/pausing/deleting
 * reuse updateClassBatchAd/setClassBatchAdActive/deleteClassBatchAd below
 * unchanged — none of them filter on batch_id, so they already work for any
 * class-owned ad regardless of whether it points at a batch or a teacher,
 * same reuse as the teacher dashboard's own lesson ads (0138).
 */
export async function createTeacherWiseAd(input: { teacherId: string; title: string; content: string }): Promise<ActionResult> {
  const parsed = createTeacherWiseAdSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please choose a teacher and fill in the title and details." };
  }
  const content = sanitizeRichText(parsed.data.content);
  if (!hasRichText(content)) {
    return { error: "Please choose a teacher and fill in the title and details." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: classProfile } = await supabase.from("class_profiles").select("id").eq("owner_id", user.id).maybeSingle();
  if (!classProfile) {
    return { error: "No institute profile found for this account." };
  }

  const { data: link } = await supabase
    .from("class_teachers")
    .select("teacher_id")
    .eq("class_id", classProfile.id)
    .eq("teacher_id", parsed.data.teacherId)
    .eq("status", "accepted")
    .maybeSingle();
  if (!link) {
    return { error: "That teacher isn't on your accepted roster." };
  }

  const { error } = await supabase.from("advertisements").insert({
    owner_type: "class",
    owner_id: classProfile.id,
    featured_teacher_id: parsed.data.teacherId,
    title: parsed.data.title,
    content,
    placement: "search_results",
    plan: "basic",
  });
  if (error) {
    return { error: "Couldn't save this ad. Please try again." };
  }
  return {};
}

export async function updateClassBatchRate(input: {
  batchId: string;
  hourlyRate?: number;
  monthlyRate?: number;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: classProfile } = await supabase.from("class_profiles").select("id").eq("owner_id", user.id).maybeSingle();
  if (!classProfile) {
    return { error: "No institute profile found for this account." };
  }

  const { error } = await supabase
    .from("batches")
    .update({ hourly_rate: input.hourlyRate ?? null, monthly_rate: input.monthlyRate ?? null })
    .eq("id", input.batchId)
    .eq("owner_type", "class")
    .eq("owner_id", classProfile.id);
  if (error) {
    return { error: "Couldn't save the rate. Please try again." };
  }
  return {};
}

const institutePromotionSchema = z.object({ content: z.string().trim().min(1) });

/**
 * Institute equivalent of the multi-ad class model above, but for the
 * whole-institute (own_profile placement) promo — 0103's updateOwnProfileAd
 * stays exactly as-is for the teacher dashboard's single promo box; this is
 * the institute-only path to a full list instead.
 */
export async function createInstitutePromotion(content: string): Promise<ActionResult> {
  const parsed = institutePromotionSchema.safeParse({ content });
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

  const { data: classProfile } = await supabase.from("class_profiles").select("id").eq("owner_id", user.id).maybeSingle();
  if (!classProfile) {
    return { error: "No institute profile found for this account." };
  }

  const { error } = await supabase.from("advertisements").insert({
    owner_type: "class",
    owner_id: classProfile.id,
    title: "Institute promotion",
    content: parsed.data.content,
    placement: "own_profile",
    plan: "basic",
  });
  if (error) {
    return { error: "Couldn't save your promotion. Please try again." };
  }
  return {};
}

export async function updateInstitutePromotion(adId: string, content: string): Promise<ActionResult> {
  const parsed = institutePromotionSchema.safeParse({ content });
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

  const { data: classProfile } = await supabase.from("class_profiles").select("id").eq("owner_id", user.id).maybeSingle();
  if (!classProfile) {
    return { error: "No institute profile found for this account." };
  }

  const { error } = await supabase
    .from("advertisements")
    .update({ content: parsed.data.content })
    .eq("id", adId)
    .eq("owner_type", "class")
    .eq("owner_id", classProfile.id)
    .eq("placement", "own_profile");
  if (error) {
    return { error: "Couldn't save your promotion. Please try again." };
  }
  return {};
}

export async function deleteInstitutePromotion(adId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: classProfile } = await supabase.from("class_profiles").select("id").eq("owner_id", user.id).maybeSingle();
  if (!classProfile) {
    return { error: "No institute profile found for this account." };
  }

  // Soft delete (0109) — see deleteClassBatchAd above.
  const { error } = await supabase
    .from("advertisements")
    .update({ status: "deleted" })
    .eq("id", adId)
    .eq("owner_type", "class")
    .eq("owner_id", classProfile.id)
    .eq("placement", "own_profile");
  if (error) {
    return { error: "Couldn't delete your promotion. Please try again." };
  }
  return {};
}

export async function setClassBatchAdActive(adId: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: classProfile } = await supabase.from("class_profiles").select("id").eq("owner_id", user.id).maybeSingle();
  if (!classProfile) {
    return { error: "No institute profile found for this account." };
  }

  const { error } = await supabase
    .from("advertisements")
    .update({ status: active ? "active" : "removed" })
    .eq("id", adId)
    .eq("owner_type", "class")
    .eq("owner_id", classProfile.id);
  if (error) {
    return { error: "Couldn't update this ad. Please try again." };
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

const gradeBands = ["1-5", "6-9", "10-11", "12-13", "campus", "adult"] as const;

const createIndividualAdSchema = z.object({
  subjectId: z.string().uuid(),
  mode: z.enum(["online", "physical", "travels_to_student"]),
  gradeBand: z.enum(gradeBands).optional(),
  title: z.string().trim().min(2),
  content: z.string().trim().min(1),
  medium: z.enum(["english", "sinhala", "tamil", "other"]),
  classType: z.enum(["new", "revision"]),
  hourlyRate: z.number().positive().optional(),
  monthlyRate: z.number().positive().optional(),
  hourlyRateMax: z.number().positive().optional(),
  monthlyRateMax: z.number().positive().optional(),
});

/**
 * upsertBatchAd() requires an existing batch to attach an ad to — fine for
 * a teacher running a real scheduled class, but it meant a teacher with no
 * batches at all (e.g. flexible one-on-one tutoring, no fixed class) simply
 * couldn't advertise. This creates a lightweight batch (no location/schedule
 * — those genuinely don't apply) and its ad together in one step, so
 * "batch" stays invisible plumbing instead of a mandatory prerequisite. The
 * resulting batch behaves exactly like any other afterwards (shows up in
 * Classes, gets a roster once a request is accepted, etc.).
 */
export async function createIndividualAd(input: {
  subjectId: string;
  mode: "online" | "physical" | "travels_to_student";
  gradeBand?: string;
  title: string;
  content: string;
  medium: "english" | "sinhala" | "tamil" | "other";
  classType: "new" | "revision";
  hourlyRate?: number;
  monthlyRate?: number;
  hourlyRateMax?: number;
  monthlyRateMax?: number;
}): Promise<ActionResult> {
  const parsed = createIndividualAdSchema.safeParse({
    ...input,
    gradeBand: input.gradeBand || undefined,
  });
  if (!parsed.success) {
    return { error: "Please fill in the subject, mode, and title and details." };
  }
  const rangeError =
    validateRateRange(parsed.data.hourlyRate, parsed.data.hourlyRateMax) ??
    validateRateRange(parsed.data.monthlyRate, parsed.data.monthlyRateMax);
  if (rangeError) {
    return { error: rangeError };
  }
  const content = sanitizeRichText(parsed.data.content);
  if (!hasRichText(content)) {
    return { error: "Please fill in the subject, mode, and title and details." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
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

  const { data: subjectRow } = await supabase
    .from("subjects")
    .select("translations")
    .eq("id", parsed.data.subjectId)
    .maybeSingle();
  const subjectName = (subjectRow?.translations as Record<string, string> | null)?.en ?? "Subject";

  const { data: batch, error: batchError } = await supabase
    .from("batches")
    .insert({
      owner_type: "teacher",
      owner_id: user.id,
      title: `${subjectName} — Individual tutoring`,
      mode: parsed.data.mode,
      grade_band: parsed.data.gradeBand ?? null,
      subject_id: parsed.data.subjectId,
      hourly_rate: parsed.data.hourlyRate ?? null,
      monthly_rate: parsed.data.monthlyRate ?? null,
      hourly_rate_max: parsed.data.hourlyRateMax ?? null,
      monthly_rate_max: parsed.data.monthlyRateMax ?? null,
      class_size_type: "individual",
      medium: parsed.data.medium,
      class_type: parsed.data.classType,
    })
    .select("id")
    .single();
  if (batchError || !batch) {
    return { error: "Couldn't create this listing. Please try again." };
  }

  const { error: adError } = await supabase.from("advertisements").insert({
    owner_type: "teacher",
    owner_id: user.id,
    batch_id: batch.id,
    subject_id: parsed.data.subjectId,
    title: parsed.data.title,
    content,
    placement: "search_results",
    plan: "basic",
  });
  if (adError) {
    return { error: "Couldn't save this ad. Please try again." };
  }
  return {};
}
