-- No attendance table existed anywhere before this — the student/teacher
-- Attendance UI has been pure mock data since it was built. Keyed by
-- live_class_id (0012) rather than batch_id: live_classes has no batch
-- scoping of its own (same "owner-level, not batch-level" shape as
-- question_bank_items), so a live class's roster is simply everyone
-- enrolled with that teacher/institute, same as attendance_records.
-- One row per (live_class, student); status defaults to 'present' since the
-- only way a row is created client-side is a student marking themself
-- present by joining — a teacher explicitly marking absent/late is an
-- update, not a separate insert path.

create table attendance_records (
  id uuid primary key default gen_random_uuid(),
  live_class_id uuid not null references live_classes (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  status text not null default 'present' check (status in ('present', 'absent', 'late')),
  marked_at timestamptz not null default now(),
  unique (live_class_id, student_id)
);

alter table attendance_records enable row level security;

create policy "student sees own record; owner/admin see all for their live class"
  on attendance_records for select
  using (
    student_id = auth.uid()
    or exists (
      select 1 from live_classes lc
      where lc.id = live_class_id and (is_owner(lc.owner_type, lc.owner_id) or is_admin())
    )
  );

-- A student can only mark THEMSELF present, and only for a live class they
-- are actually enrolled in (this is the "Join" button's write). The owner
-- can insert a record for any of their students directly (manual marking on
-- the Attendance tab, for a student who didn't click Join).
create policy "enrolled student marks self present; owner marks anyone"
  on attendance_records for insert
  with check (
    (
      student_id = auth.uid()
      and exists (select 1 from live_classes lc where lc.id = live_class_id and is_enrolled(lc.owner_type, lc.owner_id))
    )
    or exists (select 1 from live_classes lc where lc.id = live_class_id and is_owner(lc.owner_type, lc.owner_id))
    or is_admin()
  );

-- Only the owner (or admin) corrects a status after the fact — a student
-- can't edit their own attendance once marked.
create policy "owner or admin updates attendance"
  on attendance_records for update
  using (
    exists (select 1 from live_classes lc where lc.id = live_class_id and (is_owner(lc.owner_type, lc.owner_id) or is_admin()))
  )
  with check (
    exists (select 1 from live_classes lc where lc.id = live_class_id and (is_owner(lc.owner_type, lc.owner_id) or is_admin()))
  );

create policy "owner or admin deletes attendance"
  on attendance_records for delete
  using (
    exists (select 1 from live_classes lc where lc.id = live_class_id and (is_owner(lc.owner_type, lc.owner_id) or is_admin()))
  );
