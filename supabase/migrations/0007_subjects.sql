-- Subject taxonomy (a fixed-ish list admins curate) plus a polymorphic link
-- table connecting subjects to whichever teacher/class offers them. Using
-- one (owner_type, owner_id) link table instead of separate
-- teacher_subjects/class_subjects tables mirrors the same ownership
-- pattern used by notes, exams, prices, etc. — one shape to learn, one
-- `is_owner()` check to reuse.

create table subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  -- {"en": "Combined Maths", "si": "...", "ta": "..."} — UI chrome stays in
  -- messages/*.json; this is user-facing *data*, so it lives here instead.
  translations jsonb not null default '{}'::jsonb,
  grade_band text check (grade_band in ('1-5', '6-9', '10-11', '12-13', 'campus')),
  created_at timestamptz not null default now()
);

alter table subjects enable row level security;

create policy "subjects are publicly readable"
  on subjects for select
  using (true);

create policy "only admin manages the subject taxonomy"
  on subjects for insert
  with check (is_admin());

create policy "only admin updates the subject taxonomy"
  on subjects for update
  using (is_admin())
  with check (is_admin());

create policy "only admin deletes the subject taxonomy"
  on subjects for delete
  using (is_admin());

create table subject_links (
  owner_type text not null check (owner_type in ('teacher', 'class')),
  owner_id uuid not null,
  subject_id uuid not null references subjects (id) on delete cascade,
  primary key (owner_type, owner_id, subject_id)
);

alter table subject_links enable row level security;

create policy "subject links are publicly readable"
  on subject_links for select
  using (true);

create policy "owner manages their own subject links"
  on subject_links for all
  using (is_owner(owner_type, owner_id) or is_admin())
  with check (is_owner(owner_type, owner_id) or is_admin());
