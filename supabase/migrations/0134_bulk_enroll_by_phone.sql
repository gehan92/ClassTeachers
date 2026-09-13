-- CSV bulk student import, safe scope: matches against EXISTING registered
-- student accounts by phone number and enrolls them straight into a batch —
-- no new accounts created (that's a separate, much bigger decision left for
-- later). Institute-initiated, unlike every other join path (rejoin_after_
-- decline/join_open_batch/join_batch_by_code), which are all keyed on
-- auth.uid() as the STUDENT joining themselves — here the institute owner is
-- the caller, enrolling students on their behalf, so owner_id is resolved
-- server-side from auth.uid() rather than trusted from the client, and the
-- batch is checked to actually belong to that institute before anything
-- else runs.

create or replace function public.bulk_enroll_students_by_phone(p_batch_id uuid, p_phones text[])
returns table (phone text, result text) -- result: 'enrolled' | 'already_enrolled' | 'not_found'
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_phone text;
  v_student_id uuid;
  v_existing_id uuid;
  v_existing_status text;
begin
  select id into v_owner_id from class_profiles where owner_id = auth.uid();
  if v_owner_id is null then
    raise exception 'not_institute_owner';
  end if;

  if not exists (select 1 from batches where id = p_batch_id and owner_type = 'class' and owner_id = v_owner_id) then
    raise exception 'batch_not_found';
  end if;

  foreach v_phone in array p_phones loop
    select p.id into v_student_id from profiles p where p.phone = v_phone and p.role = 'student' limit 1;
    if v_student_id is null then
      phone := v_phone;
      result := 'not_found';
      return next;
      continue;
    end if;

    select id, status into v_existing_id, v_existing_status
    from enrollments
    where student_id = v_student_id and owner_type = 'class' and owner_id = v_owner_id and batch_id = p_batch_id;

    if v_existing_id is not null and v_existing_status = 'accepted' then
      phone := v_phone;
      result := 'already_enrolled';
      return next;
      continue;
    end if;

    if v_existing_id is null then
      insert into enrollments (student_id, owner_type, owner_id, batch_id, status)
      values (v_student_id, 'class', v_owner_id, p_batch_id, 'accepted');
    else
      update enrollments set status = 'accepted', joined_at = now() where id = v_existing_id;
    end if;

    phone := v_phone;
    result := 'enrolled';
    return next;
  end loop;
end;
$$;

grant execute on function public.bulk_enroll_students_by_phone(uuid, text[]) to authenticated;
