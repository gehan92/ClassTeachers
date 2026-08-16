-- A specific class instance under a teacher or institute (e.g. "Mon/Wed
-- 5pm A/L Maths — physical" vs "Fri A/L Maths — online"), distinct from the
-- owner as a whole. Same polymorphic owner_type/owner_id convention as
-- notes, exams, prices (0008, 0010, 0016) — one shape to learn, one
-- is_owner() check to reuse.

create table batches (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('teacher', 'class')),
  owner_id uuid not null,
  subject_id uuid references subjects (id),
  title text not null,
  mode text not null check (mode in ('online', 'physical')),
  location text,
  schedule_note text,
  -- Free-text only, no FK — an institute batch's "which teacher runs this"
  -- display. The real institute-teacher link (class_teachers) exists, but
  -- linking batch creation to it would depend on the teacher-invite flow,
  -- which isn't built yet (see 03-Full-Scenarios-Feature-Coverage.md and
  -- teachers-tab.tsx). Not shown for teacher-owned batches (owner_type =
  -- 'teacher'), where it would just repeat the owner's own name.
  teacher_label text,
  grade_band text check (grade_band in ('1-5', '6-9', '10-11', '12-13', 'campus')),
  status text not null default 'active' check (status in ('active', 'upcoming', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table batches enable row level security;

create trigger batches_set_updated_at
  before update on batches
  for each row execute function set_updated_at();

-- Public, same reasoning as live_classes' public schedule (0012): a
-- prospective student needs to see what classes a teacher/institute offers
-- before joining one.
create policy "batches are publicly readable"
  on batches for select
  using (true);

create policy "owner manages their own batches"
  on batches for all
  using (is_owner(owner_type, owner_id) or is_admin())
  with check (is_owner(owner_type, owner_id) or is_admin());

-- Both additions are nullable and purely organizational — the security
-- boundary for enrollments/notes stays exactly what it was (student_id =
-- auth.uid(); is_enrolled(owner_type, owner_id) / is_owner(...)). A
-- batch-less enrollment or note simply means "general, not tied to one
-- specific class instance" rather than "insecure".
alter table enrollments add column batch_id uuid references batches (id) on delete set null;
alter table notes add column batch_id uuid references batches (id) on delete set null;
