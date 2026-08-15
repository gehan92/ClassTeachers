-- The join/enroll relationship that unlocks contact info, notes, exams and
-- reviewing rights (is_enrolled(), defined in 0001, reads this table).

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  owner_type text not null check (owner_type in ('teacher', 'class')),
  owner_id uuid not null,
  joined_at timestamptz not null default now(),
  unique (student_id, owner_type, owner_id)
);

alter table enrollments enable row level security;

create policy "a student sees their own enrollments; owner/admin see theirs"
  on enrollments for select
  using (student_id = auth.uid() or is_owner(owner_type, owner_id) or is_admin());

create policy "a student can enroll themself"
  on enrollments for insert
  with check (student_id = auth.uid());

create policy "a student can leave; admin can remove any enrollment"
  on enrollments for delete
  using (student_id = auth.uid() or is_admin());
