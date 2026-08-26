-- 0058 and 0011 both gate access on the owner-level is_enrolled() check —
-- "is this student enrolled with this teacher/institute at all", with no
-- regard for the batch/participant scoping 0060 just added to exams. Swap
-- both to the batch/participant-aware is_enrolled_in_exam() so a student
-- excluded from a scoped exam can't read its questions or submit an answer
-- to it, even though the exam itself no longer shows up in their list.

drop policy if exists "question bank visible via a visible exam" on question_bank_items;
create policy "question bank visible via a visible exam"
  on question_bank_items for select
  using (
    exists (
      select 1 from exams e
      where question_bank_items.id = any(e.question_ids)
        and (is_owner(e.owner_type, e.owner_id) or is_enrolled_in_exam(e.id) or is_admin())
    )
  );

drop policy if exists "an enrolled student can submit their own exam answers" on exam_submissions;
create policy "an enrolled student can submit their own exam answers"
  on exam_submissions for insert
  with check (student_id = auth.uid() and is_enrolled_in_exam(exam_id));
