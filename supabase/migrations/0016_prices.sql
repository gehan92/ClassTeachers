-- Three pricing levels from 01-Project-Overview.md §7: individual teacher,
-- whole class, and a teacher's rate inside a specific class — the third
-- again uses target owner_type 'teacher_in_class' with owner_id = the
-- teacher's id, resolved through resolve_owner_type() (0001) for
-- ownership checks.

create table prices (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('teacher', 'class', 'teacher_in_class')),
  owner_id uuid not null,
  hourly_rate numeric(10, 2),
  monthly_rate numeric(10, 2),
  currency text not null default 'LKR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_type, owner_id),
  check (hourly_rate is not null or monthly_rate is not null)
);

alter table prices enable row level security;

create trigger prices_set_updated_at
  before update on prices
  for each row execute function set_updated_at();

create policy "prices are public"
  on prices for select
  using (true);

create policy "owner manages their own price"
  on prices for all
  using (is_owner(resolve_owner_type(owner_type), owner_id) or is_admin())
  with check (is_owner(resolve_owner_type(owner_type), owner_id) or is_admin());
