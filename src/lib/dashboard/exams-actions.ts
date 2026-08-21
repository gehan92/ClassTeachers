"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

const createExamSchema = z.object({
  ownerType: z.enum(["teacher", "class"]),
  title: z.string().trim().min(2),
  questionIds: z.array(z.string().uuid()).min(1),
  durationMinutes: z.coerce.number().int().min(1),
  scheduledAt: z.string().min(1),
});

export async function createExam(input: {
  ownerType: "teacher" | "class";
  title: string;
  questionIds: string[];
  durationMinutes: string;
  scheduledAt: string;
}): Promise<ActionResult> {
  const parsed = createExamSchema.safeParse({
    ownerType: input.ownerType,
    title: input.title,
    questionIds: input.questionIds,
    durationMinutes: input.durationMinutes || "60",
    scheduledAt: input.scheduledAt,
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

  const { error } = await supabase.from("exams").insert({
    owner_type: parsed.data.ownerType,
    owner_id: ownerId,
    title: parsed.data.title,
    question_ids: parsed.data.questionIds,
    duration_minutes: parsed.data.durationMinutes,
    scheduled_at: new Date(parsed.data.scheduledAt).toISOString(),
  });
  if (error) {
    return { error: "Couldn't create this exam. Please try again." };
  }
  return {};
}

const allowedPhotoTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Student uploads photo(s) of their handwritten answers for the whole exam
 * — exam_submissions has no per-question answer storage (photo_urls only,
 * see 0011), so this is the entire submission, not one question at a time.
 * A resubmit replaces the photos and resets status to 'pending' — a new
 * answer set should go back to the grading queue, not keep a stale grade.
 */
export async function submitExam(formData: FormData): Promise<ActionResult> {
  const examId = formData.get("examId");
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (typeof examId !== "string" || !examId) {
    return { error: "Invalid exam." };
  }
  if (files.length === 0) {
    return { error: "Please add at least one photo of your answers." };
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

  const { error } = await supabase.from("exam_submissions").upsert(
    {
      exam_id: examId,
      student_id: user.id,
      photo_urls: photoUrls,
      status: "pending",
      grade: null,
      feedback: null,
      graded_at: null,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "exam_id,student_id" },
  );
  if (error) {
    return { error: "Couldn't save your submission. Please try again." };
  }
  return {};
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
