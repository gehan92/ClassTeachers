-- Institute dashboard's Parent Portal tab -- a staff-facing contact
-- directory, NOT a new parent login/account. Institute staff record a
-- guardian's name/phone/email per student and reach them via tel:/mailto:
-- links; no messaging log, no separate auth role, one guardian per student
-- (per the explicit scope decision).
create table student_guardians (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('class')),
  owner_id uuid not null,
  student_id uuid not null references profiles (id) on delete cascade,
  guardian_name text,
  guardian_phone text,
  guardian_email text,
  note text,
  updated_at timestamptz not null default now(),
  unique (owner_id, student_id)
);

create index student_guardians_owner_idx on student_guardians (owner_type, owner_id);

alter table student_guardians enable row level security;

-- Institute-internal only -- no parent login exists to grant access to, and
-- students themselves don't need to read their own guardian's contact info
-- back (it's their institute's internal record, not theirs).
create policy "owner or admin manages student guardians"
  on student_guardians for all
  using (is_owner(owner_type, owner_id) or is_admin())
  with check (is_owner(owner_type, owner_id) or is_admin());

create trigger student_guardians_set_updated_at
  before update on student_guardians
  for each row execute function set_updated_at();
