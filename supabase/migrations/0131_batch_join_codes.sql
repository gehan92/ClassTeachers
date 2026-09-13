-- Batch join codes: a teacher/institute shares a short code out-of-band
-- (WhatsApp, printed handout, cash-paid-offline enrollment) and a student
-- enters it to join instantly — independent of is_open_enrollment (0106),
-- which only covers a batch listed as publicly self-joinable. A join code
-- works on any batch regardless of that flag, since the point here is a
-- private/direct path, not public discovery.

alter table batches add column if not exists join_code text unique;

-- Mirrors join_open_batch (0106) almost exactly — same owner-type branching
-- on the two partial unique enrollment indexes (0092), same idempotent
-- already-accepted no-op, same capacity gate reused when set — just keyed
-- by join_code instead of gated on is_open_enrollment.
create or replace function public.join_batch_by_code(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b_id uuid;
  b_owner_type text;
  b_owner_id uuid;
  b_capacity integer;
  b_title text;
  existing_id uuid;
  existing_status text;
  accepted_count integer;
  v_recipient uuid;
  v_student_name text;
begin
  select id, owner_type, owner_id, capacity, title
  into b_id, b_owner_type, b_owner_id, b_capacity, b_title
  from batches
  where join_code = upper(trim(p_code));

  if not found then
    raise exception 'invalid_code';
  end if;

  if b_owner_type = 'class' then
    select id, status into existing_id, existing_status
    from enrollments
    where student_id = auth.uid() and owner_type = 'class' and owner_id = b_owner_id and batch_id = b_id;
  else
    select id, status into existing_id, existing_status
    from enrollments
    where student_id = auth.uid() and owner_type = 'teacher' and owner_id = b_owner_id;
  end if;

  if existing_id is not null and existing_status = 'accepted' then
    return;
  end if;

  if b_capacity is not null then
    select count(*) into accepted_count
    from enrollments
    where owner_type = b_owner_type and owner_id = b_owner_id and batch_id = b_id and status = 'accepted';
    if accepted_count >= b_capacity then
      raise exception 'batch_full';
    end if;
  end if;

  if existing_id is null then
    insert into enrollments (student_id, owner_type, owner_id, batch_id, status)
    values (auth.uid(), b_owner_type, b_owner_id, b_id, 'accepted');
  else
    update enrollments
    set batch_id = b_id, status = 'accepted', joined_at = now()
    where id = existing_id;
  end if;

  if b_owner_type = 'class' then
    select owner_id into v_recipient from class_profiles where id = b_owner_id;
  else
    v_recipient := b_owner_id;
  end if;
  select full_name into v_student_name from profiles where id = auth.uid();
  perform create_notification(
    v_recipient,
    'open_batch_joined',
    jsonb_build_object('studentName', coalesce(v_student_name, '—'), 'batchTitle', b_title),
    'students'
  );
end;
$$;

grant execute on function public.join_batch_by_code(text) to authenticated;
