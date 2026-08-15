-- One row per auth.users, 1:1, carrying the role that decides which
-- dashboard a user lands on. Contact fields (phone) live here but are
-- only ever selected out through the account-gating rules enforced by
-- teacher_profiles/class_profiles policies and get_teacher_contact()
-- (0004) — never by relaxing this table's own RLS.

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('student', 'teacher', 'class', 'campus_lecturer', 'admin')),
  full_name text not null,
  phone text,
  avatar_url text,
  preferred_locale text not null default 'en' references locales (code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create policy "users can read their own profile"
  on profiles for select
  using (auth.uid() = id or is_admin());

create policy "users can update their own profile"
  on profiles for update
  using (auth.uid() = id or is_admin())
  with check (auth.uid() = id or is_admin());

-- Row is created by the signup server action right after auth.signUp(),
-- using the new user's own session — so the check is just "inserting your
-- own id", not an open table.
create policy "a new user can create their own profile row"
  on profiles for insert
  with check (auth.uid() = id);
