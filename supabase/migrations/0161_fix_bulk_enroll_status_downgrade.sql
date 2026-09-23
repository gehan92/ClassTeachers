-- Audit fix (2026-09-23), found independently by two agents during the
-- institute dashboard audit: bulk_enroll_students_by_phone() (0134) only
-- treated an existing 'accepted' row as "already enrolled" — a student
-- whose enrollment had already progressed to 'joined' (fee paid/waived)
-- or 'qna_open' (Q&A in progress, payment not yet made) fell through to
-- the else branch and got force-set back to 'accepted', silently
-- regressing 'joined' students and completely bypassing the Q&A/payment
-- step for 'qna_open' ones. Widening the no-op check to cover all three
-- "already has an active relationship" statuses — only a genuinely new
-- student, or one whose prior request was 'pending'/'declined', gets
-- instantly force-enrolled by this institute-initiated bulk path (matching
-- the original intent: skip requests entirely for CSV import).
drop function if exists public.bulk_enroll_students_by_phone(uuid, text[]);

create function public.bulk_enroll_students_by_phone(p_batch_id uuid, p_phones text[])
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

    if v_existing_id is not null and v_existing_status in ('accepted', 'joined', 'qna_open') then
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
