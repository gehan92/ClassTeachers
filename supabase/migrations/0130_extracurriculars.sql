-- Institute dashboard's Extracurriculars tab -- clubs/activities an
-- institute runs alongside academics, with a roster of who's joined and
-- whether they've been issued a certificate. Institute-internal management
-- (staff create activities and enroll students); a student sees their own
-- participation row (student_id = auth.uid()), same "see your own" pattern
-- library_loans/fee tables use elsewhere.
create table extracurricular_activities (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('class')),
  owner_id uuid not null,
  name text not null,
  description text,
  schedule_note text,
  created_at timestamptz not null default now()
);

create table extracurricular_participants (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references extracurricular_activities (id) on delete cascade,
  owner_type text not null check (owner_type in ('class')),
  owner_id uuid not null,
  student_id uuid not null references profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  certificate_issued boolean not null default false,
  unique (activity_id, student_id)
);

create index extracurricular_activities_owner_idx on extracurricular_activities (owner_type, owner_id);
create index extracurricular_participants_owner_idx on extracurricular_participants (owner_type, owner_id, activity_id);

alter table extracurricular_activities enable row level security;
alter table extracurricular_participants enable row level security;

create policy "owner or admin manages extracurricular activities"
  on extracurricular_activities for all
  using (is_owner(owner_type, owner_id) or is_admin())
  with check (is_owner(owner_type, owner_id) or is_admin());

create policy "owner or admin manages extracurricular participants"
  on extracurricular_participants for all
  using (is_owner(owner_type, owner_id) or is_admin())
  with check (is_owner(owner_type, owner_id) or is_admin());

create policy "a student can see their own extracurricular participation"
  on extracurricular_participants for select
  using (student_id = auth.uid());
