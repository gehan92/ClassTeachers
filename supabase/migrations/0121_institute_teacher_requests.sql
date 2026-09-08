-- Institute Blueprint, teacher-initiated affiliation: so far a teacher can
-- only be invited by an institute (0091) and accept/decline; this adds the
-- reverse direction -- a teacher finds an institute's public page and
-- requests to join it, the institute then approves/declines. Mirrors
-- request_to_join_class (0103), which does the same thing for a student and
-- an institute, but against class_teachers instead of enrollments.

-- Existing rows are all institute-sent invites (that was the only way a row
-- could ever get created before this migration), so the default backfills
-- them correctly with zero ambiguity.
alter table class_teachers
  add column if not exists requested_by text not null default 'institute'
  check (requested_by in ('institute', 'teacher'));

-- Widened for the new direction: a teacher may now also revive their own
-- declined row back to 'pending' (re-requesting after being turned down),
-- not just reply to a still-pending invite. Everything else about the
-- teacher's own update rights is unchanged from 0091.
create or replace function public.restrict_class_teacher_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_owner('class', new.class_id) or is_admin() then
    return new;
  end if;

  if old.teacher_id = auth.uid() then
    if new.class_id is distinct from old.class_id
      or new.teacher_id is distinct from old.teacher_id
      or new.is_visible is distinct from old.is_visible
    then
      raise exception 'You can only accept or decline a pending invite.';
    end if;

    -- Reply to an institute-sent invite: pending -> accepted/declined,
    -- nothing else about the row moves.
    if old.status = 'pending' and new.status in ('accepted', 'declined') and new.joined_at = old.joined_at then
      return new;
    end if;

    -- Re-request after the institute declined a previous request of yours
    -- (request_to_join_institute below) -- mirrors rejoin_after_decline's
    -- same declined -> pending reset for a student's class request.
    if old.status = 'declined' and new.status = 'pending' and new.requested_by = 'teacher' then
      return new;
    end if;

    raise exception 'You can only accept or decline a pending invite.';
  end if;

  raise exception 'You do not have permission to update this link.';
end;
$$;

create or replace function public.request_to_join_institute(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_status text;
  v_recipient uuid;
  v_teacher_name text;
begin
  if not exists (select 1 from class_profiles where id = p_class_id) then
    raise exception 'class_not_found';
  end if;

  select status into existing_status
  from class_teachers
  where class_id = p_class_id and teacher_id = auth.uid();

  if existing_status is null then
    insert into class_teachers (class_id, teacher_id, status, requested_by)
    values (p_class_id, auth.uid(), 'pending', 'teacher');
  elsif existing_status = 'declined' then
    update class_teachers
    set status = 'pending', requested_by = 'teacher', joined_at = now()
    where class_id = p_class_id and teacher_id = auth.uid();
  else
    raise exception 'already_requested';
  end if;

  select owner_id into v_recipient from class_profiles where id = p_class_id;
  select full_name into v_teacher_name from profiles where id = auth.uid();
  perform create_notification(
    v_recipient,
    'institute_join_request_received',
    jsonb_build_object('teacherName', coalesce(v_teacher_name, '—')),
    'teachers'
  );
end;
$$;

grant execute on function public.request_to_join_institute(uuid) to authenticated;
