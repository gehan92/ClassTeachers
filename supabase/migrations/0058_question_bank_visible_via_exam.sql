-- 0009's assumption ("students never query question_bank_items directly,
-- they only see the exams assembled from it") stopped being true once exams
-- started showing real question text/options/images to students directly
-- (0034 MCQ answering, 0057 auto-grading) instead of just a question count.
-- The original owner/admin-only policy silently returned zero rows for a
-- student — so an exam page showed its title and duration but no questions
-- at all, and submitExam's auto-grader saw zero MCQ/essay questions too
-- (skipping its own answer-required checks).
--
-- This adds a SELECT-only policy alongside the existing "owner/admin only"
-- one (for all) from 0009 — multiple permissive policies on the same table
-- are OR'd together per command, so this only widens read access; insert/
-- update/delete stay owner/admin-only via the original policy.

drop policy if exists "question bank visible via a visible exam" on question_bank_items;
create policy "question bank visible via a visible exam"
  on question_bank_items for select
  using (
    exists (
      select 1 from exams e
      where question_bank_items.id = any(e.question_ids)
        and (is_owner(e.owner_type, e.owner_id) or is_enrolled(e.owner_type, e.owner_id) or is_admin())
    )
  );
