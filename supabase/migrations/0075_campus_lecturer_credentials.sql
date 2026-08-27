-- Campus lecturers already collect institution/academic_title at signup
-- (0001-era teacher_profiles columns, filled by lecturer-fields.tsx) but
-- nothing in the UI ever reads them back — Gehan flagged this after asking
-- to review what actually exists for the "campus professional" role vs a
-- regular teacher. This closes that gap and adds the two pieces needed for
-- a genuinely distinct, credible campus-lecturer identity: an admin-
-- verified badge (mirrors the existing teacher_profiles.status
-- approve/reject pattern admin already uses, see resolveApproval in
-- admin-actions.ts) and a publications/research list (same text[] shape as
-- qualifications/work_experience/languages).
--
-- institution_verified is intentionally never written by the teacher's own
-- updateTeacherProfile action — RLS still technically allows a self-update
-- (0004/0005: "auth.uid() = id or is_admin()"), same as `status` already
-- does, so this is enforced at the app layer (only admin-actions.ts writes
-- it), not a schema-level lock.

alter table teacher_profiles
  add column if not exists institution_verified boolean not null default false,
  add column if not exists publications text[] null;

-- Both RPCs' return shape gained columns, which CREATE OR REPLACE can't do
-- for a `returns table` function — has to be dropped first (same as 0042/
-- 0043).
--
-- While rewriting get_public_teacher_profile: found it never actually
-- selected tp.work_experience even though /teacher/[id]'s loadTeacherProfile
-- reads `teacher.work_experience` from this exact RPC's result — every
-- public profile has been showing an empty Work experience section
-- regardless of what the teacher entered, silently, since work_experience
-- was added (0038). Fixed in the same drop/recreate below rather than a
-- separate migration, since it's the identical function being touched.

drop function if exists public.get_public_teacher_profile(uuid);

create function public.get_public_teacher_profile(p_teacher_id uuid)
returns table (
  id uuid,
  display_name text,
  headline text,
  bio text,
  location text,
  class_type text,
  experience_years integer,
  qualifications text[],
  work_experience text[],
  photo_url text,
  hourly_rate numeric,
  monthly_rate numeric,
  rating numeric,
  review_count bigint,
  notes_count bigint,
  subjects text[],
  grade_band text,
  contact_mode text,
  languages text[],
  is_campus_lecturer boolean,
  institution text,
  academic_title text,
  institution_verified boolean,
  publications text[]
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
    tp.work_experience,
    tp.photo_url,
    pr.hourly_rate,
    pr.monthly_rate,
    coalesce(rv.rating, 0),
    coalesce(rv.review_count, 0),
    coalesce(nt.notes_count, 0),
    coalesce(sj.subjects, array[]::text[]),
    sj.top_grade_band,
    coalesce(tp.contact_mode, 'phone'),
    tp.languages,
    p.role = 'campus_lecturer',
    tp.institution,
    tp.academic_title,
    tp.institution_verified,
    tp.publications
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
  where tp.id = p_teacher_id and tp.status = 'approved';
$$;

grant execute on function public.get_public_teacher_profile(uuid) to anon, authenticated;

drop function if exists public.list_teacher_ads();

create function public.list_teacher_ads()
returns table (
  ad_id uuid,
  teacher_id uuid,
  display_name text,
  photo_url text,
  ad_title text,
  ad_content text,
  subject text,
  grade_band text,
  location text,
  mode text,
  hourly_rate numeric,
  monthly_rate numeric,
  rating numeric,
  review_count bigint,
  is_campus_lecturer boolean,
  institution text,
  academic_title text,
  institution_verified boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    tp.id,
    mask_display_name(p.full_name),
    tp.photo_url,
    a.title,
    a.content,
    s.translations ->> 'en',
    b.grade_band,
    b.location,
    b.mode,
    coalesce(b.hourly_rate, pr.hourly_rate),
    coalesce(b.monthly_rate, pr.monthly_rate),
    coalesce(rv.rating, 0),
    coalesce(rv.review_count, 0),
    p.role = 'campus_lecturer',
    tp.institution,
    tp.academic_title,
    tp.institution_verified
  from advertisements a
  join batches b on b.id = a.batch_id
  join teacher_profiles tp on tp.id = a.owner_id
  join profiles p on p.id = tp.id
  left join subjects s on s.id = a.subject_id
  left join prices pr on pr.owner_type = 'teacher' and pr.owner_id = tp.id
  left join lateral (
    select avg(r.rating)::numeric(3, 2) as rating, count(*) as review_count
    from reviews r
    where r.target_type = 'teacher' and r.target_id = tp.id
  ) rv on true
  where a.owner_type = 'teacher'
    and a.placement = 'search_results'
    and a.status = 'active'
    and (a.expires_at is null or a.expires_at > now())
    and tp.status = 'approved'
  order by a.created_at desc;
$$;

grant execute on function public.list_teacher_ads() to anon, authenticated;
