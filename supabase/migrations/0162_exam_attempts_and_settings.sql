-- Server-authoritative exam attempt lifecycle (timer/deadline, autosave,
-- configurable reattempts) plus new per-exam settings columns used by later
-- migrations in this series (0163/0164). See classportals-exam-system-gap-analysis
-- memory for the full context.

alter table exam_submissions add column if not exists started_at timestamptz;
alter table exam_submissions add column if not exists attempt_number integer not null default 1;
alter table exam_submissions add column if not exists late_submission boolean not null default false;
alter table exam_submissions add column if not exists question_order uuid[];
alter table exam_submissions add column if not exists option_order jsonb not null default '{}'::jsonb;
alter table exam_submissions add column if not exists question_scores jsonb not null default '{}'::jsonb;
alter table exam_submissions add column if not exists integrity_flags jsonb not null default '{}'::jsonb;

alter table exam_submissions drop constraint if exists exam_submissions_status_check;
alter table exam_submissions add constraint exam_submissions_status_check
  check (status in ('in_progress', 'pending', 'graded'));

alter table exams add column if not exists max_attempts integer not null default 1;
alter table exams add column if not exists closes_at timestamptz;
alter table exams add column if not exists negative_marking_fraction numeric not null default 0
  check (negative_marking_fraction >= 0 and negative_marking_fraction <= 1);
alter table exams add column if not exists pass_mark numeric;
alter table exams add column if not exists shuffle_questions boolean not null default true;
alter table exams add column if not exists shuffle_options boolean not null default true;
alter table exams add column if not exists sections jsonb;
alter table exams add column if not exists generation_rules jsonb;

-- Student may update their own in-progress attempt (autosave + final
-- submit) — additive alongside the owner/admin-only UPDATE policy from
-- 0059_exam_submission_one_attempt.sql; Postgres ORs multiple permissive
-- policies for the same command together, so this doesn't loosen access to
-- an already pending/graded row (status flips out of 'in_progress' the
-- moment submitExam runs, closing this policy's own door behind it).
drop policy if exists "student updates own in-progress submission" on exam_submissions;
create policy "student updates own in-progress submission"
  on exam_submissions for update
  using (student_id = auth.uid() and status = 'in_progress')
  with check (student_id = auth.uid());

-- Starts, resumes, or (within max_attempts) resets a student's attempt at
-- an exam. SECURITY DEFINER because resetting a finished ('pending' or
-- 'graded') row back to 'in_progress' is a privileged transition the RLS
-- policy above deliberately does not let a student perform themselves.
-- Question/option ORDER is computed by the TS caller and just persisted
-- here — order isn't secret, only correctness is (see 0085's revoke), so
-- there's no need to compute the shuffle inside this function.
drop function if exists public.start_exam_attempt(uuid, uuid[], jsonb);
create function public.start_exam_attempt(
  p_exam_id uuid,
  p_question_order uuid[],
  p_option_order jsonb
)
returns table (
  id uuid,
  status text,
  started_at timestamptz,
  attempt_number integer,
  question_order uuid[],
  option_order jsonb,
  prior_photo_urls text[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_published boolean;
  v_closes_at timestamptz;
  v_max_attempts integer;
  v_existing exam_submissions%rowtype;
begin
  if not is_enrolled_in_exam(p_exam_id) then
    raise exception 'Not enrolled in this exam.';
  end if;

  select e.published, e.closes_at, e.max_attempts
    into v_published, v_closes_at, v_max_attempts
  from exams e where e.id = p_exam_id;

  if not found or not v_published then
    raise exception 'Exam not available.';
  end if;
  if v_closes_at is not null and now() > v_closes_at then
    raise exception 'This exam is closed.';
  end if;

  select * into v_existing from exam_submissions es
  where es.exam_id = p_exam_id and es.student_id = auth.uid();

  if not found then
    return query
      insert into exam_submissions (
        exam_id, student_id, status, started_at, attempt_number,
        question_order, option_order
      ) values (
        p_exam_id, auth.uid(), 'in_progress', now(), 1,
        p_question_order, p_option_order
      )
      returning
        exam_submissions.id, exam_submissions.status, exam_submissions.started_at,
        exam_submissions.attempt_number, exam_submissions.question_order,
        exam_submissions.option_order, '{}'::text[];
    return;
  end if;

  if v_existing.status = 'in_progress' then
    return query
      select
        v_existing.id, v_existing.status, v_existing.started_at,
        v_existing.attempt_number, v_existing.question_order,
        v_existing.option_order, '{}'::text[];
    return;
  end if;

  if v_existing.attempt_number >= v_max_attempts then
    raise exception 'No attempts remaining.';
  end if;

  return query
    update exam_submissions set
      status = 'in_progress',
      started_at = now(),
      attempt_number = v_existing.attempt_number + 1,
      question_order = p_question_order,
      option_order = p_option_order,
      late_submission = false,
      mcq_answers = '{}'::jsonb,
      code_answers = '{}'::jsonb,
      photo_urls = '{}',
      question_scores = '{}'::jsonb,
      integrity_flags = '{}'::jsonb,
      grade = null,
      feedback = null,
      graded_at = null,
      mcq_score = null,
      mcq_max_score = null
    where exam_submissions.id = v_existing.id
    returning
      exam_submissions.id, exam_submissions.status, exam_submissions.started_at,
      exam_submissions.attempt_number, exam_submissions.question_order,
      exam_submissions.option_order, v_existing.photo_urls;
end;
$$;

revoke all on function public.start_exam_attempt(uuid, uuid[], jsonb) from public;
grant execute on function public.start_exam_attempt(uuid, uuid[], jsonb) to authenticated;
