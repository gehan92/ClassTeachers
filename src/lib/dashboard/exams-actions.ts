"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };
type SubmitExamResult = ActionResult & { autoGrade?: { score: number; maxScore: number } };

const createExamSchema = z.object({
  ownerType: z.enum(["teacher", "class"]),
  title: z.string().trim().min(2),
  questionIds: z.array(z.string().uuid()).min(1),
  durationMinutes: z.coerce.number().int().min(1),
  batchId: z.string().uuid().optional(),
  // Present only when the teacher deliberately excluded someone from the
  // full batch/all-students pool — see the comment on exam_participants
  // (0060, mirroring live_class_participants/0055) for why an "include
  // everyone" selection is sent as nothing at all.
  participantStudentIds: z.array(z.string().uuid()).optional(),
  // Must already be a UTC ISO string computed in the browser — see the
  // same note in live-classes-actions.ts's createLiveClassSchema.
  scheduledAt: z.iso.datetime(),
});

export async function createExam(input: {
  ownerType: "teacher" | "class";
  title: string;
  questionIds: string[];
  durationMinutes: string;
  scheduledAt: string;
  batchId?: string;
  participantStudentIds?: string[];
}): Promise<ActionResult> {
  const parsed = createExamSchema.safeParse({
    ownerType: input.ownerType,
    title: input.title,
    questionIds: input.questionIds,
    durationMinutes: input.durationMinutes || "60",
    scheduledAt: input.scheduledAt,
    batchId: input.batchId || undefined,
    participantStudentIds: input.participantStudentIds?.length ? input.participantStudentIds : undefined,
  });
  if (!parsed.success) {
    return { error: "Please add a title, pick at least one question, and set a schedule." };
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
      return { error: "Save your institute details first." };
    }
    ownerId = classProfile.id;
  }

  const { data: exam, error } = await supabase
    .from("exams")
    .insert({
      owner_type: parsed.data.ownerType,
      owner_id: ownerId,
      batch_id: parsed.data.batchId ?? null,
      title: parsed.data.title,
      question_ids: parsed.data.questionIds,
      duration_minutes: parsed.data.durationMinutes,
      scheduled_at: parsed.data.scheduledAt,
      // Draft by default (0063) — the teacher reviews the paper, then
      // explicitly publishes it via setExamPublished. The column's own DB
      // default stays true so existing exams weren't retroactively hidden;
      // new ones start hidden by this app-level override instead.
      published: false,
    })
    .select("id")
    .single();
  if (error || !exam) {
    return { error: "Couldn't create this exam. Please try again." };
  }

  if (parsed.data.participantStudentIds) {
    const { error: participantsError } = await supabase
      .from("exam_participants")
      .insert(parsed.data.participantStudentIds.map((studentId) => ({ exam_id: exam.id, student_id: studentId })));
    if (participantsError) {
      return { error: "Exam was created, but the student list couldn't be saved. Please try again." };
    }
  }

  return {};
}

/** Teacher makes a draft exam visible to students (or pulls a published one
 * back to draft) — exams' own UPDATE policy (0010) is owner/admin only, so
 * a plain RLS-scoped update is enough; no manual ownership re-check needed
 * the way gradeSubmission needs one (that table's RLS also lets a student
 * update their own row, which this one's doesn't). */
