-- Fixes a silent RLS gap: profiles' only select policy (0003) is
-- `auth.uid() = id or is_admin()` — nobody else can read anyone else's row.
-- Several already-shipped queries assume otherwise:
--   - student/page.tsx resolves a joined teacher's display name via
--     `profiles.select("full_name").in("id", teacherOwnerIds)`
--   - teacher/page.tsx resolves its student roster's name/phone the same way
--   - institute/page.tsx resolves its linked teachers' names (class_teachers
--     join) the same way, for the "Teachers at a glance" overview list
-- Under RLS all three silently return zero rows for anyone but an admin — a
-- real student sees "—" instead of their teacher's name, a real teacher sees
-- "—" instead of their students' names/phones, a real institute sees "—" for
-- every linked teacher. class_profiles.name is already public (0005) so
-- institutes-as-a-target were never affected by this, only institutes
-- reading their own linked teachers.
--
-- Same SECURITY DEFINER pattern as get_teacher_contact/get_class_contact:
-- narrowly scoped to exactly the relationship that should unlock a name,
-- batched (uuid[] in, table out) since these back list views, not single
-- lookups.

create or replace function public.get_enrolled_teacher_names(p_teacher_ids uuid[])
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name
  from profiles p
  where p.id = any(p_teacher_ids)
    and (
      auth.uid() = p.id
      or is_admin()
      or is_enrolled('teacher', p.id)
    );
$$;

grant execute on function public.get_enrolled_teacher_names(uuid[]) to authenticated;

create or replace function public.get_roster_student_info(p_student_ids uuid[])
returns table (id uuid, full_name text, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.phone
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

create or replace function public.get_linked_teacher_names(p_class_id uuid, p_teacher_ids uuid[])
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name
  from profiles p
  where p.id = any(p_teacher_ids)
    and (is_owner('class', p_class_id) or is_admin())
    and exists (
      select 1 from class_teachers ct
      where ct.class_id = p_class_id and ct.teacher_id = p.id
    );
$$;

grant execute on function public.get_linked_teacher_names(uuid, uuid[]) to authenticated;
