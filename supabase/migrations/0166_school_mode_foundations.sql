-- School Mode, Phase 0: foundations.
--
-- An Institute account can now register as a School instead of a tuition
-- institute. Everything here is NEW — no existing table or policy changes,
-- so tuition institutes, teachers, ads and payments are untouched.
--
--   schools                    one per Principal account, admin-approved
--   school_staff               who works at a school (the Principal first)
--   school_roles               Principal, Vice Principal, ... + custom roles
--   school_role_permissions    action + area per role, optionally "needs approval"
--   school_member_roles        which staff member holds which role, and its scope
--   school_approval_requests   changes waiting for the Principal (or an approver)
--   school_change_log          append-only history of every change
--
-- Writes go only through the SECURITY DEFINER functions below; the tables
-- themselves have SELECT policies and nothing else. Permission checks run in
-- the database (school_access / school_can), so a hidden button can never do
-- more than the role allows.
--
-- Safe to re-run: tables use IF NOT EXISTS, policies are dropped first,
-- functions use CREATE OR REPLACE (signatures never change in this file).

-- ---------------------------------------------------------------- tables

create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  -- The Principal's account. One school per account.
  owner_id uuid not null unique references profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  school_type text not null check (school_type in ('government', 'private', 'international', 'pirivena')),
  district text not null check (char_length(district) between 2 and 40),
  address text check (address is null or char_length(address) <= 300),
  -- Ministry census number or private registration number. Optional, but
  -- it is what the admin checks before approving.
  registration_number text check (registration_number is null or char_length(registration_number) <= 60),
  mediums text[] not null check (cardinality(mediums) between 1 and 3 and mediums <@ array['si', 'ta', 'en']::text[]),
  grade_from smallint not null default 1 check (grade_from between 1 and 13),
  grade_to smallint not null default 13 check (grade_to between 1 and 13),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 30),
  contact_email text check (contact_email is null or char_length(contact_email) <= 160),
  website text check (website is null or char_length(website) <= 200),
  logo_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  decision_reason text,
  decided_at timestamptz,
  decided_by uuid references profiles (id) on delete set null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (grade_from <= grade_to)
);

create index if not exists schools_status_idx on schools (status, submitted_at desc);

drop trigger if exists schools_set_updated_at on schools;
create trigger schools_set_updated_at
  before update on schools
  for each row execute function set_updated_at();

create table if not exists school_staff (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  staff_number text check (staff_number is null or char_length(staff_number) <= 40),
  designation text check (designation is null or char_length(designation) <= 80),
  status text not null default 'active' check (status in ('active', 'on_leave', 'left')),
  joined_on date,
  left_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, profile_id)
);

-- "Which schools does this person work at" — the first lookup of every
-- permission check, so it gets its own index.
create index if not exists school_staff_profile_idx on school_staff (profile_id, school_id) where status <> 'left';

drop trigger if exists school_staff_set_updated_at on school_staff;
create trigger school_staff_set_updated_at
  before update on school_staff
  for each row execute function set_updated_at();

create table if not exists school_roles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  -- System roles use fixed keys (principal, vice_principal, ...) and are
  -- labelled on screen in the viewer's language; custom roles get custom_*.
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  name text not null check (char_length(name) between 2 and 60),
  description text check (description is null or char_length(description) <= 300),
  is_system boolean not null default false,
  -- What a holder of this role is limited to: the whole school, a grade
  -- range, some sections, some subjects, or only their own classes. The
  -- actual grades/sections/subjects live on school_member_roles.scope.
  scope_kind text not null default 'school' check (scope_kind in ('school', 'grades', 'sections', 'subjects', 'own')),
  sort_order smallint not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, key)
);

create unique index if not exists school_roles_name_idx on school_roles (school_id, lower(name));

drop trigger if exists school_roles_set_updated_at on school_roles;
create trigger school_roles_set_updated_at
  before update on school_roles
  for each row execute function set_updated_at();

create table if not exists school_role_permissions (
  role_id uuid not null references school_roles (id) on delete cascade,
  school_id uuid not null references schools (id) on delete cascade,
  area text not null check (area in (
    'settings', 'roles', 'staff', 'students', 'timetable', 'attendance', 'lessons', 'exams',
    'marks', 'report_cards', 'fees', 'notices', 'discipline', 'counseling', 'library', 'history'
  )),
  action text not null check (action in ('view', 'create', 'edit', 'delete', 'approve', 'export')),
  -- Allowed, but each change goes to the approval queue first.
  needs_approval boolean not null default false,
  primary key (role_id, area, action)
);

create table if not exists school_member_roles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  staff_id uuid not null references school_staff (id) on delete cascade,
  role_id uuid not null references school_roles (id) on delete cascade,
  -- {"grades":[6,7,8,9]} / {"sectionIds":[...]} / {"subjectIds":[...]} —
  -- filled once grades, sections and subjects exist (Phase 1).
  scope jsonb not null default '{}'::jsonb,
  assigned_by uuid references profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (staff_id, role_id)
);

create index if not exists school_member_roles_role_idx on school_member_roles (role_id);

create table if not exists school_approval_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  requested_by uuid not null references profiles (id) on delete cascade,
  area text not null,
  action text not null,
  -- What kind of change this is (e.g. "timetable.move_period"), so the code
  -- that applies it after approval knows how to read `payload`.
  kind text not null check (kind ~ '^[a-z][a-z0-9_.]{1,60}$'),
  summary text not null check (char_length(summary) between 3 and 500),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by uuid references profiles (id) on delete set null,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists school_approval_requests_school_idx on school_approval_requests (school_id, status, created_at desc);
create index if not exists school_approval_requests_requester_idx on school_approval_requests (requested_by, created_at desc);

