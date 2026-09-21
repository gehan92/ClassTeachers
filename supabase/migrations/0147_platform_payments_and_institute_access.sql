-- Every PayHere transaction this feature will ever create, across all three
-- purposes (teacher connection fee, institute browsing unlock, per-class
-- join fee). One row per attempted checkout; PayHere's own order id is the
-- idempotency key so a retried/duplicated notify-webhook call can never
-- double-charge or create two unlock records — the unique constraint plus
-- "insert on checkout, update-once on confirm" pattern below is the whole
-- idempotency story.
create table if not exists platform_payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  purpose text not null check (purpose in ('teacher_connection', 'institute_unlock', 'class_join')),
  -- Exactly one of these is set, matching `purpose` (see the check below).
  enrollment_id uuid references enrollments (id) on delete cascade,
  institute_id uuid references class_profiles (id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'LKR',
  -- Our own generated order id, echoed back by PayHere's notify webhook —
  -- this is what makes a retried webhook call a no-op instead of a
  -- duplicate, not any id PayHere itself assigns up front.
  payhere_order_id text not null unique,
  payhere_payment_id text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'cancelled')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint platform_payments_target_matches_purpose check (
    (purpose in ('teacher_connection', 'class_join') and enrollment_id is not null and institute_id is null)
    or (purpose = 'institute_unlock' and institute_id is not null and enrollment_id is null)
  )
);

alter table platform_payments enable row level security;

create policy "a student sees their own payments; admin sees all"
  on platform_payments for select
  using (student_id = auth.uid() or is_admin());

-- The student's own browser creates the 'pending' row right before
-- redirecting to PayHere checkout (so there's somewhere to write the order
-- id PayHere will echo back) — same "client writes its own intent, server
-- verifies the outcome" shape as everywhere else auth-gated writes happen
-- in this schema.
create policy "a student can create their own pending payment"
  on platform_payments for insert
  with check (student_id = auth.uid() and status = 'pending');

-- Nothing else may update a payment directly — completion only ever
-- happens through mark_payment_completed() below (SECURITY DEFINER, called
-- from the notify webhook via the admin/service-role client, which
-- bypasses RLS anyway; this policy is belt-and-suspenders for any other
-- code path), matching platform_subscriptions' own "only admin or the
-- PayHere webhook via service role" precedent (0017).
create policy "only admin (or the completion function via service role) updates payments"
  on platform_payments for update
  using (is_admin())
  with check (is_admin());

-- Two-tier institute unlock (Flow B) — genuinely new, no existing table
-- covers "this student may browse this institute's full catalog."
create table if not exists institute_access (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id) on delete cascade,
  institute_id uuid not null references class_profiles (id) on delete cascade,
  payment_id uuid references platform_payments (id) on delete set null,
  unlocked_at timestamptz not null default now(),
  unique (student_id, institute_id)
);

alter table institute_access enable row level security;

create policy "a student sees their own institute unlocks; owner/admin see theirs"
  on institute_access for select
  using (student_id = auth.uid() or is_owner('class', institute_id) or is_admin());

create policy "only admin (or the completion function via service role) writes institute_access"
  on institute_access for insert
  with check (is_admin());

-- "Is this student's very first-ever paid platform connection?" — read
-- GLOBALLY across every owner (any teacher, any institute), per the spec:
-- waives the fee once per student, ever, not once per teacher. SECURITY
-- DEFINER because a student has no SELECT access to other students'
-- payments, but this only ever returns a boolean about the CALLING
-- student, never leaks another student's data.
create or replace function public.is_first_platform_connection()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from platform_payments
    where student_id = auth.uid() and status = 'completed'
  );
$$;

grant execute on function public.is_first_platform_connection() to authenticated;

-- Idempotent completion: called with the order id PayHere's webhook echoes
-- back. Re-running this for an already-completed payment is a safe no-op —
-- the `where status = 'pending'` guard means a duplicate/retried webhook
-- call can't cascade twice. Not granted to authenticated — only reachable
-- via the webhook's admin/service-role client, which independently
-- verifies PayHere's signature first (see src/lib/payhere/verify-notify.ts).
create or replace function public.mark_payment_completed(p_payhere_order_id text, p_payhere_payment_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pay record;
begin
  update platform_payments
  set status = 'completed', paid_at = now(), payhere_payment_id = p_payhere_payment_id
  where payhere_order_id = p_payhere_order_id and status = 'pending'
  returning * into pay;

  if pay.id is null then
    return; -- already completed (retry) or unknown order id; nothing to cascade.
  end if;

  if pay.purpose in ('teacher_connection', 'class_join') then
    update enrollments
    set status = 'joined', platform_fee_paid = true
    where id = pay.enrollment_id;
  elsif pay.purpose = 'institute_unlock' then
    insert into institute_access (student_id, institute_id, payment_id)
    values (pay.student_id, pay.institute_id, pay.id)
    on conflict (student_id, institute_id) do nothing;
  end if;
end;
$$;
