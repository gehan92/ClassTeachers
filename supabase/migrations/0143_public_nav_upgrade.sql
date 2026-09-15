-- Backs the site header's "Search"/"Requests" dropdown rebuild (grouped
-- BROWSE + REQUESTS structure replacing the old flat list). Three additions:
--
-- 1) "Independent tutors" needs a way to tell a teacher's own personal ad
--    apart from one posted by a teacher who's also accepted staff at an
--    institute (class_teachers, status='accepted') -- that's the only
--    existing "institute-affiliated" signal a teacher has, there's no
--    separate institute_id column on teacher_profiles to check instead.
--
-- 2) "Teacher requests" and "Institute vacancies" now need a public browse
--    view. teacher_seeking_ads (0136/0137) and vacancy_ads (0141) were both
--    deliberately built institute/teacher-dashboard-only up to now (no
--    anon grant, no public page -- see 0136's and 0141's own comments). This
--    migration reverses that scoping on purpose: both tables' RLS already
--    allows anyone to read an 'active' row (built that way from the start in
--    case a public page ever needed it), so only a new anon-granted RPC is
--    needed, mirroring list_public_wanted_ads' own shape/masking rules --
--    not the existing *_for_institutes/*_for_teachers RPCs, which carry
--    dashboard-only fields (my_response, etc.) that have no place here.

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
  institution_verified boolean,
  course_code text,
  medium text,
  class_type text,
  hourly_rate_max numeric,
  monthly_rate_max numeric,
  total_sessions integer,
  is_lesson boolean,
  lesson_title text,
  lesson_scheduled_at timestamptz,
  lesson_duration_minutes integer,
  is_independent boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with combined as (
    select
      a.id as ad_id,
      tp.id as teacher_id,
      case when auth.uid() is null then mask_display_name(p.full_name) else p.full_name end as display_name,
      tp.photo_url,
      a.title as ad_title,
      a.content as ad_content,
      s.translations ->> 'en' as subject,
      b.grade_band,
      b.location,
      b.mode,
      coalesce(b.hourly_rate, pr.hourly_rate) as hourly_rate,
      coalesce(b.monthly_rate, pr.monthly_rate) as monthly_rate,
      coalesce(rv.rating, 0) as rating,
      coalesce(rv.review_count, 0) as review_count,
      p.role = 'campus_lecturer' as is_campus_lecturer,
      tp.institution,
      tp.academic_title,
      tp.institution_verified,
      b.course_code,
      b.medium,
      b.class_type,
      case when b.hourly_rate is not null then b.hourly_rate_max end as hourly_rate_max,
      case when b.monthly_rate is not null then b.monthly_rate_max end as monthly_rate_max,
      b.total_sessions,
      false as is_lesson,
      null::text as lesson_title,
      null::timestamptz as lesson_scheduled_at,
      null::integer as lesson_duration_minutes,
      not exists (
        select 1 from class_teachers ct where ct.teacher_id = tp.id and ct.status = 'accepted'
      ) as is_independent,
      a.created_at
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

    union all

    select
      a.id,
      tp.id,
      case when auth.uid() is null then mask_display_name(p.full_name) else p.full_name end,
      tp.photo_url,
      a.title,
      a.content,
      s.translations ->> 'en',
      null::text as grade_band,
      lc.location,
      lc.mode,
      null::numeric as hourly_rate,
      null::numeric as monthly_rate,
      coalesce(rv.rating, 0),
      coalesce(rv.review_count, 0),
      p.role = 'campus_lecturer',
      tp.institution,
      tp.academic_title,
      tp.institution_verified,
      null::text as course_code,
      null::text as medium,
      null::text as class_type,
      null::numeric as hourly_rate_max,
      null::numeric as monthly_rate_max,
      null::integer as total_sessions,
      true as is_lesson,
      lc.title as lesson_title,
      lc.scheduled_at as lesson_scheduled_at,
      lc.duration_minutes as lesson_duration_minutes,
      not exists (
        select 1 from class_teachers ct where ct.teacher_id = tp.id and ct.status = 'accepted'
      ) as is_independent,
      a.created_at
    from advertisements a
    join live_classes lc on lc.id = a.lesson_id
    join teacher_profiles tp on tp.id = a.owner_id
    join profiles p on p.id = tp.id
    left join subjects s on s.id = coalesce(a.subject_id, lc.subject_id)
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
  )
  select
    ad_id, teacher_id, display_name, photo_url, ad_title, ad_content, subject, grade_band,
    location, mode, hourly_rate, monthly_rate, rating, review_count, is_campus_lecturer,
    institution, academic_title, institution_verified, course_code, medium, class_type,
    hourly_rate_max, monthly_rate_max, total_sessions, is_lesson, lesson_title,
    lesson_scheduled_at, lesson_duration_minutes, is_independent
  from combined
  order by created_at desc;
$$;

grant execute on function public.list_teacher_ads() to anon, authenticated;

create function public.list_public_teacher_seeking_ads()
returns table (
  id uuid,
  teacher_id uuid,
  display_name text,
  photo_url text,
  subject text,
  grade_band text,
  mode text,
  title text,
  content text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    tsa.id,
    tsa.teacher_id,
    case when auth.uid() is null then mask_display_name(p.full_name) else p.full_name end,
    tp.photo_url,
    s.translations ->> 'en',
    tsa.grade_band,
    tsa.mode,
    tsa.title,
    tsa.content,
    tsa.created_at
  from teacher_seeking_ads tsa
  join profiles p on p.id = tsa.teacher_id
  left join teacher_profiles tp on tp.id = tsa.teacher_id
  left join subjects s on s.id = tsa.subject_id
  where tsa.status = 'active'
  order by tsa.created_at desc;
$$;

grant execute on function public.list_public_teacher_seeking_ads() to anon, authenticated;

create function public.list_public_vacancy_ads()
returns table (
  id uuid,
  institute_id uuid,
  institute_name text,
  photo_url text,
  institution_verified boolean,
  subject text,
  mode text,
  location text,
  title text,
  content text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    cp.id,
    cp.name,
    cp.photo_url,
    cp.institution_verified,
    s.translations ->> 'en',
    v.mode,
    v.location,
    v.title,
    v.content,
    v.created_at
  from vacancy_ads v
  join class_profiles cp on cp.id = v.institute_id
  left join subjects s on s.id = v.subject_id
  where v.status = 'active'
    and cp.status = 'approved'
    and cp.owner_published
  order by v.created_at desc;
$$;

grant execute on function public.list_public_vacancy_ads() to anon, authenticated;
