-- Small admin-only key/value store. First use: Admin -> Subscriptions'
-- "Plan pricing" (standard_price / premium_price), which platform_subscriptions
-- (0017) deliberately does NOT store — that table is per-owner plan/status
-- assignment, not the price itself, so MRR there needs a price from
-- somewhere. One generic table beats a single-purpose pricing table since
-- nothing else here needs its own settings yet.

create table platform_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table platform_settings enable row level security;

create trigger platform_settings_set_updated_at
  before update on platform_settings
  for each row execute function set_updated_at();

create policy "only admin reads platform settings"
  on platform_settings for select
  using (is_admin());

create policy "only admin writes platform settings"
  on platform_settings for insert
  with check (is_admin());

create policy "only admin updates platform settings"
  on platform_settings for update
  using (is_admin())
  with check (is_admin());
