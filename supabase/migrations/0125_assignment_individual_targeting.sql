-- Assignments/Homework never got the individual-student targeting exams
-- (0060/0061) and live classes (0054/0055) already have — a teacher could
-- only scope one to "everyone" (batch_id null) or "one whole batch", never
-- a hand-picked set of students. Mirrors the exam_participants pattern
-- exactly, including the same has_participants/participant-override
-- semantics and the same SECURITY DEFINER reasoning (a deliberately
-- excluded student must not accidentally fall through to the batch check).

create table if not exists assignment_participants (
  assignment_id uuid not null references assignments (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  primary key (assignment_id, student_id)
);

alter table assignment_participants enable row level security;

drop policy if exists "student sees own participant row; owner/admin see all" on assignment_participants;
create policy "student sees own participant row; owner/admin see all"
  on assignment_participants for select
  using (
    student_id = auth.uid()
    or exists (
      select 1 from assignments a
      where a.id = assignment_id and (can_manage_assignment_content(a.owner_type, a.owner_id, a.batch_id, a.lesson_id) or is_admin())
    )
  );

drop policy if exists "owner manages participants for their own assignment" on assignment_participants;
create policy "owner manages participants for their own assignment"
  on assignment_participants for all
  using (
    exists (
      select 1 from assignments a
      where a.id = assignment_id and (can_manage_assignment_content(a.owner_type, a.owner_id, a.batch_id, a.lesson_id) or is_admin())
    )
  )
  with check (
    exists (
      select 1 from assignments a
      where a.id = assignment_id and (can_manage_assignment_content(a.owner_type, a.owner_id, a.batch_id, a.lesson_id) or is_admin())
    )
  );

create or replace function public.is_enrolled_in_assignment(p_assignment_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  a_owner_type text;
  a_owner_id uuid;
  a_batch_id uuid;
  has_participants boolean;
begin
  select owner_type, owner_id, batch_id into a_owner_type, a_owner_id, a_batch_id
  from assignments where id = p_assignment_id;

  if not found then
    return false;
  end if;

  select exists (select 1 from assignment_participants where assignment_id = p_assignment_id) into has_participants;

  if has_participants then
    return exists (
      select 1 from assignment_participants
      where assignment_id = p_assignment_id and student_id = auth.uid()
    );
  end if;

  if a_batch_id is null then
    return is_enrolled(a_owner_type, a_owner_id);
  end if;

  return exists (
    select 1 from enrollments
    where student_id = auth.uid()
      and owner_type = a_owner_type
      and owner_id = a_owner_id
      and batch_id = a_batch_id
      and status = 'accepted'
  );
end;
$$;

-- Same batched wrapper shape as visible_exam_ids/visible_live_class_ids —
-- the student dashboard calls this once per page load instead of
-- re-deriving batch/participant visibility rules client-side.
create or replace function public.visible_assignment_ids(p_ids uuid[])
returns uuid[]
language sql
stable
as $$
  select coalesce(array_agg(id), '{}') from unnest(p_ids) as id where is_enrolled_in_assignment(id);
$$;

-- Tighten submission and file access to the batch/participant-aware check —
-- same two spots exams tightened in 0061 (question_bank_items,
-- exam_submissions), deliberately leaving the assignments table's own
-- select policy as broad as exams' base table select policy stays (0010,
-- untouched by 0061) — knowing an assignment row exists isn't sensitive,
-- being able to submit an answer or read the worksheet file is. The
-- student dashboard's own visibleAssignmentRows filter (soon backed by
-- visible_assignment_ids below) is what actually hides an out-of-scope
-- assignment from the list, the same "app layer hides the list, RLS
-- guards the content" split exams already established.
drop policy if exists "an enrolled student can submit their own assignment answers" on assignment_submissions;
create policy "an enrolled student can submit their own assignment answers"
  on assignment_submissions for insert
  with check (student_id = auth.uid() and is_enrolled_in_assignment(assignment_id));

drop policy if exists "assignment worksheet readable by anyone who can see its row" on storage.objects;
create policy "assignment worksheet readable by anyone who can see its row"
  on storage.objects for select
  using (
    bucket_id = 'assignments'
    and exists (
      select 1 from assignments a
      where a.file_path = storage.objects.name
        and (can_manage_assignment_content(a.owner_type, a.owner_id, a.batch_id, a.lesson_id) or is_enrolled_in_assignment(a.id))
    )
  );
