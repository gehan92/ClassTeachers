-- Two DB-level notification paths were never gated on the recipient's own
-- notification_prefs, unlike every other notify() call site (app-code and
-- DB): a teacher/institute who turns off "New join requests" still got
-- pinged on every pending request (rejoin_after_decline/
-- request_to_join_class, 0105), and one who turns off "New inquiries"
-- still got pinged on every brand-new inquiry (submit_inquiry, 0105) —
-- only the instant open-batch-join path (join_open_batch, 0110) actually
-- checked. Same "missing key defaults to on" rule as everywhere else: only
-- an explicit `false` skips the notification.

create or replace function public.submit_inquiry(
  p_owner_type text,
  p_owner_id uuid,
  p_sender_name text,
  p_sender_contact text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
  v_recipient_prefs jsonb;
begin
  if p_owner_type not in ('teacher', 'class') then
    raise exception 'invalid_owner_type';
  end if;

  if exists (
    select 1 from inquiries
    where owner_type = p_owner_type
      and owner_id = p_owner_id
      and sender_contact = trim(p_sender_contact)
      and created_at > now() - interval '10 minutes'
  ) then
    raise exception 'duplicate_inquiry';
  end if;

  insert into inquiries (owner_type, owner_id, inquirer_id, sender_name, sender_contact, message)
  values (p_owner_type, p_owner_id, auth.uid(), trim(p_sender_name), trim(p_sender_contact), trim(p_message));

  if p_owner_type = 'class' then
    select owner_id into v_recipient from class_profiles where id = p_owner_id;
  else
    v_recipient := p_owner_id;
  end if;

  select notification_prefs into v_recipient_prefs from profiles where id = v_recipient;
  if coalesce((v_recipient_prefs ->> 'newInquiries')::boolean, true) then
    perform create_notification(v_recipient, 'new_inquiry', jsonb_build_object('senderName', trim(p_sender_name)), 'inquiries');
  end if;
end;
$$;

grant execute on function public.submit_inquiry(text, uuid, text, text, text) to anon, authenticated;

create or replace function public.rejoin_after_decline(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b_owner_type text;
  b_owner_id uuid;
  b_title text;
  existing_id uuid;
  existing_status text;
  v_recipient uuid;
  v_recipient_prefs jsonb;
  v_student_name text;
begin
  select owner_type, owner_id, title into b_owner_type, b_owner_id, b_title
  from batches where id = p_batch_id;
  if not found then
    raise exception 'class_not_found';
  end if;

  if b_owner_type = 'class' then
    select id, status into existing_id, existing_status
    from enrollments
    where student_id = auth.uid() and owner_type = b_owner_type and owner_id = b_owner_id and batch_id = p_batch_id;
  else
    select id, status into existing_id, existing_status
    from enrollments
    where student_id = auth.uid() and owner_type = b_owner_type and owner_id = b_owner_id;
  end if;

  if existing_id is null then
    insert into enrollments (student_id, owner_type, owner_id, batch_id, status)
    values (auth.uid(), b_owner_type, b_owner_id, p_batch_id, 'pending');
  else
    if existing_status <> 'declined' then
      raise exception 'already_requested';
    end if;

    update enrollments
    set batch_id = p_batch_id, status = 'pending', joined_at = now()
    where id = existing_id;
  end if;

  if b_owner_type = 'class' then
    select owner_id into v_recipient from class_profiles where id = b_owner_id;
  else
    v_recipient := b_owner_id;
  end if;

  select notification_prefs into v_recipient_prefs from profiles where id = v_recipient;
  if coalesce((v_recipient_prefs ->> 'enrolments')::boolean, true) then
    select full_name into v_student_name from profiles where id = auth.uid();
    perform create_notification(
      v_recipient,
      'join_request_received',
      jsonb_build_object('studentName', coalesce(v_student_name, '—'), 'batchTitle', b_title),
      'students'
    );
  end if;
end;
$$;

create or replace function public.request_to_join_class(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  existing_status text;
  v_recipient uuid;
  v_recipient_prefs jsonb;
  v_student_name text;
begin
  if not exists (select 1 from class_profiles where id = p_class_id) then
    raise exception 'class_not_found';
  end if;

  select id, status into existing_id, existing_status
  from enrollments
  where student_id = auth.uid() and owner_type = 'class' and owner_id = p_class_id and batch_id is null;

  if existing_id is null then
    insert into enrollments (student_id, owner_type, owner_id, batch_id, status)
    values (auth.uid(), 'class', p_class_id, null, 'pending');
  else
    if existing_status <> 'declined' then
      raise exception 'already_requested';
    end if;

    update enrollments
    set status = 'pending', joined_at = now()
    where id = existing_id;
  end if;

  select owner_id into v_recipient from class_profiles where id = p_class_id;

  select notification_prefs into v_recipient_prefs from profiles where id = v_recipient;
  if coalesce((v_recipient_prefs ->> 'enrolments')::boolean, true) then
    select full_name into v_student_name from profiles where id = auth.uid();
    perform create_notification(
      v_recipient,
      'join_request_received',
      jsonb_build_object('studentName', coalesce(v_student_name, '—'), 'batchTitle', null),
      'students'
    );
  end if;
end;
$$;

grant execute on function public.request_to_join_class(uuid) to authenticated;
