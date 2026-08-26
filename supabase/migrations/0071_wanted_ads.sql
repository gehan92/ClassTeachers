-- Demand-side ad: a student posts what they're looking for ("I'm looking
-- for a Maths tutor") instead of a teacher/institute posting a class to
-- fill. Deliberately its own table rather than a fifth advertisements
-- .owner_type (0014) — every advertisements row is tied to a batch_id and
-- a paid plan/placement, neither of which applies here: a wanted post has
-- no class to attach to, and payment for this is a later discussion (kept
-- unpriced for now). Browsing/responding to these from the teacher/
-- institute side is a separate follow-up — this migration only covers the
-- student posting/managing their own.
create table wanted_ads (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  looking_for text not null check (looking_for in ('teacher', 'institute')),
  subject_id uuid references subjects (id) on delete set null,
  -- Matches batches.mode's vocabulary (0020: 'online'/'physical') plus
  -- 'both' for a student open to either.
  mode text check (mode in ('online', 'physical', 'both')),
  grade_level text,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table wanted_ads enable row level security;

create trigger wanted_ads_set_updated_at
  before update on wanted_ads
  for each row execute function set_updated_at();

-- Same shape as advertisements' select policy (0014): active rows are
-- readable by anyone (teachers/institutes will need to browse these once
-- that side is built), the posting student and admin can always see their
-- own regardless of status.
create policy "active wanted ads are public; student/admin see all statuses"
  on wanted_ads for select
  using (status = 'active' or student_id = auth.uid() or is_admin());

create policy "a student creates their own wanted ads"
  on wanted_ads for insert
  with check (student_id = auth.uid());

create policy "a student updates their own wanted ads"
  on wanted_ads for update
  using (student_id = auth.uid() or is_admin())
  with check (student_id = auth.uid() or is_admin());

create policy "a student deletes their own wanted ads"
  on wanted_ads for delete
  using (student_id = auth.uid() or is_admin());
