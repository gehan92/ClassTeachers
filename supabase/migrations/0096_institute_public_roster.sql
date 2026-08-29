-- Institute Blueprint, step 4a: the institute public page shows a teacher
-- COUNT today, nothing browsable — a prospective student has to take
-- "3 teachers" on faith with no way to see who, what they teach, or their
-- rating before joining. This adds the roster query; the page itself is an
-- app-layer change alongside this file.

-- Bug found while touching this: list_public_classes()' teacher_count
-- counted every is_visible class_teachers row regardless of status — an
-- institute that had merely SENT an invite (0091), not yet accepted, was
-- already being counted publicly as one of its teachers.
drop function if exists public.list_public_classes();
create function public.list_public_classes()
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
  grade_bands text[],
  online boolean,
  teacher_count bigint,
  institution_verified boolean
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
    coalesce(sj.grade_bands, array[]::text[]),
    coalesce(bt.has_online, false),
    coalesce(tc.teacher_count, 0),
    cp.institution_verified
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
      mode() within group (order by s.grade_band) as top_grade_band,
      array_agg(distinct s.grade_band) filter (where s.grade_band is not null) as grade_bands
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
    where ct.class_id = cp.id and ct.is_visible and ct.status = 'accepted'
  ) tc on true
  where cp.status = 'approved' and cp.owner_published;
$$;

grant execute on function public.list_public_classes() to anon, authenticated;

-- The actual roster for /class/[id]. Masked names, same identity-privacy
-- rule as list_teacher_ads/get_public_ad (0040) — a prospective student
-- sees enough to judge fit (subject, rate, rating) without a full name
-- until they've actually joined. Only approved, accepted, visible teachers
-- — a pending invite or an owner-hidden ("on leave") one stays off the
-- public page, same status/visibility gate as the count above.
create or replace function public.list_institute_teachers(p_class_id uuid)
returns table (
  teacher_id uuid,
  display_name text,
  photo_url text,
  headline text,
  subjects text[],
  hourly_rate numeric,
  monthly_rate numeric,
  rating numeric,
  review_count bigint,
  is_campus_lecturer boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    tp.id,
    mask_display_name(p.full_name),
    tp.photo_url,
    tp.headline,
    coalesce(sj.subjects, array[]::text[]),
    pr.hourly_rate,
    pr.monthly_rate,
    coalesce(rv.rating, 0),
    coalesce(rv.review_count, 0),
    tp.institution is not null
  from class_teachers ct
  join teacher_profiles tp on tp.id = ct.teacher_id
  join profiles p on p.id = tp.id
  left join prices pr on pr.owner_type = 'teacher' and pr.owner_id = tp.id
  left join lateral (
    select array_agg(distinct s.translations ->> 'en') filter (where s.translations ->> 'en' is not null) as subjects
    from subject_links sl
    join subjects s on s.id = sl.subject_id
    where sl.owner_type = 'teacher' and sl.owner_id = tp.id
  ) sj on true
  left join lateral (
    select avg(r.rating)::numeric(3, 2) as rating, count(*) as review_count
    from reviews r
    where r.target_type = 'teacher' and r.target_id = tp.id
  ) rv on true
  where ct.class_id = p_class_id
    and ct.is_visible
    and ct.status = 'accepted'
    and tp.status = 'approved'
  order by ct.joined_at asc;
$$;

grant execute on function public.list_institute_teachers(uuid) to anon, authenticated;
