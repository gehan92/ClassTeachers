-- Backs the roster panel's "Remind" action for a student who hasn't
-- joined yet. This app has no outbound email/SMS/push pipeline at all —
-- this is purely an in-app banner the student sees next time they open
-- their own dashboard, added to the realtime watch list so it shows up
-- live if they already have the tab open, same as inquiries/submissions.
create table if not exists live_class_reminders (
  live_class_id uuid not null references live_classes (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (live_class_id, student_id)
);

alter table live_class_reminders enable row level security;

drop policy if exists "student sees own reminders; owner/admin see all" on live_class_reminders;
create policy "student sees own reminders; owner/admin see all"
  on live_class_reminders for select
  using (
    student_id = auth.uid()
    or exists (select 1 from live_classes lc where lc.id = live_class_id and (is_owner(lc.owner_type, lc.owner_id) or is_admin()))
  );

drop policy if exists "owner sends reminders for their own live class" on live_class_reminders;
create policy "owner sends reminders for their own live class"
  on live_class_reminders for insert
  with check (exists (select 1 from live_classes lc where lc.id = live_class_id and is_owner(lc.owner_type, lc.owner_id)) or is_admin());

-- Upsert (teacher clicking Remind again) hits this on the conflict branch —
-- needed alongside the insert policy above or the second click errors.
drop policy if exists "owner refreshes their own reminders" on live_class_reminders;
create policy "owner refreshes their own reminders"
  on live_class_reminders for update
  using (exists (select 1 from live_classes lc where lc.id = live_class_id and is_owner(lc.owner_type, lc.owner_id)) or is_admin())
  with check (exists (select 1 from live_classes lc where lc.id = live_class_id and is_owner(lc.owner_type, lc.owner_id)) or is_admin());

-- The student clears their own reminder (banner's dismiss, or after joining).
drop policy if exists "student dismisses own reminder" on live_class_reminders;
create policy "student dismisses own reminder"
  on live_class_reminders for delete
  using (student_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_class_reminders'
  ) then
    alter publication supabase_realtime add table live_class_reminders;
  end if;
end $$;