export async function setExamPublished(examId: string, published: boolean): Promise<ActionResult> {
  if (!examId) {
    return { error: "Invalid exam." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("exams").update({ published }).eq("id", examId);
  if (error) {
    return { error: "Couldn't update this exam. Please try again." };
  }
  return {};
}

const allowedPhotoTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Student submits an exam — MCQ answers (auto-graded here, server-side, so
 * correct_option_ids never has to reach the browser) plus, only if the exam
 * has essay questions, photo(s) of handwritten answers. A pure-MCQ exam
 * needs no photo at all: it's graded immediately and exam_submissions goes
 * straight to 'graded', skipping the teacher's grading queue entirely.
 *
 * One attempt only — once a row exists for (examId, studentId), this
 * rejects rather than overwriting it, whether that submission is still
 * pending grading or already graded. Enforced here, not just by hiding the
 * resubmit button client-side, since a client-only guard doesn't stop a
 * direct call to this action.
 */
export async function submitExam(formData: FormData): Promise<SubmitExamResult> {
  const examId = formData.get("examId");
  const mcqAnswersRaw = formData.get("mcqAnswers");
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  // Set when the countdown timer hit zero and the client auto-submitted —
  // whatever's answered goes in as-is, unanswered MCQs just score 0 and a
  // missing essay photo lands as an empty submission for the teacher to see,
  // rather than blocking the submit the way a manual click would.
  const timeExpired = formData.get("timeExpired") === "1";
  if (typeof examId !== "string" || !examId) {
    return { error: "Invalid exam." };
  }

  // Each question's answer is an array of selected option ids — a
  // single-answer question just has 0 or 1 entries, a "select all that
  // apply" one can have more. Grading is all-or-nothing: the selected set
  // must exactly match the correct set.
  let mcqAnswers: Record<string, string[]> = {};
  if (typeof mcqAnswersRaw === "string" && mcqAnswersRaw) {
    try {
      const parsed: unknown = JSON.parse(mcqAnswersRaw);
      if (parsed && typeof parsed === "object") {
        const entries = Object.entries(parsed as Record<string, unknown>).map(
          ([qid, v]): [string, string[]] => [qid, Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []],
        );
        mcqAnswers = Object.fromEntries(entries);
      }
    } catch {
      return { error: "Invalid answers." };
    }
  }

  for (const file of files) {
    if (!allowedPhotoTypes[file.type]) {
      return { error: "Please upload JPG, PNG, or WEBP photos only." };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: exam } = await supabase.from("exams").select("question_ids").eq("id", examId).maybeSingle();
  if (!exam) {
    return { error: "Exam not found." };
  }

  const { data: existingSubmission } = await supabase
    .from("exam_submissions")
    .select("id")
    .eq("exam_id", examId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (existingSubmission) {
    return { error: "You've already submitted this exam." };
  }

  const { data: questionRows } = exam.question_ids.length
    ? await supabase
        .from("question_bank_items")
        .select("id, type, marks, correct_option_ids")
        .in("id", exam.question_ids)
    : { data: [] as { id: string; type: "mcq" | "essay"; marks: number; correct_option_ids: string[] }[] };

  const mcqQuestions = (questionRows ?? []).filter((q) => q.type === "mcq");
  const hasEssayQuestions = (questionRows ?? []).some((q) => q.type === "essay");

  if (!timeExpired && mcqQuestions.length > 0 && Object.keys(mcqAnswers).length === 0) {
    return { error: "Please answer the MCQ questions before submitting." };
  }
  if (!timeExpired && hasEssayQuestions && files.length === 0) {
    return { error: "Please add at least one photo of your written answers." };
  }

  let mcqScore = 0;
  let mcqMaxScore = 0;
  for (const q of mcqQuestions) {
    mcqMaxScore += q.marks;
    const correctSet = new Set(q.correct_option_ids);
    const selectedSet = new Set(mcqAnswers[q.id] ?? []);
    const isCorrect =
      correctSet.size > 0 && correctSet.size === selectedSet.size && [...correctSet].every((id) => selectedSet.has(id));
    if (isCorrect) {
      mcqScore += q.marks;
    }
  }

  const photoUrls: string[] = [];
  for (const [index, file] of files.entries()) {
    const extension = allowedPhotoTypes[file.type];
    const path = `${examId}/${user.id}/${Date.now()}-${index}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("submissions").upload(path, file, {
      contentType: file.type,
    });
    if (uploadError) {
      return { error: "Couldn't upload your photos. Please try again." };
    }
    photoUrls.push(path);
  }

  // Fully auto-graded only when the exam is pure MCQ — any essay question
  // still needs a human to look at the photographed answer.
  const isFullyAutoGraded = mcqQuestions.length > 0 && !hasEssayQuestions;

  const { error } = await supabase.from("exam_submissions").insert({
    exam_id: examId,
    student_id: user.id,
    photo_urls: photoUrls,
    mcq_answers: mcqAnswers,
    mcq_score: mcqQuestions.length > 0 ? mcqScore : null,
    mcq_max_score: mcqQuestions.length > 0 ? mcqMaxScore : null,
    status: isFullyAutoGraded ? "graded" : "pending",
    grade: isFullyAutoGraded ? mcqScore : null,
    feedback: null,
    graded_at: isFullyAutoGraded ? new Date().toISOString() : null,
    submitted_at: new Date().toISOString(),
  });
  if (error) {
    return { error: "Couldn't save your submission. Please try again." };
  }
  return isFullyAutoGraded ? { autoGrade: { score: mcqScore, maxScore: mcqMaxScore } } : {};
}

/**
 * Teacher/institute grading. exam_submissions RLS also lets a student
 * update their own row (so they can resubmit), so this re-verifies the
 * caller actually owns the exam before touching grade/feedback — RLS alone
 * can't split "which columns", only "which rows" (see 0011's own comment).
 */
export async function gradeSubmission(input: {
  submissionId: string;
  grade: string;
  feedback: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: submission } = await supabase
    .from("exam_submissions")
    .select("exam_id")
    .eq("id", input.submissionId)
    .maybeSingle();
  if (!submission) {
    return { error: "Submission not found." };
  }

  const { data: exam } = await supabase
    .from("exams")
    .select("owner_type, owner_id")
    .eq("id", submission.exam_id)
    .maybeSingle();
  if (!exam) {
    return { error: "Exam not found." };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = profile?.role === "admin";
  let isOwner = exam.owner_type === "teacher" && exam.owner_id === user.id;
  if (!isOwner && exam.owner_type === "class") {
    const { data: classProfile } = await supabase
      .from("class_profiles")
      .select("id")
      .eq("owner_id", user.id)
      .eq("id", exam.owner_id)
      .maybeSingle();
    isOwner = Boolean(classProfile);
  }
  if (!isOwner && !isAdmin) {
    return { error: "You don't have permission to grade this submission." };
  }

  const grade = Number(input.grade);
  if (!Number.isFinite(grade) || grade < 0) {
    return { error: "Please enter a valid grade." };
  }

  const { error } = await supabase
    .from("exam_submissions")
    .update({ status: "graded", grade, feedback: input.feedback.trim() || null, graded_at: new Date().toISOString() })
    .eq("id", input.submissionId);
  if (error) {
    return { error: "Couldn't save this grade. Please try again." };
  }
  return {};
}
