-- list_public_classes() only ever returned one "dominant" grade_band (the
-- statistical mode across the institute's subjects) — fine for the search
-- card's compact badge, but wrong for filtering: an institute usually
-- spans several grade levels across its different teachers, so filtering
-- by grade should match if the institute covers that grade AT ALL, not
-- just its single most-common one. Adds grade_bands (the full distinct
-- set) alongside the existing grade_band, which the card badge keeps
-- using unchanged.

drop function if exists public.list_public_classes();

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
  grade_bands text[],
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
    coalesce(sj.grade_bands, array[]::text[]),
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
    where ct.class_id = cp.id and ct.is_visible
  ) tc on true
  where cp.status = 'approved' and cp.owner_published;
$$;
