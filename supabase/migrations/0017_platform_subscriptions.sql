-- What ClassPortals charges a teacher/institute to be listed (distinct
-- from `prices`, which is what THEY charge students). Unlike prices, this
-- is not owner-editable — writes only happen from Admin -> Subscriptions
-- or the PayHere webhook (server-side, service role), so a compromised
-- account can't grant itself Premium.

create table platform_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('teacher', 'class')),
  owner_id uuid not null,
  plan text not null default 'free' check (plan in ('free', 'standard', 'premium')),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled')),
  renews_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_type, owner_id)
);

alter table platform_subscriptions enable row level security;

create trigger platform_subscriptions_set_updated_at
  before update on platform_subscriptions
  for each row execute function set_updated_at();

create policy "owner sees their own subscription; admin sees all"
  on platform_subscriptions for select
  using (is_owner(owner_type, owner_id) or is_admin());

create policy "only admin (or the PayHere webhook via service role) writes subscriptions"
  on platform_subscriptions for insert
  with check (is_admin());

create policy "only admin (or the PayHere webhook via service role) updates subscriptions"
  on platform_subscriptions for update
  using (is_admin())
  with check (is_admin());
