-- Exams previously had no batch scoping at all — every accepted-enrollment
-- student of a teacher/institute could see every one of that teacher's
-- exams, regardless of which specific batch it was actually for, and there
-- was no way to target a hand-picked set of individually-enrolled students
-- either. Mirrors live_classes' fix (0054/0055) exactly, including the
-- reasoning in their comments — same optional-scoping shape, same
-- participant-override semantics, same SECURITY DEFINER requirement.
alter table exams add column if not exists batch_id uuid references batches (id) on delete set null;

create table if not exists exam_participants (
  exam_id uuid not null references exams (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  primary key (exam_id, student_id)
);

alter table exam_participants enable row level security;

drop policy if exists "student sees own participant row; owner/admin see all" on exam_participants;
create policy "student sees own participant row; owner/admin see all"
  on exam_participants for select
  using (
    student_id = auth.uid()
    or exists (select 1 from exams e where e.id = exam_id and (is_owner(e.owner_type, e.owner_id) or is_admin()))
  );

drop policy if exists "owner manages participants for their own exam" on exam_participants;
create policy "owner manages participants for their own exam"
  on exam_participants for all
  using (exists (select 1 from exams e where e.id = exam_id and is_owner(e.owner_type, e.owner_id)) or is_admin())
  with check (exists (select 1 from exams e where e.id = exam_id and is_owner(e.owner_type, e.owner_id)) or is_admin());

-- SECURITY DEFINER for the same reason as is_enrolled_in_live_class: the
-- "does this exam have ANY participant rows at all" check needs to see
-- rows belonging to other students, not just the caller's own — under plain
-- RLS as invoker, a student who was deliberately excluded would only ever
-- see their own (nonexistent) row, the exists-check would come back false,
-- and the function would wrongly fall through to the batch/owner check and
-- let them in anyway.
create or replace function public.is_enrolled_in_exam(p_exam_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  e_owner_type text;
  e_owner_id uuid;
  e_batch_id uuid;
  has_participants boolean;
begin
  select owner_type, owner_id, batch_id into e_owner_type, e_owner_id, e_batch_id
  from exams where id = p_exam_id;

  if not found then
    return false;
  end if;

  select exists (select 1 from exam_participants where exam_id = p_exam_id) into has_participants;

  if has_participants then
    return exists (
      select 1 from exam_participants
      where exam_id = p_exam_id and student_id = auth.uid()
    );
  end if;

  if e_batch_id is null then
    return is_enrolled(e_owner_type, e_owner_id);
  end if;

  return exists (
    select 1 from enrollments
    where student_id = auth.uid()
      and owner_type = e_owner_type
      and owner_id = e_owner_id
      and batch_id = e_batch_id
      and status = 'accepted'
  );
end;
$$;

-- Batched wrapper the student dashboard calls once per page load instead of
-- re-deriving the batch/participant visibility rules client-side or making
-- one round trip per exam — same shape as visible_live_class_ids (0055).
create or replace function public.visible_exam_ids(p_ids uuid[])
returns uuid[]
language sql
stable
as $$
  select coalesce(array_agg(id), '{}') from unnest(p_ids) as id where is_enrolled_in_exam(id);
$$;
