-- An exam assembled from question_bank_items (question_ids references
-- those rows by id; not a foreign-key array since Postgres can't FK into
-- an array column — validity is enforced in the server action that builds
-- the exam, which already owns both tables).

create table exams (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('teacher', 'class')),
  owner_id uuid not null,
  subject_id uuid references subjects (id),
  title text not null,
  question_ids uuid[] not null default '{}',
  duration_minutes integer not null check (duration_minutes > 0),
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table exams enable row level security;

create trigger exams_set_updated_at
  before update on exams
  for each row execute function set_updated_at();

create policy "exams visible to owner, enrolled students, or admin"
  on exams for select
  using (is_owner(owner_type, owner_id) or is_enrolled(owner_type, owner_id) or is_admin());

create policy "owner manages their own exams"
  on exams for insert
  with check (is_owner(owner_type, owner_id));

create policy "owner or admin updates an exam"
  on exams for update
  using (is_owner(owner_type, owner_id) or is_admin())
  with check (is_owner(owner_type, owner_id) or is_admin());

create policy "owner or admin deletes an exam"
  on exams for delete
  using (is_owner(owner_type, owner_id) or is_admin());
