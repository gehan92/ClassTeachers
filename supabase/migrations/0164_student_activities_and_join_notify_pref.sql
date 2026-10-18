-- Two small gaps found in the 2026-10-18 platform audit.
--
-- 1. Extracurriculars (0130): a student could already read their own
--    extracurricular_participants row, but not the activity it points at
--    (extracurricular_activities had only an owner/admin policy), so a
--    student-facing "My activities" view had no way to show the activity's
--    name. This lets a student read exactly the activities they're enrolled
--    in, nothing else.
--
-- 2. notify_owner_of_join (0152) wrote its notification straight through
--    create_notification, skipping the recipient's notification_prefs —
--    the one notification in the app that couldn't be muted. It now honours
--    the same "enrolments" toggle the teacher/institute Settings tab already
--    shows for every other new-student notification.
--
-- Safe to run more than once.

drop policy if exists "a student can see activities they take part in" on extracurricular_activities;
create policy "a student can see activities they take part in"
  on extracurricular_activities for select
  using (
    exists (
      select 1
      from extracurricular_participants p
      where p.activity_id = extracurricular_activities.id
        and p.student_id = auth.uid()
    )
  );

create or replace function public.notify_owner_of_join(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
  recipient_id uuid;
  student_name text;
  prefs jsonb;
begin
  select * into e from enrollments where id = p_enrollment_id;
  if not found then
    return;
  end if;

  if e.owner_type = 'teacher' then
    recipient_id := e.owner_id;
  else
    select owner_id into recipient_id from class_profiles where id = e.owner_id;
  end if;

  if recipient_id is null then
    return;
  end if;

  -- Opt-out, matching notify() in src/lib/dashboard/notify.ts: a missing key
  -- means "on"; only an explicit false mutes it.
  select notification_prefs into prefs from profiles where id = recipient_id;
  if coalesce(prefs ->> 'enrolments', 'true') = 'false' then
    return;
  end if;

  select full_name into student_name from profiles where id = e.student_id;

  perform create_notification(
    recipient_id,
    'platform_fee_join_completed',
    jsonb_build_object('studentName', coalesce(student_name, '—')),
    'students'
  );
end;
$$;

-- create or replace keeps the function's existing grants (it's only ever
-- called from inside other SECURITY DEFINER functions), so nothing to re-grant.
