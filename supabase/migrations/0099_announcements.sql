-- Institute Blueprint step 6, last piece — "institute-wide notices, one
-- announcement reaching students across every class." Nothing in the app
-- models a broadcast message today (grepped for "announcement" and for a
-- notifications table — neither exists), so this is a new table rather
-- than repurposing anything. Polymorphic owner_type/owner_id, matching
-- every other content table (notes/exams/live_classes/...) rather than
-- hardcoding to institutes — costs nothing extra and leaves room for a
-- teacher's own announcement later without a schema change, even though
-- only the institute dashboard writes to it for now.
create table announcements (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('teacher', 'class')),
  owner_id uuid not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index announcements_owner_idx on announcements (owner_type, owner_id, created_at desc);

alter table announcements enable row level security;

-- Same visibility rule as every other content table: the owner (or admin)
-- always sees their own; an enrolled student sees it only once actually
-- accepted (is_enrolled), same gate notes/exams/live_classes already use.
create policy "announcements visible to owner, enrolled students, or admin"
  on announcements for select
  using (is_owner(owner_type, owner_id) or is_admin() or is_enrolled(owner_type, owner_id));

create policy "owner manages their own announcements"
  on announcements for insert
  with check (is_owner(owner_type, owner_id));

create policy "owner or admin updates an announcement"
  on announcements for update
  using (is_owner(owner_type, owner_id) or is_admin())
  with check (is_owner(owner_type, owner_id) or is_admin());

create policy "owner or admin deletes an announcement"
  on announcements for delete
  using (is_owner(owner_type, owner_id) or is_admin());
