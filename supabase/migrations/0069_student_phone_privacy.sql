-- A student had no say in whether their phone number is visible to their
-- teachers — get_roster_student_info() always returned it to any owner
-- entitled to see the roster row at all. Same pattern as teacher_profiles'
-- contact_mode (0042: a teacher opting their own phone out of visibility to
-- students) but in the other direction. Default true preserves exactly
-- today's behavior for every existing student.
alter table profiles
  add column if not exists share_phone_with_teachers boolean not null default true;

-- Masking is layered on top of the existing "is this caller even entitled
-- to this student's roster row" check (unchanged) rather than folded into
-- it — a teacher/institute still sees the student's name and can still
-- accept/decline them; only the phone digits themselves are withheld when
-- opted out. The student always sees their own phone; admin always does
-- too (support/moderation).
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
          and (
            (e.owner_type = 'teacher' and e.owner_id = auth.uid())
            or (e.owner_type = 'class' and is_owner('class', e.owner_id))
          )
      )
    );
$$;

grant execute on function public.get_roster_student_info(uuid[]) to authenticated;
