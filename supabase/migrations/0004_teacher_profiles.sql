-- Public-facing teacher profile. `status` gates visibility: a pending
-- registration is invisible to everyone except its owner and admins until
-- approved (Admin -> Approvals, see audit_log).

create table teacher_profiles (
  id uuid primary key references profiles (id) on delete cascade,
  headline text,
  bio text,
  qualifications text,
  experience_years integer check (experience_years >= 0),
  class_type text not null default 'physical' check (class_type in ('physical', 'online', 'both')),
  location text,
  photo_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table teacher_profiles enable row level security;

create trigger teacher_profiles_set_updated_at
  before update on teacher_profiles
  for each row execute function set_updated_at();

create policy "approved teacher profiles are public, others owner/admin only"
  on teacher_profiles for select
  using (status = 'approved' or auth.uid() = id or is_admin());

create policy "a teacher can create their own profile"
  on teacher_profiles for insert
  with check (auth.uid() = id);

create policy "owner or admin can update a teacher profile"
  on teacher_profiles for update
  using (auth.uid() = id or is_admin())
  with check (auth.uid() = id or is_admin());

create policy "only admin can delete a teacher profile"
  on teacher_profiles for delete
  using (is_admin());

-- Phone number is intentionally NOT selectable through teacher_profiles or
-- profiles by the public. It's only ever released through this function,
-- which checks the account-gating rule from 01-Project-Overview.md §9:
-- visible once the caller has actually joined this teacher, or is the
-- teacher/an admin. SECURITY DEFINER is required here (profiles.phone
-- isn't selectable by other users under profiles' own RLS).
create or replace function public.get_teacher_contact(p_teacher_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select phone from profiles
  where id = p_teacher_id
    and (
      auth.uid() = p_teacher_id
      or is_admin()
      or is_enrolled('teacher', p_teacher_id)
    );
$$;
