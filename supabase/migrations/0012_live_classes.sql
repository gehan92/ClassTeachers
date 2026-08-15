-- Live class schedule is split into a public part (live_classes — shown on
-- the public profile per the prototype's "Live class schedule" block) and
-- a private part (live_class_links — the actual Zoom/Meet URL, released
-- only to the owner, an enrolled student, or an admin). Keeping the link
-- in its own 1:1 table lets plain row-level RLS do the gating instead of
-- needing a get_*() function like teacher contact info does.

create table live_classes (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('teacher', 'class')),
  owner_id uuid not null,
  subject_id uuid references subjects (id),
  title text not null,
  mode text not null check (mode in ('online', 'physical')),
  location text,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table live_classes enable row level security;

create policy "live class schedule is public"
  on live_classes for select
  using (true);

create policy "owner manages their own live classes"
  on live_classes for all
  using (is_owner(owner_type, owner_id) or is_admin())
  with check (is_owner(owner_type, owner_id) or is_admin());

create table live_class_links (
  live_class_id uuid primary key references live_classes (id) on delete cascade,
  join_link text not null
);

alter table live_class_links enable row level security;

create policy "join link visible to owner, enrolled students, or admin"
  on live_class_links for select
  using (
    exists (
      select 1 from live_classes lc
      where lc.id = live_class_id
        and (is_owner(lc.owner_type, lc.owner_id) or is_enrolled(lc.owner_type, lc.owner_id) or is_admin())
    )
  );

create policy "owner manages their own join links"
  on live_class_links for all
  using (
    exists (select 1 from live_classes lc where lc.id = live_class_id and is_owner(lc.owner_type, lc.owner_id))
    or is_admin()
  )
  with check (
    exists (select 1 from live_classes lc where lc.id = live_class_id and is_owner(lc.owner_type, lc.owner_id))
    or is_admin()
  );
