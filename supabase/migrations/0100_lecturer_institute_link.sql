-- LMS Blueprint fix: a campus lecturer already gets a teacher_profiles row
-- at signup (ensureTeacherProfileRow, same as a regular teacher — see
-- lib/auth/actions.ts) and every table downstream of class_teachers
-- (batches.taught_by_teacher_id, its RLS helpers, get_linked_teacher_names)
-- is already role-agnostic, keyed only off teacher_profiles.id. The one
-- place a lecturer account was turned away is this filter, left at
-- role = 'teacher' when campus_lecturer was introduced (0075/0076) because
-- nothing had wired the institute-invite flow to lecturers yet.
create or replace function public.find_teacher_by_email(p_email text)
returns table (id uuid, full_name text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.full_name
  from auth.users u
  join public.profiles p on p.id = u.id
  join public.teacher_profiles tp on tp.id = p.id
  where lower(u.email) = lower(p_email)
    and p.role in ('teacher', 'campus_lecturer')
  limit 1;
$$;

-- The roster list (teachers-tab.tsx) needs to know which linked accounts
-- are lecturers to badge them, same is_campus_lecturer column 0076 already
-- added to get_enrolled_teacher_names for the student-side roster. Changed
-- return shape means drop-then-recreate (same as every prior RPC column
-- addition in this project).
drop function if exists public.get_linked_teacher_names(uuid, uuid[]);

create function public.get_linked_teacher_names(p_class_id uuid, p_teacher_ids uuid[])
returns table (id uuid, full_name text, is_campus_lecturer boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.role = 'campus_lecturer'
  from profiles p
  where p.id = any(p_teacher_ids)
    and (is_owner('class', p_class_id) or is_admin())
    and exists (
      select 1 from class_teachers ct
      where ct.class_id = p_class_id and ct.teacher_id = p.id
    );
$$;

grant execute on function public.get_linked_teacher_names(uuid, uuid[]) to authenticated;
