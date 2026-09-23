-- Audit fix (2026-09-23): 0146 widened is_enrolled()'s OWNER-LEVEL check to
-- treat 'accepted' OR 'joined' as "in", so a student who paid to join a
-- specific TEACHER unlocks correctly. But three batch-scoped functions
-- that predate the platform-fee funnel (live classes 0054/0055, exams
-- 0060/0064, assignments/homework 0125) each have their own inline
-- `status = 'accepted'` check for the "this class/exam/assignment is
-- scoped to one specific batch" branch, and none of them were updated —
-- a student who joined a specific BATCH via the paid funnel (status
-- 'joined') is wrongly excluded from that batch's live classes, exams,
-- and assignments/homework, even though they paid and are otherwise
-- fully enrolled. Widening all three to match is_enrolled()'s own rule.

create or replace function public.is_enrolled_in_live_class(p_live_class_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  lc_owner_type text;
  lc_owner_id uuid;
  lc_batch_id uuid;
  has_participants boolean;
begin
  select owner_type, owner_id, batch_id into lc_owner_type, lc_owner_id, lc_batch_id
  from live_classes where id = p_live_class_id;

  if not found then
    return false;
  end if;

  select exists (select 1 from live_class_participants where live_class_id = p_live_class_id) into has_participants;

  if has_participants then
    return exists (
      select 1 from live_class_participants
      where live_class_id = p_live_class_id and student_id = auth.uid()
    );
  end if;

  if lc_batch_id is null then
    return is_enrolled(lc_owner_type, lc_owner_id);
  end if;

  return exists (
    select 1 from enrollments
    where student_id = auth.uid()
      and owner_type = lc_owner_type
      and owner_id = lc_owner_id
      and batch_id = lc_batch_id
      and status in ('accepted', 'joined')
  );
end;
$$;

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
  e_published boolean;
  has_participants boolean;
begin
  select owner_type, owner_id, batch_id, published into e_owner_type, e_owner_id, e_batch_id, e_published
  from exams where id = p_exam_id;

  if not found or not e_published then
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
      and status in ('accepted', 'joined')
  );
end;
$$;

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
      and status in ('accepted', 'joined')
  );
end;
$$;
