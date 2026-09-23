-- Audit fix (2026-09-23), two real bugs in get_public_teacher_profile
-- found while auditing the campus lecturer feature (this function serves
-- every teacher's /teacher/[id] page, lecturers included):
--
-- 1) `and tp.owner_published` was correctly added by 0036 (kept through
--    0038), but silently dropped when 0042 next redefined this function
--    for contact_mode — and every redefinition since (0043, 0075) carried
--    that regression forward. A teacher who turns their listing off from
--    Settings has stayed fully visible at their direct profile URL this
--    whole time, the exact gap 0036 was built to close.
-- 2) display_name has always called mask_display_name(p.full_name)
--    unconditionally, never gaining the `case when auth.uid() is null`
--    branch 0108 (login-gated name reveal) added to every other public
--    surface (list_teacher_ads, get_public_ad, etc.) — a logged-in viewer
--    still sees a masked name on the one page that's supposed to show it
--    in full once they're signed in.
--
-- Column list and every other field are identical to 0075's version —
-- only the WHERE clause and the display_name expression change.
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
    case when auth.uid() is null then mask_display_name(p.full_name) else p.full_name end,
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
  where tp.id = p_teacher_id and tp.status = 'approved' and tp.owner_published;
$$;

grant execute on function public.get_public_teacher_profile(uuid) to anon, authenticated;
