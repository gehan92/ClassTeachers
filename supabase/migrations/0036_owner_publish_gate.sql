-- setListingPublished (src/lib/dashboard/actions.ts) has been letting an
-- owner self-write teacher_profiles/class_profiles.status = 'approved' —
-- the exact column Admin -> Approvals (resolveApproval, already fully built
-- and wired, see admin-actions.ts) is supposed to gate. That made the
-- approval queue completely bypassable: a brand-new, unverified teacher
-- could publish straight to public search the moment they saved their
-- profile.
--
-- Splitting "has an admin approved this" (status) from "does the owner want
-- it visible right now" (owner_published) fixes that: the self-service
-- toggle now only ever touches owner_published, never status. status can
-- only move to 'approved'/'rejected' via resolveApproval (admin-only). A
-- listing only ever shows up publicly when both are true.

alter table teacher_profiles add column if not exists owner_published boolean not null default true;
alter table class_profiles add column if not exists owner_published boolean not null default true;

drop policy if exists "approved teacher profiles are public, others owner/admin only" on teacher_profiles;
create policy "approved and published teacher profiles are public, others owner/admin only"
  on teacher_profiles for select
  using ((status = 'approved' and owner_published) or auth.uid() = id or is_admin());

drop policy if exists "approved class profiles are public, others owner/admin only" on class_profiles;
create policy "approved and published class profiles are public, others owner/admin only"
  on class_profiles for select
  using ((status = 'approved' and owner_published) or auth.uid() = owner_id or is_admin());

-- list_public_teachers/get_public_teacher_profile are SECURITY DEFINER
-- (0021/0026) and so bypass RLS entirely — they need the same condition
-- added directly, or a self-unpublished-but-approved teacher would still
-- show up in search despite the RLS change above.
create or replace function public.list_public_teachers()
returns table (
  id uuid,
  role text,
  display_name text,
  headline text,
  location text,
  class_type text,
  hourly_rate numeric,
  monthly_rate numeric,
  rating numeric,
  review_count bigint,
  subjects text[],
  grade_band text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    tp.id,
    p.role,
    mask_display_name(p.full_name),
    tp.headline,
    tp.location,
    tp.class_type,
    pr.hourly_rate,
    pr.monthly_rate,
    coalesce(rv.rating, 0),
    coalesce(rv.review_count, 0),
    coalesce(sj.subjects, array[]::text[]),
    case when p.role = 'campus_lecturer' then 'campus' else sj.top_grade_band end
  from teacher_profiles tp
  join profiles p on p.id = tp.id
  left join prices pr on pr.owner_type = 'teacher' and pr.owner_id = tp.id
  left join lateral (
    select avg(r.rating)::numeric(3, 2) as rating, count(*) as review_count
    from reviews r
    where r.target_type = 'teacher' and r.target_id = tp.id
  ) rv on true
  left join lateral (
    select
      array_agg(distinct s.translations ->> 'en') filter (where s.translations ->> 'en' is not null) as subjects,
      mode() within group (order by s.grade_band) as top_grade_band
    from subject_links sl
    join subjects s on s.id = sl.subject_id
    where sl.owner_type = 'teacher' and sl.owner_id = tp.id
  ) sj on true
  where tp.status = 'approved' and tp.owner_published;
$$;

create or replace function public.get_public_teacher_profile(p_teacher_id uuid)
returns table (
  id uuid,
  display_name text,
  headline text,
  bio text,
  location text,
  class_type text,
  experience_years integer,
  qualifications text[],
  photo_url text,
  hourly_rate numeric,
  monthly_rate numeric,
  rating numeric,
  review_count bigint,
  notes_count bigint,
  subjects text[],
  grade_band text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    tp.id,
    mask_display_name(p.full_name),
    tp.headline,
    tp.bio,
    tp.location,
    tp.class_type,
    tp.experience_years,
    tp.qualifications,
    tp.photo_url,
    pr.hourly_rate,
    pr.monthly_rate,
    coalesce(rv.rating, 0),
    coalesce(rv.review_count, 0),
    coalesce(nt.notes_count, 0),
    coalesce(sj.subjects, array[]::text[]),
    sj.top_grade_band
  from teacher_profiles tp
  join profiles p on p.id = tp.id
  left join prices pr on pr.owner_type = 'teacher' and pr.owner_id = tp.id
  left join lateral (
    select avg(r.rating)::numeric(3, 2) as rating, count(*) as review_count
    from reviews r
    where r.target_type = 'teacher' and r.target_id = tp.id
  ) rv on true
  left join lateral (
    select count(*) as notes_count
    from notes n
    where n.owner_type = 'teacher' and n.owner_id = tp.id
  ) nt on true
  left join lateral (
    select
      array_agg(distinct s.translations ->> 'en') filter (where s.translations ->> 'en' is not null) as subjects,
      mode() within group (order by s.grade_band) as top_grade_band
    from subject_links sl
    join subjects s on s.id = sl.subject_id
    where sl.owner_type = 'teacher' and sl.owner_id = tp.id
  ) sj on true
  where tp.id = p_teacher_id and tp.status = 'approved' and tp.owner_published;
$$;

-- list_public_classes() isn't SECURITY DEFINER, so it already inherits the
-- RLS change above — this just keeps its own where clause consistent with
-- its sibling functions rather than relying solely on RLS.
create or replace function public.list_public_classes()
returns table (
  id uuid,
  name text,
  location text,
  hourly_rate numeric,
  monthly_rate numeric,
  rating numeric,
  review_count bigint,
  subjects text[],
  grade_band text,
  online boolean,
  teacher_count bigint
)
language sql
stable
set search_path = public
as $$
  select
    cp.id,
    cp.name,
    cp.location,
    pr.hourly_rate,
    pr.monthly_rate,
    coalesce(rv.rating, 0),
    coalesce(rv.review_count, 0),
    coalesce(sj.subjects, array[]::text[]),
    sj.top_grade_band,
    coalesce(bt.has_online, false),
    coalesce(tc.teacher_count, 0)
  from class_profiles cp
  left join prices pr on pr.owner_type = 'class' and pr.owner_id = cp.id
  left join lateral (
    select avg(r.rating)::numeric(3, 2) as rating, count(*) as review_count
    from reviews r
    where r.target_type = 'class' and r.target_id = cp.id
  ) rv on true
  left join lateral (
    select
      array_agg(distinct s.translations ->> 'en') filter (where s.translations ->> 'en' is not null) as subjects,
      mode() within group (order by s.grade_band) as top_grade_band
    from subject_links sl
    join subjects s on s.id = sl.subject_id
    where sl.owner_type = 'class' and sl.owner_id = cp.id
  ) sj on true
  left join lateral (
    select bool_or(b.mode = 'online') as has_online
    from batches b
    where b.owner_type = 'class' and b.owner_id = cp.id
  ) bt on true
  left join lateral (
    select count(*) as teacher_count
    from class_teachers ct
    where ct.class_id = cp.id and ct.is_visible
  ) tc on true
  where cp.status = 'approved' and cp.owner_published;
$$;
