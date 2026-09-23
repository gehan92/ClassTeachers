-- Audit fix (2026-09-23): two real bugs in the student roster's phone
-- number handling.
--
-- 1) get_roster_student_info() had correct share_phone_with_teachers
--    masking added in 0069, but 0146's `create or replace` (done only to
--    widen the enrollment-status filter for the platform-fee funnel)
--    dropped that masking `case` entirely and reverted to returning
--    p.phone unconditionally. Restoring 0069's masking on top of 0146's
--    status widening.
-- 2) get_managed_batch_student_info() (0101, the roster RPC for a teacher
--    managing an institute-owned batch) never had phone masking at all —
--    an independent oversight, not a regression — and also still checked
--    status = 'accepted' only, missing 'joined' from the platform-fee
--    funnel (same gap fixed for live classes/exams/assignments in 0154).
--    Fixing both in the same pass since they're the same roster surface.

create or replace function public.get_roster_student_info(p_student_ids uuid[])
returns table (id uuid, full_name text, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    case
      when auth.uid() = p.id or is_admin() then p.phone
      when coalesce(p.share_phone_with_teachers, true) then p.phone
      else null
    end as phone
  from profiles p
  where p.id = any(p_student_ids)
    and (
      auth.uid() = p.id
      or is_admin()
      or exists (
        select 1 from enrollments e
        where e.student_id = p.id
          and e.status in ('accepted', 'joined')
          and (
            (e.owner_type = 'teacher' and e.owner_id = auth.uid())
            or (e.owner_type = 'class' and is_owner('class', e.owner_id))
          )
      )
    );
$$;

create or replace function public.get_managed_batch_student_info()
returns table (
  enrollment_id uuid,
  student_id uuid,
  full_name text,
  phone text,
  batch_id uuid,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.student_id,
    p.full_name,
    case
      when coalesce(p.share_phone_with_teachers, true) then p.phone
      else null
    end as phone,
    e.batch_id,
    e.joined_at
  from enrollments e
  join profiles p on p.id = e.student_id
  where e.owner_type = 'class'
    and e.status in ('accepted', 'joined')
    and e.batch_id is not null
    and can_manage_class_batch(e.batch_id);
$$;
