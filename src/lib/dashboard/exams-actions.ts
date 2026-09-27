"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveBatchOwner } from "@/lib/dashboard/resolve-batch-owner";
import { notify, notifyContentAudience } from "@/lib/dashboard/notify";
import { buildAttemptSeed, buildShuffledOrder } from "@/lib/exam-shuffle";

type ActionResult = { error: string } | { error?: undefined };
type SubmitExamResult = ActionResult & { autoGrade?: { score: number; maxScore: number } };
type StartExamAttemptResult =
  | { error: string }
  | {
      error?: undefined;
      submissionId: string;
      startedAtIso: string;
      attemptNumber: number;
      questionOrder: string[];
      optionOrder: Record<string, string[]>;
    };

const createExamSchema = z.object({
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
  // Real boolean from a plain object call (not FormData), so no coerce
  // pitfall here — see readFlag's comment in question-bank-actions.ts for
  // why that matters elsewhere.
  revealAnswers: z.boolean().optional(),
});

export async function createExam(input: {
  title: string;
  questionIds: string[];
  durationMinutes: string;
  scheduledAt: string;
  batchId?: string;
  participantStudentIds?: string[];
  revealAnswers?: boolean;
}): Promise<ActionResult> {
  const parsed = createExamSchema.safeParse({
    title: input.title,
    questionIds: input.questionIds,
    durationMinutes: input.durationMinutes || "60",
    scheduledAt: input.scheduledAt,
    batchId: input.batchId || undefined,
    participantStudentIds: input.participantStudentIds?.length ? input.participantStudentIds : undefined,
    revealAnswers: input.revealAnswers,
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

  const target = await resolveBatchOwner(supabase, user.id, parsed.data.batchId);
  if ("error" in target) {
    return target;
  }

  const { data: exam, error } = await supabase
    .from("exams")
    .insert({
      owner_type: target.ownerType,
      owner_id: target.ownerId,
      batch_id: target.batchId,
      title: parsed.data.title,
      question_ids: parsed.data.questionIds,
      duration_minutes: parsed.data.durationMinutes,
      scheduled_at: parsed.data.scheduledAt,
      // Draft by default (0063) — the teacher reviews the paper, then
      // explicitly publishes it via setExamPublished. The column's own DB
      // default stays true so existing exams weren't retroactively hidden;
      // new ones start hidden by this app-level override instead.
      published: false,
      reveal_answers: parsed.data.revealAnswers ?? false,
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
  const { data: exam, error } = await supabase
    .from("exams")
    .update(published ? { published, published_at: new Date().toISOString() } : { published })
    .eq("id", examId)
    .select("owner_type, owner_id, batch_id, title")
    .maybeSingle();
  if (error) {
    return { error: "Couldn't update this exam. Please try again." };
  }

  // Only the draft-to-published transition is notify-worthy — flipping a
  // published exam back to draft (or re-publishing) shouldn't re-notify.
  if (published && exam) {
    const { data: participants } = await supabase
      .from("exam_participants")
      .select("student_id")
      .eq("exam_id", examId);
    await notifyContentAudience(
      supabase,
      { ownerType: exam.owner_type as "teacher" | "class", ownerId: exam.owner_id, batchId: exam.batch_id },
      participants && participants.length > 0 ? participants.map((p) => p.student_id) : null,
      "new_exam",
      { title: exam.title, ownerId: exam.owner_id, ownerType: exam.owner_type, batchId: exam.batch_id },
      "exams",
      "newClassContent",
    );
  }

  return {};
}

/** Teacher opts a specific exam in/out of showing correct answers to
 * students once it's graded (0079) — same RLS story as setExamPublished.
 * Off by default since question_bank_items are a reusable bank; flipping
 * this on doesn't retroactively change anything already shown, it only
 * changes what the student's results view is allowed to render next time
 * it loads. */
export async function setExamRevealAnswers(examId: string, revealAnswers: boolean): Promise<ActionResult> {
  if (!examId) {
    return { error: "Invalid exam." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("exams").update({ reveal_answers: revealAnswers }).eq("id", examId);
  if (error) {
    return { error: "Couldn't update this exam. Please try again." };
  }
  return {};
}

/**
 * Deletes an exam. RLS-scoped like every other delete in this app (0010's
 * "owner or admin deletes an exam" policy, no explicit owner filter needed
 * here) and cascades exam_submissions/exam_batch_participants at the DB
 * level (both declared `on delete cascade`) — this only needs to separately
 * clean up the submissions' answer-photo files, which live in Storage, not
 * the database, so cascading the rows doesn't remove them on its own.
 */
export async function deleteExam(examId: string): Promise<ActionResult> {
  if (!examId) {
    return { error: "Invalid exam." };
  }

  const supabase = await createClient();
  const { data: submissions } = await supabase.from("exam_submissions").select("photo_urls").eq("exam_id", examId);

  const { error } = await supabase.from("exams").delete().eq("id", examId);
  if (error) {
    return { error: "Couldn't delete this exam. Please try again." };
  }

  const paths = (submissions ?? []).flatMap((s) => s.photo_urls ?? []).filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    await supabase.storage.from("submissions").remove(paths);
  }

  return {};
}

const allowedPhotoTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Starts, resumes, or (within the exam's max_attempts) resets a student's
 * attempt. Computes the per-attempt question/option shuffle here in TS —
 * order isn't secret, only correctness is (see 0085's revoke) — and hands it
 * to the start_exam_attempt RPC (0162), which is the only place allowed to
 * perform the privileged finished->in_progress reset transition. Returns a
 * server-authoritative startedAtIso so the client's countdown timer survives
 * a page refresh instead of resetting to the full duration.
 */
export async function startExamAttempt(examId: string): Promise<StartExamAttemptResult> {
  if (!examId) {
    return { error: "Invalid exam." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: exam } = await supabase
    .from("exams")
    .select("question_ids, shuffle_questions, shuffle_options")
    .eq("id", examId)
    .maybeSingle();
  if (!exam) {
    return { error: "Exam not found." };
  }

  const { data: existing } = await supabase
    .from("exam_submissions")
    .select("attempt_number")
    .eq("exam_id", examId)
    .eq("student_id", user.id)
    .maybeSingle();
  const nextAttemptNumber = (existing?.attempt_number ?? 0) + 1;

  const { data: questionRows } = exam.question_ids.length
    ? await supabase.from("question_bank_items").select("id, type, options").in("id", exam.question_ids)
    : { data: [] as { id: string; type: string; options: { id: string }[] | null }[] };

  const optionsByQuestionId = new Map(
    (questionRows ?? [])
      .filter((q) => q.type === "mcq" && q.options)
      .map((q) => [q.id, q.options as { id: string }[]]),
  );

  const seed = buildAttemptSeed(examId, user.id, nextAttemptNumber);
  const { questionOrder, optionOrder } = buildShuffledOrder(
    exam.question_ids,
    optionsByQuestionId,
    seed,
    exam.shuffle_questions,
    exam.shuffle_options,
  );

  const { data: attempt, error } = await supabase
    .rpc("start_exam_attempt", {
      p_exam_id: examId,
      p_question_order: questionOrder,
      p_option_order: optionOrder,
    })
    .single();
  if (error || !attempt) {
    return { error: error?.message ?? "Couldn't start this exam. Please try again." };
  }

  if (attempt.prior_photo_urls && attempt.prior_photo_urls.length > 0) {
    await supabase.storage.from("submissions").remove(attempt.prior_photo_urls);
  }

  return {
    submissionId: attempt.id,
    startedAtIso: attempt.started_at as string,
    attemptNumber: attempt.attempt_number,
    questionOrder: (attempt.question_order as string[] | null) ?? questionOrder,
    optionOrder: (attempt.option_order as Record<string, string[]> | null) ?? optionOrder,
  };
}

/**
 * Periodic/debounced autosave while an attempt is in_progress. A plain
 * RLS-scoped update — the "student updates own in-progress submission"
 * policy added in 0162 is what makes this possible, and it silently stops
 * matching (so this becomes a no-op) the instant the row moves past
 * in_progress, which is exactly the safety property we want.
 */
export async function saveExamProgress(
  examId: string,
  mcqAnswers: Record<string, string[]>,
  codeAnswers: Record<string, string>,
): Promise<ActionResult> {
  if (!examId) {
    return { error: "Invalid exam." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("exam_submissions")
    .update({ mcq_answers: mcqAnswers, code_answers: codeAnswers })
    .eq("exam_id", examId)
    .eq("student_id", user.id)
    .eq("status", "in_progress");
  if (error) {
    return { error: "Couldn't save your progress." };
  }
  return {};
}

/**
 * Student submits an exam — MCQ answers (auto-graded here, server-side, so
 * correct_option_ids never has to reach the browser) plus, only if the exam
 * has essay questions, photo(s) of handwritten answers. A pure-MCQ exam
 * needs no photo at all: it's graded immediately and exam_submissions goes
 * straight to 'graded', skipping the teacher's grading queue entirely.
 *
 * Requires an in_progress row created by startExamAttempt — this updates
 * that row rather than inserting a fresh one, so the timer/shuffle state
 * from that attempt carries through. A submission past
 * started_at + duration (+ a 2 minute grace for network lag) is still
 * accepted but flagged late_submission for the teacher's grading view,
 * rather than hard-rejected — losing a student's answers to a few seconds
 * of lag would be worse than a soft flag.
 */
export async function submitExam(formData: FormData): Promise<SubmitExamResult> {
  const examId = formData.get("examId");
  const mcqAnswersRaw = formData.get("mcqAnswers");
  const codeAnswersRaw = formData.get("codeAnswers");
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

  // Code/Terminal questions — questionId -> the student's typed answer text,
  // always manually graded like essay (see 0078). Capped defensively so a
  // pasted wall of text can't bloat the row.
  let codeAnswers: Record<string, string> = {};
  if (typeof codeAnswersRaw === "string" && codeAnswersRaw) {
    try {
      const parsed: unknown = JSON.parse(codeAnswersRaw);
      if (parsed && typeof parsed === "object") {
        const entries = Object.entries(parsed as Record<string, unknown>)
          .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0)
          .map(([qid, v]): [string, string] => [qid, v.slice(0, 20000)]);
        codeAnswers = Object.fromEntries(entries);
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

  const { data: exam } = await supabase
    .from("exams")
    .select("question_ids, owner_type, owner_id, title, duration_minutes")
    .eq("id", examId)
    .maybeSingle();
  if (!exam) {
    return { error: "Exam not found." };
  }

  const { data: existingSubmission } = await supabase
    .from("exam_submissions")
    .select("id, status, started_at")
    .eq("exam_id", examId)
    .eq("student_id", user.id)
    .maybeSingle();
  if (!existingSubmission) {
    return { error: "Start the exam before submitting." };
  }
  if (existingSubmission.status !== "in_progress") {
    return { error: "You've already submitted this exam." };
  }

  const { data: questionRows } = exam.question_ids.length
    ? await supabase.from("question_bank_items").select("id, type, marks").in("id", exam.question_ids)
    : { data: [] as { id: string; type: "mcq" | "essay" | "code"; marks: number }[] };

  const mcqQuestions = (questionRows ?? []).filter((q) => q.type === "mcq");
  const codeQuestions = (questionRows ?? []).filter((q) => q.type === "code");
  const hasEssayQuestions = (questionRows ?? []).some((q) => q.type === "essay");
  const hasCodeQuestions = codeQuestions.length > 0;

  if (!timeExpired && mcqQuestions.length > 0 && Object.keys(mcqAnswers).length === 0) {
    return { error: "Please answer the MCQ questions before submitting." };
  }
  if (!timeExpired && hasEssayQuestions && files.length === 0) {
    return { error: "Please add at least one photo of your written answers." };
  }
  if (!timeExpired && hasCodeQuestions && codeQuestions.some((q) => !codeAnswers[q.id])) {
    return { error: "Please answer the code questions before submitting." };
  }

  // Grading goes through a SECURITY DEFINER RPC rather than reading
  // correct_option_ids directly — that column is revoke()d from ordinary
  // SELECT (0085) precisely so a student's own RLS-bound session, which is
  // what this action runs as, can never read the answer key itself, only a
  // per-question correct/incorrect verdict.
  const { data: mcqResults } = mcqQuestions.length
    ? await supabase.rpc("grade_mcq_answers", {
        p_question_ids: mcqQuestions.map((q) => q.id),
        p_answers: mcqAnswers,
      })
    : { data: [] as { question_id: string; is_correct: boolean }[] };
  const correctByQuestionId = new Map((mcqResults ?? []).map((r) => [r.question_id, r.is_correct]));

  let mcqScore = 0;
  let mcqMaxScore = 0;
  for (const q of mcqQuestions) {
    mcqMaxScore += q.marks;
    if (correctByQuestionId.get(q.id)) {
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

  // Fully auto-graded only when the exam is pure MCQ — any essay or code
  // question still needs a human to look at the answer.
  const isFullyAutoGraded = mcqQuestions.length > 0 && !hasEssayQuestions && !hasCodeQuestions;

  // Soft late-flag only — see this function's doc comment for why a late
  // submission is still accepted rather than rejected.
  const lateSubmission = existingSubmission.started_at
    ? Date.now() >
      new Date(existingSubmission.started_at).getTime() + exam.duration_minutes * 60_000 + 2 * 60_000
    : false;

  const questionScores: Record<string, number> = {};
  for (const q of mcqQuestions) {
    questionScores[q.id] = correctByQuestionId.get(q.id) ? q.marks : 0;
  }

  const { error } = await supabase
    .from("exam_submissions")
    .update({
      photo_urls: photoUrls,
      mcq_answers: mcqAnswers,
      mcq_score: mcqQuestions.length > 0 ? mcqScore : null,
      mcq_max_score: mcqQuestions.length > 0 ? mcqMaxScore : null,
      code_answers: codeAnswers,
      question_scores: questionScores,
      status: isFullyAutoGraded ? "graded" : "pending",
      grade: isFullyAutoGraded ? mcqScore : null,
      feedback: null,
      graded_at: isFullyAutoGraded ? new Date().toISOString() : null,
      submitted_at: new Date().toISOString(),
      late_submission: lateSubmission,
    })
    .eq("id", existingSubmission.id)
    .eq("status", "in_progress");
  if (error) {
    return { error: "Couldn't save your submission. Please try again." };
  }

  // Only the cases that actually land in the teacher's grading queue —
  // a pure-MCQ exam is already graded, nothing for them to do.
  if (!isFullyAutoGraded) {
    let recipientId = exam.owner_id;
    if (exam.owner_type === "class") {
      const { data: cp } = await supabase.from("class_profiles").select("owner_id").eq("id", exam.owner_id).maybeSingle();
      recipientId = cp?.owner_id ?? exam.owner_id;
    }
    const { data: studentProfile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    await notify(
      supabase,
      recipientId,
      "exam_submitted",
      { studentName: studentProfile?.full_name ?? "—", examTitle: exam.title },
      "exams",
      "submissions",
    );
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
    .select("exam_id, student_id")
    .eq("id", input.submissionId)
    .maybeSingle();
  if (!submission) {
    return { error: "Submission not found." };
  }

  const { data: exam } = await supabase
    .from("exams")
    .select("owner_type, owner_id, batch_id, title")
    .eq("id", submission.exam_id)
    .maybeSingle();
  if (!exam) {
    return { error: "Exam not found." };
  }

  // Delegates to the same DB-level check RLS itself uses (0093/0094) rather
  // than re-deriving "owner, or admin, or a linked teacher assigned to this
  // batch" in JS a second time and risking the two drifting apart.
  const { data: canManage } = await supabase.rpc("can_manage_content", {
    p_owner_type: exam.owner_type,
    p_owner_id: exam.owner_id,
    p_batch_id: exam.batch_id,
  });
  if (!canManage) {
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
  await notify(supabase, submission.student_id, "exam_graded", { examTitle: exam.title, grade }, "exams", "examGraded");
  return {};
}
