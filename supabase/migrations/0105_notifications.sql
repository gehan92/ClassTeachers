-- Real in-app notification center, replacing the header bell's old behavior
-- (jump to one hardcoded tab and show that tab's pending count — no history,
-- no Admin bell at all). Every notification-worthy action across all four
-- dashboards now writes a row here; the bell reads it back as an actual
-- list with unread state, not a single tab's count.
--
-- Inserts never go through a plain RLS policy: create_notification/
-- create_admin_notification are the only way to write a row, both SECURITY
-- DEFINER, so this also covers the one anon-writable path in the schema
-- (submit_inquiry, 0037) without needing a separate anon-vs-authenticated
-- insert policy.

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  -- Which dashboard tab the bell should jump to on click — same `?tab=`
  -- mechanism dashboard-shell.tsx already uses, so this is just a tab key
  -- ("students", "exams", "reviews", ...), not a URL. Null when there's
  -- nowhere more specific to send them than the dashboard they're already on.
  tab text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create policy "a recipient can view their own notifications"
  on notifications for select
  using (recipient_id = auth.uid());

create policy "a recipient can mark their own notifications read"
  on notifications for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create index notifications_recipient_created_idx on notifications (recipient_id, created_at desc);
create index notifications_recipient_unread_idx on notifications (recipient_id) where read_at is null;

create or replace function public.create_notification(
  p_recipient_id uuid,
  p_type text,
  p_data jsonb default '{}'::jsonb,
  p_tab text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipient_id is null then
    return;
  end if;
  insert into notifications (recipient_id, type, data, tab)
  values (p_recipient_id, p_type, coalesce(p_data, '{}'::jsonb), p_tab);
end;
$$;

grant execute on function public.create_notification(uuid, text, jsonb, text) to anon, authenticated;

-- Broadcasts to every admin at once — used for moderation-queue events
-- (a listing resubmitted for review, a review flagged) that don't belong to
-- any one admin in particular.
create or replace function public.create_admin_notification(
  p_type text,
  p_data jsonb default '{}'::jsonb,
  p_tab text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (recipient_id, type, data, tab)
  select id, p_type, coalesce(p_data, '{}'::jsonb), p_tab
  from profiles
  where role = 'admin';
end;
$$;

grant execute on function public.create_admin_notification(text, jsonb, text) to authenticated;

-- Extends submit_inquiry (0037) to notify the owner — full body unchanged
-- otherwise, just an added notify call right after the insert.
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
  perform create_notification(v_recipient, 'new_inquiry', jsonb_build_object('senderName', trim(p_sender_name)), 'inquiries');
end;
$$;

grant execute on function public.submit_inquiry(text, uuid, text, text, text) to anon, authenticated;

-- Extends rejoin_after_decline (0097) to notify the class/teacher owner of
-- the new join request — full body unchanged otherwise.
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
  select full_name into v_student_name from profiles where id = auth.uid();
  perform create_notification(
    v_recipient,
    'join_request_received',
    jsonb_build_object('studentName', coalesce(v_student_name, '—'), 'batchTitle', b_title),
    'students'
  );
end;
$$;

-- Extends request_to_join_class (0103) the same way, for the general
-- "Join this institute" apply that has no batch (and so no batches.title)
-- attached yet.
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
  select full_name into v_student_name from profiles where id = auth.uid();
  perform create_notification(
    v_recipient,
    'join_request_received',
    jsonb_build_object('studentName', coalesce(v_student_name, '—'), 'batchTitle', null),
    'students'
  );
end;
$$;

grant execute on function public.request_to_join_class(uuid) to authenticated;
