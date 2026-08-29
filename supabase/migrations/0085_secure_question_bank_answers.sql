-- question_bank_items' "visible via a visible exam" SELECT policy (0061)
-- grants the enrolled student the FULL row for any question in a published
-- exam they're enrolled in — including correct_option_id, correct_option_ids,
-- and sample_answer. RLS is row-level, not column-level, so there's no way
-- to keep that policy (needed so a student can read the question text/
-- options to actually take the exam) while hiding just those three columns
-- from the same row. The app's own server components already gated what
-- they *forward into rendered props* (student/page.tsx, reveal_answers/0079)
-- but that was never enforced by the database — any enrolled student could
-- read the answer key directly via the Supabase client at any time,
-- including mid-exam, which defeats the whole exam feature.
--
-- Fixed the way Postgres actually supports "some columns need a different
-- rule than the rest of the row": revoke SELECT on just those three columns
-- from every authenticated user, then reopen them only through three
-- narrow SECURITY DEFINER functions — same shape as get_teacher_contact
-- (0004) and get_public_teacher_profile (0075), which already solve the
-- identical "this field needs its own gate" problem elsewhere in this
-- schema. This also revokes read access from the *owning teacher's* own
-- direct table queries, not just students — the owner's question-bank UI
-- and exams-actions.ts's grading now go through get_my_question_answers()
-- and grade_mcq_answers() respectively instead.

revoke select (correct_option_id, correct_option_ids, sample_answer)
  on question_bank_items from authenticated, anon;

-- Teacher/institute/admin reading their own question bank's answer key
-- (question-bank-tab.tsx's edit form, the exam paper preview's correct-
-- answer highlighting, the grading panel's reference-answer display).
create or replace function public.get_my_question_answers()
returns table (id uuid, correct_option_id text, correct_option_ids text[], sample_answer text)
language sql
stable
security definer
set search_path = public
as $$
  select qbi.id, qbi.correct_option_id, qbi.correct_option_ids, qbi.sample_answer
  from question_bank_items qbi
  where is_owner(qbi.owner_type, qbi.owner_id) or is_admin();
$$;

revoke all on function public.get_my_question_answers() from public;
grant execute on function public.get_my_question_answers() to authenticated;

-- MCQ auto-grading (submitExam) — reads the answer key internally (bypassing
-- the revoke above via SECURITY DEFINER) and returns only a correct/
-- incorrect verdict per question, never the answer itself, so the student's
-- own RLS-bound submit call still can't recover the answer key from the
-- response.
create or replace function public.grade_mcq_answers(p_question_ids uuid[], p_answers jsonb)
returns table (question_id uuid, is_correct boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    qbi.id,
    (
      array_length(qbi.correct_option_ids, 1) > 0
      and array(select distinct x from unnest(qbi.correct_option_ids) x order by x)
        = array(
            select distinct x from jsonb_array_elements_text(
              coalesce(p_answers -> qbi.id::text, '[]'::jsonb)
            ) x
            order by x
          )
    )
  from question_bank_items qbi
  where qbi.id = any(p_question_ids) and qbi.type = 'mcq';
$$;

revoke all on function public.grade_mcq_answers(uuid[], jsonb) from public;
grant execute on function public.grade_mcq_answers(uuid[], jsonb) to authenticated;

-- The student's own answer-reveal view (0079) — only returns a row when the
-- caller has a graded submission for that specific exam AND the exam owner
-- turned reveal_answers on. Deliberately re-checks student_id = auth.uid()
-- itself rather than trusting exam_submissions' own RLS, since SECURITY
-- DEFINER bypasses that table's RLS too.
create or replace function public.get_revealed_question_answers(p_exam_ids uuid[])
returns table (exam_id uuid, question_id uuid, correct_option_ids text[], sample_answer text)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, qbi.id, qbi.correct_option_ids, qbi.sample_answer
  from exams e
  join question_bank_items qbi on qbi.id = any(e.question_ids)
  join exam_submissions es on es.exam_id = e.id and es.student_id = auth.uid()
  where e.id = any(p_exam_ids)
    and e.reveal_answers = true
    and es.status = 'graded';
$$;

revoke all on function public.get_revealed_question_answers(uuid[]) from public;
grant execute on function public.get_revealed_question_answers(uuid[]) to authenticated;
