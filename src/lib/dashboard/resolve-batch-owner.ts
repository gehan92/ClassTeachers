import type { createClient } from "@/lib/supabase/server";

type OwnerTarget = { ownerType: "teacher" | "class"; ownerId: string; batchId: string | null };

/**
 * Shared by every teacher-side content action (notes/exams/live-classes/
 * question-bank) that can now target either the teacher's own account or
 * one of their assigned institute batches (Institute Blueprint step 3b).
 * The database is the real gate (can_manage_content, 0093/0094) — this
 * just derives the right owner_type/owner_id/batch_id triple to submit so
 * an insert actually lands where the UI says it will, and rejects early
 * with a clear message instead of silently mismatching a batch_id against
 * an unrelated owner.
 */
export async function resolveBatchOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  batchId: string | null | undefined,
): Promise<OwnerTarget | { error: string }> {
  if (!batchId) {
    return { ownerType: "teacher", ownerId: userId, batchId: null };
  }

  const { data: batch } = await supabase
    .from("batches")
    .select("owner_type, owner_id, taught_by_teacher_id")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) {
    return { error: "That class couldn't be found." };
  }

  if (batch.owner_type === "teacher" && batch.owner_id === userId) {
    return { ownerType: "teacher", ownerId: userId, batchId };
  }

  if (batch.owner_type === "class" && batch.taught_by_teacher_id === userId) {
    return { ownerType: "class", ownerId: batch.owner_id, batchId };
  }

  return { error: "You don't have access to that class." };
}

type AssignmentOwnerTarget = {
  ownerType: "teacher" | "class";
  ownerId: string;
  batchId: string | null;
  lessonId: string | null;
};

/**
 * Assignments scope by batch_id AND/OR lesson_id (0047/0049 — lesson_id is
 * an optional further narrowing on top of batch_id, not a replacement for
 * it). Prefers an explicit batchId; falls back to resolving ownership
 * through the chosen lesson's own batch_id when only a lesson was picked.
 */
export async function resolveAssignmentOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  batchId: string | null | undefined,
  lessonId: string | null | undefined,
): Promise<AssignmentOwnerTarget | { error: string }> {
  if (batchId) {
    const target = await resolveBatchOwner(supabase, userId, batchId);
    if ("error" in target) {
      return target;
    }
    return { ...target, lessonId: lessonId ?? null };
  }

  if (lessonId) {
    const { data: lesson } = await supabase
      .from("live_classes")
      .select("owner_type, owner_id, batch_id")
      .eq("id", lessonId)
      .maybeSingle();
    if (!lesson) {
      return { error: "That lesson couldn't be found." };
    }
    if (lesson.batch_id) {
      const target = await resolveBatchOwner(supabase, userId, lesson.batch_id);
      if ("error" in target) {
        return target;
      }
      return { ownerType: target.ownerType, ownerId: target.ownerId, batchId: null, lessonId };
    }
    // No batch on the lesson itself — nothing to check a linked teacher's
    // assignment against, so this only ever resolves to the caller's own
    // unscoped lesson, never an institute's.
    if (lesson.owner_type === "teacher" && lesson.owner_id === userId) {
      return { ownerType: "teacher", ownerId: userId, batchId: null, lessonId };
    }
    return { error: "You don't have access to that lesson." };
  }

  return { ownerType: "teacher", ownerId: userId, batchId: null, lessonId: null };
}
