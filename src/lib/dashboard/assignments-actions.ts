"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveAssignmentOwner } from "@/lib/dashboard/resolve-batch-owner";
import { notifyContentAudience } from "@/lib/dashboard/notify";

type ActionResult = { error: string } | { error?: undefined };

const createAssignmentSchema = z.object({
  title: z.string().trim().min(2),
  batchId: z.string().uuid().optional(),
  lessonId: z.string().uuid().optional(),
  // Must already be a UTC ISO string computed in the browser when present
  // — see the same note in live-classes-actions.ts's createLiveClassSchema.
  dueAt: z.iso.datetime().optional(),
});

export async function createAssignment(formData: FormData): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a PDF file." };
  }
  if (file.type !== "application/pdf") {
    return { error: "Only PDF files are supported." };
  }

  const parsed = createAssignmentSchema.safeParse({
    title: formData.get("title"),
    batchId: formData.get("batchId") || undefined,
    lessonId: formData.get("lessonId") || undefined,
    dueAt: formData.get("dueAt") || undefined,
  });
  if (!parsed.success) {
    return { error: "Please add a title and choose a PDF file." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const target = await resolveAssignmentOwner(supabase, user.id, parsed.data.batchId, parsed.data.lessonId);
  if ("error" in target) {
    return target;
  }

  const assignmentId = crypto.randomUUID();
  const filePath = `${target.ownerId}/${assignmentId}.pdf`;

  const { error: uploadError } = await supabase.storage.from("assignments").upload(filePath, file, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) {
    return { error: "Couldn't upload the file. Please try again." };
  }

  const { error: insertError } = await supabase.from("assignments").insert({
    id: assignmentId,
    owner_type: target.ownerType,
    owner_id: target.ownerId,
    batch_id: target.batchId,
    lesson_id: target.lessonId,
    title: parsed.data.title,
    file_path: filePath,
    due_at: parsed.data.dueAt ?? null,
  });
  if (insertError) {
    await supabase.storage.from("assignments").remove([filePath]);
    return { error: "Couldn't save the assignment. Please try again." };
  }

  await notifyContentAudience(
    supabase,
    { ownerType: target.ownerType, ownerId: target.ownerId, batchId: target.batchId },
    null,
    "new_assignment",
    { title: parsed.data.title },
    "assignments",
    "newClassContent",
  );

  return {};
}

export async function deleteAssignment(assignmentId: string): Promise<ActionResult> {
  if (!assignmentId) {
    return { error: "Invalid assignment." };
  }

  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("assignments")
    .select("file_path")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment) {
    return { error: "Assignment not found." };
  }

  const { error: deleteError } = await supabase.from("assignments").delete().eq("id", assignmentId);
  if (deleteError) {
    return { error: "Couldn't delete this assignment. Please try again." };
  }

  await supabase.storage.from("assignments").remove([assignment.file_path]);
  return {};
}

const allowedPhotoTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Student uploads photo(s) of their completed worksheet — same shape as
 * submitExam (0011/exams-actions.ts): one photo set per assignment, not
 * per-question. A resubmit replaces the photos and resets status to
 * 'pending' so it goes back to the grading queue instead of keeping a
 * stale grade.
 */
export async function submitAssignment(formData: FormData): Promise<ActionResult> {
  const assignmentId = formData.get("assignmentId");
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (typeof assignmentId !== "string" || !assignmentId) {
    return { error: "Invalid assignment." };
  }
  if (files.length === 0) {
    return { error: "Please add at least one photo of your answer." };
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
    const path = `${assignmentId}/${user.id}/${Date.now()}-${index}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("submissions").upload(path, file, {
      contentType: file.type,
    });
    if (uploadError) {
      return { error: "Couldn't upload your photos. Please try again." };
    }
    photoUrls.push(path);
  }

  const { error } = await supabase.from("assignment_submissions").upsert(
    {
      assignment_id: assignmentId,
      student_id: user.id,
      photo_urls: photoUrls,
      status: "pending",
      grade: null,
      feedback: null,
      graded_at: null,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "assignment_id,student_id" },
  );
  if (error) {
    return { error: "Couldn't save your submission. Please try again." };
  }
  return {};
}

/**
 * Teacher/institute grading. assignment_submissions RLS also lets a student
 * update their own row (so they can resubmit), so this re-verifies the
 * caller actually owns the assignment before touching grade/feedback — RLS
 * alone can't split "which columns", only "which rows" (same as
 * gradeSubmission in exams-actions.ts).
 */
export async function gradeAssignmentSubmission(input: {
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
    .from("assignment_submissions")
    .select("assignment_id")
    .eq("id", input.submissionId)
    .maybeSingle();
  if (!submission) {
    return { error: "Submission not found." };
  }

  const { data: assignment } = await supabase
    .from("assignments")
    .select("owner_type, owner_id, batch_id, lesson_id")
    .eq("id", submission.assignment_id)
    .maybeSingle();
  if (!assignment) {
    return { error: "Assignment not found." };
  }

  // Delegates to the same DB-level check RLS itself uses (0093/0095) rather
  // than re-deriving "owner, or admin, or a linked teacher assigned to this
  // batch/lesson" in JS a second time and risking the two drifting apart.
  const { data: canManage } = await supabase.rpc("can_manage_assignment_content", {
    p_owner_type: assignment.owner_type,
    p_owner_id: assignment.owner_id,
    p_batch_id: assignment.batch_id,
    p_lesson_id: assignment.lesson_id,
  });
  if (!canManage) {
    return { error: "You don't have permission to grade this submission." };
  }

  const grade = Number(input.grade);
  if (!Number.isFinite(grade) || grade < 0) {
    return { error: "Please enter a valid grade." };
  }

  const { error } = await supabase
    .from("assignment_submissions")
    .update({ status: "graded", grade, feedback: input.feedback.trim() || null, graded_at: new Date().toISOString() })
    .eq("id", input.submissionId);
  if (error) {
    return { error: "Couldn't save this grade. Please try again." };
  }
  return {};
}
