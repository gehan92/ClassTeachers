-- Wires the public /teachers search page (src/app/[locale]/(public)/teachers)
-- to real data instead of src/lib/mock-data/listings.ts. Two different
-- access patterns:
--   - Institutes (class_profiles) are already fully public under existing
--     RLS (0005), so list_public_classes() just aggregates prices/reviews/
--     subjects/batches for them — no elevated privilege needed.
--   - Individual teachers can't be listed the same way: profiles.full_name
--     is self-only (0003) by design, so a plain join would leak a real
--     name. list_public_teachers() is SECURITY DEFINER for exactly that
--     reason (same justification as get_teacher_contact, 0004) but only
--     ever emits the name through mask_display_name() (0001) — the masking
--     helper that's existed since the first migration but had no caller
--     until now.

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
  where tp.status = 'approved';
$$;

grant execute on function public.list_public_teachers() to anon, authenticated;

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
  where cp.status = 'approved';
$$;

grant execute on function public.list_public_classes() to anon, authenticated;
