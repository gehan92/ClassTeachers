-- A student's photo-upload submission for an exam, later compiled into one
-- PDF (compiled_pdf_path, written server-side — see the pdf-lib job in
-- 02-Technical-Implementation.md §5) and graded by the owning teacher.

create table exam_submissions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exams (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  photo_urls text[] not null default '{}',
  compiled_pdf_path text,
  status text not null default 'pending' check (status in ('pending', 'graded')),
  grade numeric,
  feedback text,
  submitted_at timestamptz not null default now(),
  graded_at timestamptz,
  unique (exam_id, student_id)
);

alter table exam_submissions enable row level security;

-- Whoever owns the parent exam (teacher or institute) can see/grade its
-- submissions — expressed once here rather than repeated in every policy
-- below.
create or replace function public.owns_exam(p_exam_id uuid)
returns boolean
language sql
stable
as $$
  select is_owner(e.owner_type, e.owner_id)
  from exams e
  where e.id = p_exam_id;
$$;

create policy "submission visible to the student, the exam owner, or admin"
  on exam_submissions for select
  using (student_id = auth.uid() or owns_exam(exam_id) or is_admin());

-- A student may only submit to an exam they're actually enrolled for.
create policy "an enrolled student can submit their own exam answers"
  on exam_submissions for insert
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from exams e
      where e.id = exam_id and is_enrolled(e.owner_type, e.owner_id)
    )
  );

-- Grading (status/grade/feedback) and a student editing their own
-- not-yet-graded submission both go through this single policy; which
-- columns are actually allowed to change per caller is enforced by the
-- server actions (gradeSubmission vs updateSubmission), not by RLS.
create policy "student or exam owner can update a submission"
  on exam_submissions for update
  using (student_id = auth.uid() or owns_exam(exam_id) or is_admin())
  with check (student_id = auth.uid() or owns_exam(exam_id) or is_admin());
