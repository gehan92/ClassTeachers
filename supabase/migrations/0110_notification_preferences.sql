-- Every notify() call (src/lib/dashboard/notify.ts) used to fire
-- unconditionally, ignoring profiles.notification_prefs entirely -- the
-- Settings tab's toggles looked functional but didn't actually gate
-- anything. App-code call sites now pass a prefKey and notify() checks it
-- itself; join_open_batch is the one notification-creating path that lives
-- in the database instead of app code (0106), so it needs the same check
-- added here directly. Same "missing key defaults to on" rule as the app
-- code: only an explicit `false` skips the notification.

create or replace function public.join_open_batch(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b_owner_type text;
  b_owner_id uuid;
  b_is_open boolean;
  b_capacity integer;
  b_title text;
  existing_id uuid;
  existing_status text;
  accepted_count integer;
  v_recipient uuid;
  v_student_name text;
  v_recipient_prefs jsonb;
begin
  select owner_type, owner_id, is_open_enrollment, capacity, title
  into b_owner_type, b_owner_id, b_is_open, b_capacity, b_title
  from batches where id = p_batch_id;

  if not found then
    raise exception 'class_not_found';
  end if;
  if not b_is_open then
    raise exception 'not_open_enrollment';
  end if;

  if b_owner_type = 'class' then
    select id, status into existing_id, existing_status
    from enrollments
    where student_id = auth.uid() and owner_type = 'class' and owner_id = b_owner_id and batch_id = p_batch_id;
  else
    select id, status into existing_id, existing_status
    from enrollments
    where student_id = auth.uid() and owner_type = 'teacher' and owner_id = b_owner_id;
  end if;

  -- Already in this exact class — idempotent no-op rather than an error, so
  -- a "Join now" button clicked twice (or reloaded mid-flight) never surfaces
  -- a confusing failure.
  if existing_id is not null and existing_status = 'accepted' then
    return;
  end if;

  if b_capacity is not null then
    select count(*) into accepted_count
    from enrollments
    where owner_type = b_owner_type and owner_id = b_owner_id and batch_id = p_batch_id and status = 'accepted';
    if accepted_count >= b_capacity then
      raise exception 'batch_full';
    end if;
  end if;

  if existing_id is null then
    insert into enrollments (student_id, owner_type, owner_id, batch_id, status)
    values (auth.uid(), b_owner_type, b_owner_id, p_batch_id, 'accepted');
  else
    update enrollments
    set batch_id = p_batch_id, status = 'accepted', joined_at = now()
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
      'open_batch_joined',
      jsonb_build_object('studentName', coalesce(v_student_name, '—'), 'batchTitle', b_title),
      'students'
    );
  end if;
end;
$$;
