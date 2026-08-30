-- Institute's public "Teachers at this institute" panel currently links
-- straight to each teacher's full public profile (/teacher/[id]) — their
-- entire independent practice, including personal batches, pricing, and
-- the join/contact flow. Gehan asked for a lighter "quick profile" popup
-- instead: credentials only (bio, qualifications, experience), nothing
-- about that teacher's own private class/business details. 0096's
-- list_institute_teachers() never selected any of that — extending its
-- RETURNS TABLE means drop-then-recreate, same pattern as every prior
-- column addition in this project.
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
    tp.photo_url,
    tp.headline,
    tp.bio,
    coalesce(sj.subjects, array[]::text[]),
    pr.hourly_rate,
    pr.monthly_rate,
    coalesce(rv.rating, 0),
    coalesce(rv.review_count, 0),
    tp.institution is not null,
    tp.qualifications,
    tp.work_experience,
    tp.experience_years,
    tp.languages,
    tp.academic_title,
    tp.institution,
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
