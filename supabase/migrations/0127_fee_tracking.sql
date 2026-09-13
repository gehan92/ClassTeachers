-- Institute dashboard's Finance tab -- internal fee/payment record-keeping
-- only (no PayHere/payment-gateway integration; that's a separate future
-- project once a merchant account exists). Institute staff manually record
-- what a student was charged and what they've paid (cash/bank transfer/
-- etc.), and the tab totals it up into an outstanding-balance view.
-- Institute-internal only, per the explicit scope decision -- no student
-- SELECT policy here, unlike every enrolled-student-visible content table.
create table fee_charges (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('class')),
  owner_id uuid not null,
  student_id uuid not null references profiles (id) on delete cascade,
  batch_id uuid references batches (id) on delete set null,
  description text not null,
  amount numeric(10, 2) not null check (amount > 0),
  charged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table fee_payments (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('class')),
  owner_id uuid not null,
  student_id uuid not null references profiles (id) on delete cascade,
  -- Optional link to a specific charge -- a payment can also just reduce a
  -- student's general balance without being tied to one particular line item.
  charge_id uuid references fee_charges (id) on delete set null,
  amount numeric(10, 2) not null check (amount > 0),
  method text not null check (method in ('cash', 'bank_transfer', 'card', 'other')),
  note text,
  paid_at timestamptz not null default now(),
  recorded_by uuid not null references profiles (id)
);

create index fee_charges_owner_idx on fee_charges (owner_type, owner_id, student_id);
create index fee_payments_owner_idx on fee_payments (owner_type, owner_id, student_id);

alter table fee_charges enable row level security;
alter table fee_payments enable row level security;

create policy "owner or admin manages fee charges"
  on fee_charges for all
  using (is_owner(owner_type, owner_id) or is_admin())
  with check (is_owner(owner_type, owner_id) or is_admin());

create policy "owner or admin manages fee payments"
  on fee_payments for all
  using (is_owner(owner_type, owner_id) or is_admin())
  with check (is_owner(owner_type, owner_id) or is_admin());
