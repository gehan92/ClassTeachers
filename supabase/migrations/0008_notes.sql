-- Note/tute metadata. The PDF itself lives in the private `notes` Storage
-- bucket (0019) and is NEVER selected as a raw URL — the viewer always
-- goes through a server route that mints a short-lived signed URL and
-- stamps a watermark on the fly (02-Technical-Implementation.md §5). This
-- table only needs to gate who can see that the note *exists*.

create table notes (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('teacher', 'class')),
  owner_id uuid not null,
  subject_id uuid references subjects (id),
  title text not null,
  translations jsonb not null default '{}'::jsonb,
  file_path text not null,
  page_count integer,
  watermark_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table notes enable row level security;

create trigger notes_set_updated_at
  before update on notes
  for each row execute function set_updated_at();

-- Per 01-Project-Overview.md §9, notes are hidden from guests AND
-- logged-in-but-not-joined students — only the owner, an enrolled student,
-- or an admin sees that a note exists at all.
create policy "notes visible to owner, enrolled students, or admin"
  on notes for select
  using (is_owner(owner_type, owner_id) or is_enrolled(owner_type, owner_id) or is_admin());

create policy "owner manages their own notes"
  on notes for insert
  with check (is_owner(owner_type, owner_id));

create policy "owner or admin updates a note"
  on notes for update
  using (is_owner(owner_type, owner_id) or is_admin())
  with check (is_owner(owner_type, owner_id) or is_admin());

create policy "owner or admin deletes a note"
  on notes for delete
  using (is_owner(owner_type, owner_id) or is_admin());
