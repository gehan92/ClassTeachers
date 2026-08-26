-- 0011 let a student update their own exam_submissions row indefinitely
-- ("so they can resubmit while it's still pending grading") — but that's an
-- RLS-level permission, not something the app UI merely offered: a student
-- could call the Supabase client directly and rewrite their own submission
-- (including one already graded) regardless of what the dashboard's buttons
-- show. Exams are one attempt only — submit is final, so the update policy
-- now only admits the exam's owner (grading) or an admin. Students still
-- insert their one submission (0011's insert policy, unchanged) and can
-- always select their own row to see their result.

drop policy if exists "student or exam owner can update a submission" on exam_submissions;
create policy "exam owner or admin can update a submission"
  on exam_submissions for update
  using (owns_exam(exam_id) or is_admin())
  with check (owns_exam(exam_id) or is_admin());
