-- Institute "Teachers" tab (teachers-tab.tsx) has always been a fully mock
-- "Invite a teacher" form — no invite/token/email infrastructure exists
-- anywhere in the schema (grepped, confirmed none). Rather than building one
-- from scratch (a much bigger scope, and one more thing riding on the SMTP
-- setup that's still pending — see the Supabase email config notes), this
-- ships the same "add by exact email, account must already exist" model
-- GitHub/Google Docs collaborator-add flows use: the institute owner must
-- already know the teacher's exact email, and the lookup only succeeds if
-- that email belongs to an existing, real teacher account. class_teachers.
-- teacher_id (0006) FKs teacher_profiles(id), so this also requires a
-- teacher_profiles row, not just profiles.role = 'teacher'.
--
-- auth.users isn't reachable through PostgREST and profiles has no email
-- column (0003), so this has to be a security definer function reading
-- auth.users directly — same shape as get_teacher_contact/get_class_contact.
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
    and p.role = 'teacher'
  limit 1;
$$;

grant execute on function public.find_teacher_by_email(text) to authenticated;
