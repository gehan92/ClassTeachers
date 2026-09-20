-- Ad landing page "What this class offers" checklist — notes/exams/
-- assignments/homework (0047's assignment_type column distinguishes the
-- last two) are all RLS-restricted to the owner, enrolled students, or an
-- admin (0008/0010/0047), so a public ad visitor can't see even a count
-- today. Mirrors get_public_teacher_profile's own notes_count trick: a
-- security-definer function that only ever returns four booleans (does at
-- least one row exist), never any actual content, so it's safe to expose to
-- anon — same reasoning as get_public_ad only ever returning aggregate
-- rating/review_count instead of the reviews themselves.
create or replace function public.get_public_class_offerings(p_owner_type text, p_owner_id uuid)
returns table (
  has_notes boolean,
  has_exams boolean,
  has_assignments boolean,
  has_homework boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from notes n where n.owner_type = p_owner_type and n.owner_id = p_owner_id),
    exists (select 1 from exams e where e.owner_type = p_owner_type and e.owner_id = p_owner_id),
    exists (
      select 1 from assignments a
      where a.owner_type = p_owner_type and a.owner_id = p_owner_id and a.assignment_type = 'assignment'
    ),
    exists (
      select 1 from assignments a
      where a.owner_type = p_owner_type and a.owner_id = p_owner_id and a.assignment_type = 'homework'
    );
$$;

grant execute on function public.get_public_class_offerings(text, uuid) to anon, authenticated;
