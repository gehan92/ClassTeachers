-- Lightweight "tute" flow, deliberately separate from exams (0010/0011)
-- which require pre-built question_bank_items: a teacher just uploads one
-- worksheet PDF, optionally tied to a specific lesson (live_classes, 0012)
-- rather than only the whole batch the way notes are, a student uploads a
-- photo of their completed answer, and the teacher marks it. Mirrors the
-- exams/exam_submissions shape closely since that pattern is proven —
-- same RLS structure, same grading flow.

create table assignments (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('teacher', 'class')),
  owner_id uuid not null,
  lesson_id uuid references live_classes (id) on delete set null,
  title text not null,
  file_path text not null,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table assignments enable row level security;

create trigger assignments_set_updated_at
  before update on assignments
  for each row execute function set_updated_at();

create policy "assignments visible to owner, enrolled students, or admin"
  on assignments for select
  using (is_owner(owner_type, owner_id) or is_enrolled(owner_type, owner_id) or is_admin());

create policy "owner manages their own assignments"
  on assignments for insert
  with check (is_owner(owner_type, owner_id));

create policy "owner or admin updates an assignment"
  on assignments for update
  using (is_owner(owner_type, owner_id) or is_admin())
  with check (is_owner(owner_type, owner_id) or is_admin());

create policy "owner or admin deletes an assignment"
  on assignments for delete
  using (is_owner(owner_type, owner_id) or is_admin());

create table assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  photo_urls text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'graded')),
  grade numeric,
  feedback text,
  submitted_at timestamptz not null default now(),
  graded_at timestamptz,
  unique (assignment_id, student_id)
);

alter table assignment_submissions enable row level security;

create or replace function public.owns_assignment(p_assignment_id uuid)
returns boolean
language sql
stable
as $$
  select is_owner(a.owner_type, a.owner_id)
  from assignments a
  where a.id = p_assignment_id;
$$;

create policy "submission visible to the student, the assignment owner, or admin"
  on assignment_submissions for select
  using (student_id = auth.uid() or owns_assignment(assignment_id) or is_admin());

create policy "an enrolled student can submit their own assignment answers"
  on assignment_submissions for insert
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from assignments a
      where a.id = assignment_id and is_enrolled(a.owner_type, a.owner_id)
    )
  );

-- Grading (status/grade/feedback) and a student updating their own
-- not-yet-graded submission both go through this policy; which columns are
-- actually allowed to change per caller is enforced by the server actions,
-- same split as exam_submissions (0011).
create policy "student or assignment owner can update a submission"
  on assignment_submissions for update
  using (student_id = auth.uid() or owns_assignment(assignment_id) or is_admin())
  with check (student_id = auth.uid() or owns_assignment(assignment_id) or is_admin());
