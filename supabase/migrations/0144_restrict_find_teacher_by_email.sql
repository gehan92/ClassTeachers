-- find_teacher_by_email (0035) was granted to every `authenticated` user,
-- relying only on inviteTeacherToRoster's own resolveInstitute() check
-- (institute-actions.ts) to keep it institute-only. That app-level check
-- doesn't actually gate the RPC itself: any signed-in user (a student, a
-- teacher, another institute) could call supabase.rpc('find_teacher_by_
-- email', ...) directly from a browser console with an arbitrary email and
-- learn whether it belongs to a registered teacher account, plus that
-- teacher's full name. Low-severity (name + yes/no, not sensitive data),
-- but the RPC should enforce its own real boundary rather than trust every
-- caller to go through the one app flow that checks first — same
-- owner-must-exist pattern as bulk_enroll_students_by_phone (0134).
create or replace function public.find_teacher_by_email(p_email text)
returns table (id uuid, full_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from class_profiles where owner_id = auth.uid()) then
    raise exception 'not_institute_owner';
  end if;

  return query
    select p.id, p.full_name
    from auth.users u
    join public.profiles p on p.id = u.id
    join public.teacher_profiles tp on tp.id = p.id
    where lower(u.email) = lower(p_email)
      and p.role = 'teacher'
    limit 1;
end;
$$;

grant execute on function public.find_teacher_by_email(text) to authenticated;
