-- Institute/class profile. owner_id is the account that manages it
-- (Institute Dashboard); individual teachers are linked in via
-- class_teachers (0006), each keeping their own teacher_profiles row.

create table class_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  description text,
  ad_content text,
  photo_url text,
  location text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table class_profiles enable row level security;

create trigger class_profiles_set_updated_at
  before update on class_profiles
  for each row execute function set_updated_at();

create policy "approved class profiles are public, others owner/admin only"
  on class_profiles for select
  using (status = 'approved' or auth.uid() = owner_id or is_admin());

create policy "a user can create a class profile they own"
  on class_profiles for insert
  with check (auth.uid() = owner_id);

create policy "owner or admin can update a class profile"
  on class_profiles for update
  using (auth.uid() = owner_id or is_admin())
  with check (auth.uid() = owner_id or is_admin());

create policy "only admin can delete a class profile"
  on class_profiles for delete
  using (is_admin());