create table if not exists school_change_log (
  id bigint generated always as identity primary key,
  school_id uuid not null references schools (id) on delete cascade,
  actor_id uuid references profiles (id) on delete set null,
  area text not null,
  -- An event key such as "role.updated"; the screen turns it into a
  -- sentence in the viewer's language.
  event text not null,
  entity_type text not null,
  entity_id text,
  entity_label text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists school_change_log_school_idx on school_change_log (school_id, created_at desc);
create index if not exists school_change_log_area_idx on school_change_log (school_id, area, created_at desc);

alter table schools enable row level security;
alter table school_staff enable row level security;
alter table school_roles enable row level security;
alter table school_role_permissions enable row level security;
alter table school_member_roles enable row level security;
alter table school_approval_requests enable row level security;
alter table school_change_log enable row level security;

-- ------------------------------------------------------ permission catalog

-- Every (area, action) pair that means something. Roles can only hold
-- pairs from this list. Role and permission changes themselves stay with
-- the Principal: "roles" can be granted as view-only, so nobody can give
-- themselves more access.
create or replace function public.school_permission_catalog()
returns table (area text, action text)
language sql
immutable
set search_path = public
as $$
  select v.area, v.action
  from (values
    ('settings', 'view'), ('settings', 'edit'),
    ('roles', 'view'),
    ('staff', 'view'), ('staff', 'create'), ('staff', 'edit'), ('staff', 'delete'), ('staff', 'approve'), ('staff', 'export'),
    ('students', 'view'), ('students', 'create'), ('students', 'edit'), ('students', 'delete'), ('students', 'approve'), ('students', 'export'),
    ('timetable', 'view'), ('timetable', 'create'), ('timetable', 'edit'), ('timetable', 'delete'), ('timetable', 'approve'),
    ('attendance', 'view'), ('attendance', 'create'), ('attendance', 'edit'), ('attendance', 'approve'), ('attendance', 'export'),
    ('lessons', 'view'), ('lessons', 'create'), ('lessons', 'edit'), ('lessons', 'delete'), ('lessons', 'approve'),
    ('exams', 'view'), ('exams', 'create'), ('exams', 'edit'), ('exams', 'delete'), ('exams', 'approve'), ('exams', 'export'),
    ('marks', 'view'), ('marks', 'create'), ('marks', 'edit'), ('marks', 'approve'), ('marks', 'export'),
    ('report_cards', 'view'), ('report_cards', 'create'), ('report_cards', 'edit'), ('report_cards', 'approve'), ('report_cards', 'export'),
    ('fees', 'view'), ('fees', 'create'), ('fees', 'edit'), ('fees', 'delete'), ('fees', 'approve'), ('fees', 'export'),
    ('notices', 'view'), ('notices', 'create'), ('notices', 'edit'), ('notices', 'delete'), ('notices', 'approve'),
    ('discipline', 'view'), ('discipline', 'create'), ('discipline', 'edit'), ('discipline', 'approve'), ('discipline', 'export'),
    ('counseling', 'view'), ('counseling', 'create'), ('counseling', 'edit'),
    ('library', 'view'), ('library', 'create'), ('library', 'edit'), ('library', 'delete'),
    ('history', 'view'), ('history', 'export')
  ) as v (area, action);
$$;

-- Starting permissions for the built-in roles. "Reset to default" on the
-- Roles screen restores exactly these. The Principal has no rows: the
-- school's owner always has full access.
create or replace function public.school_default_permissions(p_key text)
returns table (area text, action text, needs_approval boolean)
language sql
immutable
set search_path = public
as $$
  select d.area, d.action, d.needs_approval
  from (values
    -- Vice Principal: runs the school day to day; timetable changes, moving
    -- staff, marks changes and deleting students need the Principal.
    ('vice_principal', 'settings', 'view', false), ('vice_principal', 'roles', 'view', false),
    ('vice_principal', 'staff', 'view', false), ('vice_principal', 'staff', 'edit', true), ('vice_principal', 'staff', 'export', false),
    ('vice_principal', 'students', 'view', false), ('vice_principal', 'students', 'create', false), ('vice_principal', 'students', 'edit', false),
    ('vice_principal', 'students', 'delete', true), ('vice_principal', 'students', 'export', false),
    ('vice_principal', 'timetable', 'view', false), ('vice_principal', 'timetable', 'create', true), ('vice_principal', 'timetable', 'edit', true),
    ('vice_principal', 'attendance', 'view', false), ('vice_principal', 'attendance', 'create', false), ('vice_principal', 'attendance', 'edit', false),
    ('vice_principal', 'attendance', 'approve', false), ('vice_principal', 'attendance', 'export', false),
    ('vice_principal', 'lessons', 'view', false), ('vice_principal', 'lessons', 'approve', false),
    ('vice_principal', 'exams', 'view', false), ('vice_principal', 'exams', 'create', false), ('vice_principal', 'exams', 'export', false),
    ('vice_principal', 'marks', 'view', false), ('vice_principal', 'marks', 'edit', true), ('vice_principal', 'marks', 'export', false),
    ('vice_principal', 'report_cards', 'view', false), ('vice_principal', 'report_cards', 'edit', false), ('vice_principal', 'report_cards', 'export', false),
    ('vice_principal', 'fees', 'view', false),
    ('vice_principal', 'notices', 'view', false), ('vice_principal', 'notices', 'create', false), ('vice_principal', 'notices', 'edit', false),
    ('vice_principal', 'notices', 'delete', false), ('vice_principal', 'notices', 'approve', false),
    ('vice_principal', 'discipline', 'view', false), ('vice_principal', 'discipline', 'create', false), ('vice_principal', 'discipline', 'edit', false),
    ('vice_principal', 'discipline', 'approve', false),
    ('vice_principal', 'library', 'view', false), ('vice_principal', 'history', 'view', false),
    -- Sectional Head: a grade range (e.g. Grades 6-9).
    ('sectional_head', 'staff', 'view', false), ('sectional_head', 'students', 'view', false), ('sectional_head', 'students', 'export', false),
    ('sectional_head', 'timetable', 'view', false),
    ('sectional_head', 'attendance', 'view', false), ('sectional_head', 'attendance', 'edit', false), ('sectional_head', 'attendance', 'export', false),
    ('sectional_head', 'lessons', 'view', false), ('sectional_head', 'exams', 'view', false),
    ('sectional_head', 'marks', 'view', false), ('sectional_head', 'marks', 'export', false),
    ('sectional_head', 'report_cards', 'view', false), ('sectional_head', 'report_cards', 'export', false),
    ('sectional_head', 'notices', 'view', false), ('sectional_head', 'notices', 'create', false),
    ('sectional_head', 'discipline', 'view', false), ('sectional_head', 'discipline', 'create', false), ('sectional_head', 'discipline', 'edit', false),
    ('sectional_head', 'discipline', 'approve', false),
    -- Subject Head: one subject across all grades.
    ('subject_head', 'staff', 'view', false), ('subject_head', 'students', 'view', false), ('subject_head', 'timetable', 'view', false),
    ('subject_head', 'lessons', 'view', false), ('subject_head', 'lessons', 'create', false), ('subject_head', 'lessons', 'edit', false),
    ('subject_head', 'lessons', 'approve', false),
    ('subject_head', 'exams', 'view', false), ('subject_head', 'exams', 'create', false), ('subject_head', 'exams', 'edit', false),
    ('subject_head', 'exams', 'approve', false), ('subject_head', 'exams', 'export', false),
    ('subject_head', 'marks', 'view', false), ('subject_head', 'marks', 'edit', false), ('subject_head', 'marks', 'export', false),
    ('subject_head', 'notices', 'view', false),
    ('subject_head', 'library', 'view', false), ('subject_head', 'library', 'create', false),
    -- Class Teacher: their own section.
    ('class_teacher', 'students', 'view', false), ('class_teacher', 'students', 'edit', false), ('class_teacher', 'students', 'export', false),
    ('class_teacher', 'timetable', 'view', false),
    ('class_teacher', 'attendance', 'view', false), ('class_teacher', 'attendance', 'create', false), ('class_teacher', 'attendance', 'edit', false),
    ('class_teacher', 'attendance', 'export', false),
    ('class_teacher', 'lessons', 'view', false), ('class_teacher', 'marks', 'view', false), ('class_teacher', 'marks', 'export', false),
    ('class_teacher', 'report_cards', 'view', false), ('class_teacher', 'report_cards', 'edit', false),
    ('class_teacher', 'fees', 'view', false),
    ('class_teacher', 'notices', 'view', false), ('class_teacher', 'notices', 'create', false),
    ('class_teacher', 'discipline', 'view', false), ('class_teacher', 'discipline', 'create', false),
    -- Subject Teacher: the sections and subjects they teach.
    ('subject_teacher', 'students', 'view', false), ('subject_teacher', 'timetable', 'view', false),
    ('subject_teacher', 'attendance', 'view', false), ('subject_teacher', 'attendance', 'create', false), ('subject_teacher', 'attendance', 'edit', false),
    ('subject_teacher', 'lessons', 'view', false), ('subject_teacher', 'lessons', 'create', false), ('subject_teacher', 'lessons', 'edit', false),
    ('subject_teacher', 'lessons', 'delete', false),
    ('subject_teacher', 'exams', 'view', false), ('subject_teacher', 'exams', 'create', false), ('subject_teacher', 'exams', 'edit', false),
    ('subject_teacher', 'marks', 'view', false), ('subject_teacher', 'marks', 'create', false), ('subject_teacher', 'marks', 'edit', false),
    ('subject_teacher', 'marks', 'export', false),
    ('subject_teacher', 'notices', 'view', false),
    ('subject_teacher', 'library', 'view', false), ('subject_teacher', 'library', 'create', false)
  ) as d (role_key, area, action, needs_approval)
  where d.role_key = p_key;
$$;

-- ------------------------------------------------------ permission checks

-- Is the signed-in user the Principal or a current staff member?
create or replace function public.is_school_member(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from schools s where s.id = p_school_id and s.owner_id = auth.uid())
    or exists (
      select 1
      from school_staff st
      join schools s on s.id = st.school_id and s.status = 'approved'
      where st.school_id = p_school_id and st.profile_id = auth.uid() and st.status <> 'left'
    );
$$;

-- 'allow'    the signed-in user may do this now
-- 'approval' they may ask, and it goes to the approval queue first
-- 'deny'     not allowed
--
-- The Principal (school owner) can do everything, also while the school
-- is still waiting for approval, so setup can start straight away. A
-- suspended school is read-only. Other staff only get access once the
-- school is approved. When several roles grant the same thing, the most
-- generous one wins (a role that allows it without approval beats one
-- that needs approval).
create or replace function public.school_access(p_school_id uuid, p_area text, p_action text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_status text;
  v_free boolean;
  v_any boolean;
begin
  if v_uid is null then
    return 'deny';
  end if;
  select owner_id, status into v_owner, v_status from schools where id = p_school_id;
  if not found then
    return 'deny';
  end if;
  if v_owner = v_uid then
    if v_status = 'suspended' and p_action <> 'view' then
      return 'deny';
    end if;
    return 'allow';
  end if;
  if v_status <> 'approved' then
    return 'deny';
  end if;
  select bool_or(not rp.needs_approval), bool_or(true)
    into v_free, v_any
  from school_staff st
  join school_member_roles mr on mr.staff_id = st.id
  join school_role_permissions rp on rp.role_id = mr.role_id and rp.area = p_area and rp.action = p_action
  where st.school_id = p_school_id and st.profile_id = v_uid and st.status <> 'left';
  if v_free then
    return 'allow';
  elsif v_any then
    return 'approval';
  end if;
  return 'deny';
end;
$$;

create or replace function public.school_can(p_school_id uuid, p_area text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select school_access(p_school_id, p_area, p_action) = 'allow';
$$;

-- Which grades / sections / subjects a permission reaches for the signed-in
-- user: {"all":true} for school-wide roles, otherwise the union of their
-- assignments. Used from Phase 1 on, when grades and sections exist.
create or replace function public.school_scope(p_school_id uuid, p_area text, p_action text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_grades int[] := '{}';
  v_sections text[] := '{}';
  v_subjects text[] := '{}';
  v_own boolean := false;
  v_found boolean := false;
  rec record;
begin
  if exists (select 1 from schools where id = p_school_id and owner_id = v_uid) then
    return jsonb_build_object('all', true);
  end if;
  for rec in
    select r.scope_kind, mr.scope
    from school_staff st
    join schools s on s.id = st.school_id and s.status = 'approved'
    join school_member_roles mr on mr.staff_id = st.id
    join school_roles r on r.id = mr.role_id
    join school_role_permissions rp on rp.role_id = r.id and rp.area = p_area and rp.action = p_action
    where st.school_id = p_school_id and st.profile_id = v_uid and st.status <> 'left'
  loop
    v_found := true;
    if rec.scope_kind = 'school' then
      return jsonb_build_object('all', true);
    elsif rec.scope_kind = 'own' then
      v_own := true;
    end if;
    if jsonb_typeof(rec.scope -> 'grades') = 'array' then
      v_grades := v_grades || array(select jsonb_array_elements_text(rec.scope -> 'grades')::int);
    end if;
    if jsonb_typeof(rec.scope -> 'sectionIds') = 'array' then
      v_sections := v_sections || array(select jsonb_array_elements_text(rec.scope -> 'sectionIds'));
    end if;
    if jsonb_typeof(rec.scope -> 'subjectIds') = 'array' then
      v_subjects := v_subjects || array(select jsonb_array_elements_text(rec.scope -> 'subjectIds'));
    end if;
  end loop;
  if not v_found then
    return jsonb_build_object('none', true);
  end if;
  return jsonb_build_object(
    'all', false,
    'own', v_own,
    'grades', to_jsonb(array(select distinct g from unnest(v_grades) g order by g)),
    'sectionIds', to_jsonb(array(select distinct x from unnest(v_sections) x)),
    'subjectIds', to_jsonb(array(select distinct x from unnest(v_subjects) x))
  );
end;
$$;

-- Everything the signed-in user can do at this school, in one call — the
-- dashboard builds its sidebar from this.
create or replace function public.school_my_permissions(p_school_id uuid)
returns table (area text, action text, needs_approval boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_status text;
begin
  select owner_id, status into v_owner, v_status from schools where id = p_school_id;
  if not found or v_uid is null then
    return;
  end if;
  if v_owner = v_uid then
    return query
      select c.area, c.action, false
      from school_permission_catalog() c
      where v_status <> 'suspended' or c.action = 'view';
    return;
  end if;
  if v_status <> 'approved' then
    return;
  end if;
  return query
    select rp.area, rp.action, not bool_or(not rp.needs_approval)
    from school_staff st
    join school_member_roles mr on mr.staff_id = st.id
    join school_role_permissions rp on rp.role_id = mr.role_id
    where st.school_id = p_school_id and st.profile_id = v_uid and st.status <> 'left'
    group by rp.area, rp.action;
end;
$$;

-- The schools the signed-in user runs or works at (owner first).
create or replace function public.my_schools()
returns table (id uuid, name text, slug text, status text, is_owner boolean)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.name, s.slug, s.status, s.owner_id = auth.uid()
  from schools s
  where s.owner_id = auth.uid()
     or exists (
       select 1 from school_staff st
       where st.school_id = s.id and st.profile_id = auth.uid() and st.status <> 'left'
     )
  order by (s.owner_id = auth.uid()) desc, s.name;
$$;

-- --------------------------------------------------------------- policies

drop policy if exists "school visible to its owner, staff and admins" on schools;
create policy "school visible to its owner, staff and admins"
  on schools for select
  using (owner_id = auth.uid() or is_admin() or is_school_member(id));

drop policy if exists "staff visible to themselves and to staff viewers" on school_staff;
create policy "staff visible to themselves and to staff viewers"
  on school_staff for select
  using (profile_id = auth.uid() or is_admin() or school_can(school_id, 'staff', 'view'));

drop policy if exists "roles visible to school members" on school_roles;
create policy "roles visible to school members"
  on school_roles for select
  using (is_admin() or is_school_member(school_id));

drop policy if exists "role permissions visible to school members" on school_role_permissions;
create policy "role permissions visible to school members"
  on school_role_permissions for select
  using (is_admin() or is_school_member(school_id));

drop policy if exists "role assignments visible to holder and role viewers" on school_member_roles;
create policy "role assignments visible to holder and role viewers"
  on school_member_roles for select
  using (
    is_admin()
    or school_can(school_id, 'roles', 'view')
    or school_can(school_id, 'staff', 'view')
    or exists (select 1 from school_staff st where st.id = staff_id and st.profile_id = auth.uid())
  );

drop policy if exists "approval requests visible to requester and approvers" on school_approval_requests;
create policy "approval requests visible to requester and approvers"
  on school_approval_requests for select
  using (requested_by = auth.uid() or is_admin() or school_can(school_id, area, 'approve'));

drop policy if exists "change history visible to history viewers" on school_change_log;
create policy "change history visible to history viewers"
  on school_change_log for select
  using (is_admin() or school_can(school_id, 'history', 'view'));

-- ------------------------------------------------------- internal helpers

create or replace function public.school_log(
  p_school_id uuid,
  p_area text,
  p_event text,
  p_entity_type text,
  p_entity_id text,
  p_entity_label text,
  p_old jsonb default null,
  p_new jsonb default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into school_change_log (school_id, actor_id, area, event, entity_type, entity_id, entity_label, old_value, new_value)
  values (p_school_id, auth.uid(), p_area, p_event, p_entity_type, p_entity_id, p_entity_label, p_old, p_new);
$$;

create or replace function public.school_seed_roles(p_school_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into school_roles (school_id, key, name, is_system, scope_kind, sort_order)
  values
    (p_school_id, 'principal', 'Principal', true, 'school', 10),
    (p_school_id, 'vice_principal', 'Vice Principal', true, 'school', 20),
    (p_school_id, 'sectional_head', 'Sectional Head', true, 'grades', 30),
    (p_school_id, 'subject_head', 'Subject Head', true, 'subjects', 40),
    (p_school_id, 'class_teacher', 'Class Teacher', true, 'sections', 50),
    (p_school_id, 'subject_teacher', 'Subject Teacher', true, 'own', 60)
  on conflict (school_id, key) do nothing;

  insert into school_role_permissions (role_id, school_id, area, action, needs_approval)
  select r.id, p_school_id, d.area, d.action, d.needs_approval
  from school_roles r
  cross join lateral school_default_permissions(r.key) d
  where r.school_id = p_school_id and r.is_system
  on conflict (role_id, area, action) do nothing;
end;
$$;

-- One place for the school-details rules, used by register and update.
create or replace function public.school_check_details(
  p_name text,
  p_school_type text,
  p_district text,
  p_mediums text[],
  p_grade_from int,
  p_grade_to int,
  p_registration_number text,
  p_contact_phone text
)
returns void
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 160 then
    raise exception 'school_invalid_name';
  end if;
  if p_school_type is null or p_school_type not in ('government', 'private', 'international', 'pirivena') then
    raise exception 'school_invalid_type';
  end if;
  if p_district is null or char_length(trim(p_district)) < 2 or char_length(trim(p_district)) > 40 then
    raise exception 'school_invalid_district';
  end if;
  if p_mediums is null or cardinality(p_mediums) < 1 or not (p_mediums <@ array['si', 'ta', 'en']::text[]) then
    raise exception 'school_invalid_mediums';
  end if;
  if p_grade_from is null or p_grade_to is null or p_grade_from < 1 or p_grade_to > 13 or p_grade_from > p_grade_to then
    raise exception 'school_invalid_grades';
  end if;
  if p_registration_number is not null and char_length(p_registration_number) > 60 then
    raise exception 'school_invalid_registration';
  end if;
  if p_contact_phone is null or char_length(trim(p_contact_phone)) < 7 or char_length(p_contact_phone) > 30 then
    raise exception 'school_invalid_phone';
  end if;
end;
$$;

-- ------------------------------------------------------------ school RPCs

-- Called once, right after an Institute account signs up as a School.
-- Safe to call again: it just returns the existing school.
create or replace function public.register_school(
  p_name text,
  p_school_type text,
  p_district text,
  p_mediums text[],
  p_grade_from int,
  p_grade_to int,
  p_registration_number text,
  p_contact_phone text,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_email text;
  v_id uuid;
  v_base text;
  v_slug text;
  v_n int := 1;
  v_staff uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  select id into v_id from schools where owner_id = v_uid;
  if found then
    return v_id;
  end if;
  select role into v_role from profiles where id = v_uid;
  if v_role is distinct from 'class' then
    raise exception 'school_not_institute_account';
  end if;
  if exists (select 1 from class_profiles where owner_id = v_uid) then
    raise exception 'school_already_tuition';
  end if;
  perform school_check_details(p_name, p_school_type, p_district, p_mediums, p_grade_from, p_grade_to,
    nullif(trim(p_registration_number), ''), p_contact_phone);

  v_base := trim(both '-' from left(regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'), 50));
  if char_length(v_base) < 3 then
    v_base := 'school';
  end if;
  v_slug := v_base;
  while exists (select 1 from schools where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  select email into v_email from auth.users where id = v_uid;

  insert into schools (owner_id, name, slug, school_type, district, address, registration_number, mediums,
    grade_from, grade_to, contact_phone, contact_email)
  values (v_uid, trim(p_name), v_slug, p_school_type, trim(p_district), nullif(trim(p_address), ''),
    nullif(trim(p_registration_number), ''), (select array_agg(distinct m order by m) from unnest(p_mediums) m),
    p_grade_from, p_grade_to, trim(p_contact_phone), v_email)
  returning id into v_id;

  insert into school_staff (school_id, profile_id, designation, status, joined_on)
  values (v_id, v_uid, 'Principal', 'active', current_date)
  returning id into v_staff;

  perform school_seed_roles(v_id);

  insert into school_member_roles (school_id, staff_id, role_id, assigned_by)
  select v_id, v_staff, r.id, v_uid from school_roles r where r.school_id = v_id and r.key = 'principal';

  -- The school setup replaces the tuition-institute onboarding wizard.
  update profiles set profile_completed_at = coalesce(profile_completed_at, now()) where id = v_uid;

  perform school_log(v_id, 'settings', 'school.registered', 'school', v_id::text, trim(p_name), null,
    jsonb_build_object('schoolType', p_school_type, 'district', trim(p_district)));
  perform create_admin_notification('school_registered', jsonb_build_object('name', trim(p_name)), 'approvals');
  return v_id;
end;
$$;

create or replace function public.update_school_details(
  p_school_id uuid,
  p_name text,
  p_school_type text,
  p_district text,
  p_mediums text[],
  p_grade_from int,
  p_grade_to int,
  p_registration_number text,
  p_contact_phone text,
  p_address text,
  p_contact_email text,
  p_website text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old schools%rowtype;
  v_new schools%rowtype;
  v_old_json jsonb;
  v_new_json jsonb;
  v_changed_old jsonb := '{}'::jsonb;
  v_changed_new jsonb := '{}'::jsonb;
  k text;
begin
  if school_access(p_school_id, 'settings', 'edit') <> 'allow' then
    raise exception 'school_not_allowed';
  end if;
  perform school_check_details(p_name, p_school_type, p_district, p_mediums, p_grade_from, p_grade_to,
    nullif(trim(p_registration_number), ''), p_contact_phone);
  if p_contact_email is not null and char_length(p_contact_email) > 160 then
    raise exception 'school_invalid_email';
  end if;
  if p_website is not null and char_length(p_website) > 200 then
    raise exception 'school_invalid_website';
  end if;
  if p_address is not null and char_length(p_address) > 300 then
    raise exception 'school_invalid_address';
  end if;

  select * into v_old from schools where id = p_school_id for update;

  update schools set
    name = trim(p_name),
    school_type = p_school_type,
    district = trim(p_district),
    mediums = (select array_agg(distinct m order by m) from unnest(p_mediums) m),
    grade_from = p_grade_from,
    grade_to = p_grade_to,
    registration_number = nullif(trim(p_registration_number), ''),
    contact_phone = trim(p_contact_phone),
    address = nullif(trim(p_address), ''),
    contact_email = nullif(trim(p_contact_email), ''),
    website = nullif(trim(p_website), ''),
    -- Fixing a rejected application sends it back to the admin.
    status = case when status = 'rejected' then 'pending' else status end,
    submitted_at = case when status = 'rejected' then now() else submitted_at end
  where id = p_school_id
  returning * into v_new;

  v_old_json := to_jsonb(v_old) - array['updated_at', 'status', 'submitted_at', 'decision_reason', 'decided_at', 'decided_by'];
  v_new_json := to_jsonb(v_new) - array['updated_at', 'status', 'submitted_at', 'decision_reason', 'decided_at', 'decided_by'];
  for k in select jsonb_object_keys(v_new_json) loop
    if v_old_json -> k is distinct from v_new_json -> k then
      v_changed_old := v_changed_old || jsonb_build_object(k, v_old_json -> k);
      v_changed_new := v_changed_new || jsonb_build_object(k, v_new_json -> k);
    end if;
  end loop;

  if v_changed_new <> '{}'::jsonb then
    perform school_log(p_school_id, 'settings', 'school.updated', 'school', p_school_id::text, v_new.name, v_changed_old, v_changed_new);
  end if;
  if v_old.status = 'rejected' then
    perform school_log(p_school_id, 'settings', 'school.resubmitted', 'school', p_school_id::text, v_new.name);
    perform create_admin_notification('school_resubmitted', jsonb_build_object('name', v_new.name), 'approvals');
  end if;
  return v_new.status;
end;
$$;

-- Admin -> Approvals. Returns the Principal's account id so the caller can
-- notify them.
create or replace function public.admin_decide_school(p_school_id uuid, p_decision text, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school schools%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not is_admin() then
    raise exception 'school_not_allowed';
  end if;
  if p_decision not in ('approved', 'rejected', 'suspended') then
    raise exception 'school_invalid_decision';
  end if;
  if p_decision in ('rejected', 'suspended') and (v_reason is null or char_length(v_reason) < 5) then
    raise exception 'school_reason_required';
  end if;
  update schools set
    status = p_decision,
    decision_reason = case when p_decision = 'approved' then null else left(v_reason, 500) end,
    decided_at = now(),
    decided_by = auth.uid()
  where id = p_school_id
  returning * into v_school;
  if not found then
    raise exception 'school_not_found';
  end if;
  perform school_log(p_school_id, 'settings', 'school.' || p_decision, 'school', p_school_id::text, v_school.name,
    null, case when v_reason is null then null else jsonb_build_object('reason', v_reason) end);
  return v_school.owner_id;
end;
$$;

-- ------------------------------------------------------------- role RPCs

-- Create (p_role_id null) or update a role. Only the Principal changes
-- roles. Built-in roles keep their name and scope; their permissions can
-- be changed and later reset. p_permissions: [{area, action, needsApproval}].
create or replace function public.save_school_role(
  p_school_id uuid,
  p_role_id uuid,
  p_name text,
  p_description text,
  p_scope_kind text,
  p_permissions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role school_roles%rowtype;
  v_old jsonb;
  v_new jsonb;
  v_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_desc text := nullif(trim(coalesce(p_description, '')), '');
begin
  if not exists (select 1 from schools where id = p_school_id and owner_id = auth.uid() and status <> 'suspended') then
    raise exception 'school_not_allowed';
  end if;
  if jsonb_typeof(coalesce(p_permissions, '[]'::jsonb)) <> 'array' then
    raise exception 'school_invalid_permissions';
  end if;
  if v_desc is not null and char_length(v_desc) > 300 then
    raise exception 'school_invalid_description';
  end if;

  if p_role_id is null then
    if char_length(v_name) < 2 or char_length(v_name) > 60 then
      raise exception 'school_invalid_role_name';
    end if;
    if p_scope_kind not in ('school', 'grades', 'sections', 'subjects', 'own') then
      raise exception 'school_invalid_scope';
    end if;
    if (select count(*) from school_roles where school_id = p_school_id and not is_system) >= 40 then
      raise exception 'school_too_many_roles';
    end if;
    if exists (select 1 from school_roles where school_id = p_school_id and lower(name) = lower(v_name)) then
      raise exception 'school_role_name_taken';
    end if;
    insert into school_roles (school_id, key, name, description, is_system, scope_kind)
    values (p_school_id, 'custom_' || substr(md5(gen_random_uuid()::text), 1, 12), v_name, v_desc, false, p_scope_kind)
    returning * into v_role;
    v_old := null;
  else
    select * into v_role from school_roles where id = p_role_id and school_id = p_school_id for update;
    if not found then
      raise exception 'school_role_not_found';
    end if;
    if v_role.key = 'principal' then
      raise exception 'school_principal_locked';
    end if;
    select coalesce(jsonb_agg(rp.area || '.' || rp.action || case when rp.needs_approval then '*' else '' end order by rp.area, rp.action), '[]'::jsonb)
      into v_old
    from school_role_permissions rp where rp.role_id = v_role.id;
    if v_role.is_system then
      update school_roles set description = v_desc where id = v_role.id returning * into v_role;
    else
      if char_length(v_name) < 2 or char_length(v_name) > 60 then
        raise exception 'school_invalid_role_name';
      end if;
      if p_scope_kind not in ('school', 'grades', 'sections', 'subjects', 'own') then
        raise exception 'school_invalid_scope';
      end if;
      if exists (select 1 from school_roles where school_id = p_school_id and lower(name) = lower(v_name) and id <> v_role.id) then
        raise exception 'school_role_name_taken';
      end if;
      update school_roles set name = v_name, description = v_desc, scope_kind = p_scope_kind
      where id = v_role.id returning * into v_role;
    end if;
    delete from school_role_permissions where role_id = v_role.id;
  end if;

  -- Only pairs from the catalog are kept; "needs approval" only applies to
  -- changes (create / edit / delete), never to viewing or exporting.
  insert into school_role_permissions (role_id, school_id, area, action, needs_approval)
  select distinct on (x.area, x.action)
    v_role.id, p_school_id, x.area, x.action,
    coalesce(x."needsApproval", false) and x.action in ('create', 'edit', 'delete')
  from jsonb_to_recordset(coalesce(p_permissions, '[]'::jsonb)) as x (area text, action text, "needsApproval" boolean)
  join school_permission_catalog() c on c.area = x.area and c.action = x.action
  order by x.area, x.action;

  select coalesce(jsonb_agg(rp.area || '.' || rp.action || case when rp.needs_approval then '*' else '' end order by rp.area, rp.action), '[]'::jsonb)
    into v_new
  from school_role_permissions rp where rp.role_id = v_role.id;

  if v_old is null then
    perform school_log(p_school_id, 'roles', 'role.created', 'role', v_role.id::text, v_role.name, null,
      jsonb_build_object('permissions', v_new, 'scope', v_role.scope_kind));
  elsif v_old is distinct from v_new then
    perform school_log(p_school_id, 'roles', 'role.updated', 'role', v_role.id::text, v_role.name,
      jsonb_build_object('permissions', v_old), jsonb_build_object('permissions', v_new));
  end if;
  return v_role.id;
end;
$$;

create or replace function public.delete_school_role(p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role school_roles%rowtype;
begin
  select r.* into v_role
  from school_roles r
  join schools s on s.id = r.school_id
  where r.id = p_role_id and s.owner_id = auth.uid() and s.status <> 'suspended';
  if not found then
    raise exception 'school_not_allowed';
  end if;
  if v_role.is_system then
    raise exception 'school_system_role';
  end if;
  if exists (select 1 from school_member_roles where role_id = p_role_id) then
    raise exception 'school_role_in_use';
  end if;
  delete from school_roles where id = p_role_id;
  perform school_log(v_role.school_id, 'roles', 'role.deleted', 'role', p_role_id::text, v_role.name);
end;
$$;

create or replace function public.reset_school_role(p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role school_roles%rowtype;
begin
  select r.* into v_role
  from school_roles r
  join schools s on s.id = r.school_id
  where r.id = p_role_id and s.owner_id = auth.uid() and s.status <> 'suspended';
  if not found then
    raise exception 'school_not_allowed';
  end if;
  if not v_role.is_system or v_role.key = 'principal' then
    raise exception 'school_system_role';
  end if;
  delete from school_role_permissions where role_id = p_role_id;
  insert into school_role_permissions (role_id, school_id, area, action, needs_approval)
  select p_role_id, v_role.school_id, d.area, d.action, d.needs_approval
  from school_default_permissions(v_role.key) d;
  perform school_log(v_role.school_id, 'roles', 'role.reset', 'role', p_role_id::text, v_role.name);
end;
$$;

-- --------------------------------------------------------- approval RPCs

-- Used by the parts of School Mode that make changes (timetable, marks,
-- staff moves, ...): when school_access says 'approval', they file the
-- change here instead of applying it.
create or replace function public.request_school_approval(
  p_school_id uuid,
  p_area text,
  p_action text,
  p_kind text,
  p_summary text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_owner uuid;
  v_name text;
begin
  if school_access(p_school_id, p_area, p_action) <> 'approval' then
    raise exception 'school_approval_not_needed';
  end if;
  if (select count(*) from school_approval_requests
      where school_id = p_school_id and requested_by = auth.uid() and status = 'pending') >= 50 then
    raise exception 'school_too_many_requests';
  end if;
  insert into school_approval_requests (school_id, requested_by, area, action, kind, summary, payload)
  values (p_school_id, auth.uid(), p_area, p_action, p_kind, trim(p_summary), coalesce(p_payload, '{}'::jsonb))
  returning id into v_id;
  select owner_id into v_owner from schools where id = p_school_id;
  select full_name into v_name from profiles where id = auth.uid();
  perform school_log(p_school_id, p_area, 'approval.requested', 'approval', v_id::text, left(trim(p_summary), 120));
  perform create_notification(v_owner, 'school_approval_requested',
    jsonb_build_object('name', coalesce(v_name, ''), 'summary', left(trim(p_summary), 120)), 'approvals');
  return v_id;
end;
$$;

-- Approve or reject. Returns the request (kind + payload) so the caller can
-- apply an approved change. Nobody decides their own request.
create or replace function public.decide_school_approval(p_request_id uuid, p_decision text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req school_approval_requests%rowtype;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'school_invalid_decision';
  end if;
  select * into v_req from school_approval_requests where id = p_request_id for update;
  if not found then
    raise exception 'school_request_not_found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'school_request_closed';
  end if;
  if v_req.requested_by = auth.uid() then
    raise exception 'school_own_request';
  end if;
  if school_access(v_req.school_id, v_req.area, 'approve') <> 'allow' then
    raise exception 'school_not_allowed';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'school_invalid_note';
  end if;
  update school_approval_requests set
    status = p_decision,
    decided_by = auth.uid(),
    decided_at = now(),
    decision_note = v_note
  where id = p_request_id
  returning * into v_req;
  perform school_log(v_req.school_id, v_req.area, 'approval.' || p_decision, 'approval', v_req.id::text, left(v_req.summary, 120),
    null, case when v_note is null then null else jsonb_build_object('note', v_note) end);
  perform create_notification(v_req.requested_by, 'school_approval_decided',
    jsonb_build_object('decision', p_decision, 'summary', left(v_req.summary, 120)), 'approvals');
  return to_jsonb(v_req);
end;
$$;

create or replace function public.cancel_school_approval(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req school_approval_requests%rowtype;
begin
  update school_approval_requests set status = 'cancelled', decided_at = now()
  where id = p_request_id and requested_by = auth.uid() and status = 'pending'
  returning * into v_req;
  if not found then
    raise exception 'school_request_closed';
  end if;
  perform school_log(v_req.school_id, v_req.area, 'approval.cancelled', 'approval', v_req.id::text, left(v_req.summary, 120));
end;
$$;

-- ------------------------------------------------------------ read RPCs

-- Approval requests with names, newest first: everything the caller may
-- decide, plus their own requests.
create or replace function public.school_approval_list(p_school_id uuid, p_limit int default 100)
returns table (
  id uuid,
  area text,
  action text,
  kind text,
  summary text,
  status text,
  requested_by uuid,
  requester_name text,
  decider_name text,
  decision_note text,
  created_at timestamptz,
  decided_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.area, r.action, r.kind, r.summary, r.status, r.requested_by,
    coalesce(rp.full_name, ''), dp.full_name, r.decision_note, r.created_at, r.decided_at
  from school_approval_requests r
  left join profiles rp on rp.id = r.requested_by
  left join profiles dp on dp.id = r.decided_by
  where r.school_id = p_school_id
    and is_school_member(p_school_id)
    and (r.requested_by = auth.uid() or school_can(p_school_id, r.area, 'approve'))
  order by (r.status = 'pending') desc, r.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

-- Change history with names, newest first, optionally one area only.
create or replace function public.school_history(p_school_id uuid, p_area text default null, p_limit int default 50, p_offset int default 0)
returns table (
  id bigint,
  area text,
  event text,
  entity_type text,
  entity_label text,
  old_value jsonb,
  new_value jsonb,
  actor_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.area, l.event, l.entity_type, l.entity_label, l.old_value, l.new_value,
    coalesce(p.full_name, ''), l.created_at
  from school_change_log l
  left join profiles p on p.id = l.actor_id
  where l.school_id = p_school_id
    and school_can(p_school_id, 'history', 'view')
    and (p_area is null or l.area = p_area)
  order by l.created_at desc, l.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- ------------------------------------------------------------- grants

-- Supabase grants EXECUTE on new functions to anon and authenticated by
-- default, so every function is locked down first and opened deliberately.
revoke all on function public.school_permission_catalog() from public, anon, authenticated;
revoke all on function public.school_default_permissions(text) from public, anon, authenticated;
revoke all on function public.is_school_member(uuid) from public, anon, authenticated;
revoke all on function public.school_access(uuid, text, text) from public, anon, authenticated;
revoke all on function public.school_can(uuid, text, text) from public, anon, authenticated;
revoke all on function public.school_scope(uuid, text, text) from public, anon, authenticated;
revoke all on function public.school_my_permissions(uuid) from public, anon, authenticated;
revoke all on function public.my_schools() from public, anon, authenticated;
revoke all on function public.school_log(uuid, text, text, text, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.school_seed_roles(uuid) from public, anon, authenticated;
revoke all on function public.school_check_details(text, text, text, text[], int, int, text, text) from public, anon, authenticated;
revoke all on function public.register_school(text, text, text, text[], int, int, text, text, text) from public, anon, authenticated;
revoke all on function public.update_school_details(uuid, text, text, text, text[], int, int, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.admin_decide_school(uuid, text, text) from public, anon, authenticated;
revoke all on function public.save_school_role(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.delete_school_role(uuid) from public, anon, authenticated;
revoke all on function public.reset_school_role(uuid) from public, anon, authenticated;
revoke all on function public.request_school_approval(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.decide_school_approval(uuid, text, text) from public, anon, authenticated;
revoke all on function public.cancel_school_approval(uuid) from public, anon, authenticated;
revoke all on function public.school_approval_list(uuid, int) from public, anon, authenticated;
revoke all on function public.school_history(uuid, text, int, int) from public, anon, authenticated;

-- Used inside RLS policies, so any role that can query these tables needs
-- them (they answer false / 'deny' for signed-out visitors).
grant execute on function public.school_permission_catalog() to anon, authenticated;
grant execute on function public.is_school_member(uuid) to anon, authenticated;
grant execute on function public.school_access(uuid, text, text) to anon, authenticated;
grant execute on function public.school_can(uuid, text, text) to anon, authenticated;

grant execute on function public.school_scope(uuid, text, text) to authenticated;
grant execute on function public.school_my_permissions(uuid) to authenticated;
grant execute on function public.my_schools() to authenticated;
grant execute on function public.register_school(text, text, text, text[], int, int, text, text, text) to authenticated;
grant execute on function public.update_school_details(uuid, text, text, text, text[], int, int, text, text, text, text, text) to authenticated;
grant execute on function public.admin_decide_school(uuid, text, text) to authenticated;
grant execute on function public.save_school_role(uuid, uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.delete_school_role(uuid) to authenticated;
grant execute on function public.reset_school_role(uuid) to authenticated;
grant execute on function public.request_school_approval(uuid, text, text, text, text, jsonb) to authenticated;
grant execute on function public.decide_school_approval(uuid, text, text) to authenticated;
grant execute on function public.cancel_school_approval(uuid) to authenticated;
grant execute on function public.school_approval_list(uuid, int) to authenticated;
grant execute on function public.school_history(uuid, text, int, int) to authenticated;
