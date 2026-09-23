-- Audit fix (2026-09-23), three issues in list_institute_teachers() (0102),
-- the institute page's "Teachers at this institute" quick-profile popup:
--
-- 1) is_campus_lecturer was derived from `tp.institution is not null`
--    instead of the actual role column — a real campus lecturer who
--    hasn't filled in their Institution profile field yet shows as a
--    plain teacher here (no badge, subtitle falls back to headline,
--    publications hidden), inconsistent with every other place this flag
--    is computed correctly (get_public_teacher_profile, list_teacher_ads,
--    0100's get_linked_teacher_names).
-- 2) institution_verified was never selected at all, so this popup could
--    never show the admin-verified badge every other public teacher
--    surface shows.
-- 3) display_name masked unconditionally, missing 0108's login-gated
--    reveal (same gap just fixed in get_public_teacher_profile, 0159).
drop function if exists public.list_institute_teachers(uuid);

create function public.list_institute_teachers(p_class_id uuid)
returns table (
  teacher_id uuid,
  display_name text,
  photo_url text,
  headline text,
  bio text,
  subjects text[],
  hourly_rate numeric,
  monthly_rate numeric,
  rating numeric,
  review_count bigint,
  is_campus_lecturer boolean,
  qualifications text[],
  work_experience text[],
  experience_years integer,
  languages text[],
  academic_title text,
  institution text,
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
    case when auth.uid() is null then mask_display_name(p.full_name) else p.full_name end,
    tp.photo_url,
    tp.headline,
    tp.bio,
    coalesce(sj.subjects, array[]::text[]),
    pr.hourly_rate,
    pr.monthly_rate,
    coalesce(rv.rating, 0),
    coalesce(rv.review_count, 0),
    p.role = 'campus_lecturer',
    tp.qualifications,
    tp.work_experience,
    tp.experience_years,
    tp.languages,
    tp.academic_title,
    tp.institution,
    tp.institution_verified,
    tp.publications
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
