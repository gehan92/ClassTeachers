-- Institute counterpart to get_teacher_contact (0004): the public /class/[id]
-- page needs the same "phone visible once enrolled" gate teacher profiles
-- already have, but nothing analogous exists for institutes yet. class_profiles
-- has no phone column of its own — the institute's contact number is the
-- owner account's profiles.phone, same as everywhere else in the app.

create or replace function public.get_class_contact(p_class_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.phone
  from class_profiles cp
  join profiles p on p.id = cp.owner_id
  where cp.id = p_class_id
    and (
      auth.uid() = cp.owner_id
      or is_admin()
      or is_enrolled('class', p_class_id)
    );
$$;

grant execute on function public.get_class_contact(uuid) to anon, authenticated;
