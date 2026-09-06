-- Structured weekly recurring schedule for a batch (Gehan wanted a real
-- timetable grid, not just the free-text schedule_note a batch already
-- has) — one row per meeting slot, so a class that meets twice a week (e.g.
-- Mon and Wed) is two rows, not one. schedule_note is untouched and keeps
-- showing wherever it already does; these slots are purely what powers the
-- new student-side Calendar tab's weekly timetable grid.

create table batch_schedule_slots (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches (id) on delete cascade,
  -- Denormalized from the batch, same shape notes/exams/live_classes already
  -- use, so the standard is_owner/is_enrolled RLS pattern applies directly
  -- with no join through batches needed.
  owner_type text not null check (owner_type in ('teacher', 'class')),
  owner_id uuid not null,
  -- 0 = Sunday .. 6 = Saturday, matching JS Date#getDay().
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);

alter table batch_schedule_slots enable row level security;

create policy "schedule slots visible to owner, enrolled students, or admin"
  on batch_schedule_slots for select
  using (is_owner(owner_type, owner_id) or is_enrolled(owner_type, owner_id) or is_admin());

create policy "owner manages their own batch's schedule slots"
  on batch_schedule_slots for insert
  with check (is_owner(owner_type, owner_id));

create policy "owner updates their own batch's schedule slots"
  on batch_schedule_slots for update
  using (is_owner(owner_type, owner_id))
  with check (is_owner(owner_type, owner_id));

create policy "owner deletes their own batch's schedule slots"
  on batch_schedule_slots for delete
  using (is_owner(owner_type, owner_id));

create index batch_schedule_slots_batch_id_idx on batch_schedule_slots (batch_id);
