-- Extends is_enrolled_in_exam (0060) with the publish gate (0063): a
-- student never counts as "enrolled in" an exam that isn't published yet,
-- regardless of batch/participant scoping — checked first, before those,
-- so a draft stays invisible to every student no matter how it's scoped.
-- Doesn't touch is_owner()'s own separate bypass in the policies built on
-- this function (0058, 0061, and exams' own select policy from 0010) — the
-- teacher can always see/manage/preview their own draft.
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
      and status = 'accepted'
  );
end;
$$;
