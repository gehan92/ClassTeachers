-- Fee plan templates: a reusable named charge (e.g. "Monthly Fee — Rs
-- 3000") an institute saves once instead of retyping description+amount on
-- every fee_charges (0127) row. owner_type is fixed to 'class' — Finance
-- is institute-only, same as fee_charges/fee_payments themselves — kept as
-- an explicit column anyway to match their shape rather than assume.

create table fee_plan_templates (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null default 'class' check (owner_type = 'class'),
  owner_id uuid not null references class_profiles (id) on delete cascade,
  name text not null,
  description text,
  amount numeric(10, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

alter table fee_plan_templates enable row level security;

create policy "institute manages its own fee plan templates"
  on fee_plan_templates for all
  using (is_owner(owner_type, owner_id) or is_admin())
  with check (is_owner(owner_type, owner_id) or is_admin());
