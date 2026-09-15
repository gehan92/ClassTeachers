-- Fixes a real discoverability gap found while auditing the institute
-- mockup: Lesson Ads (0138) and Teacher-Wise Ads (0140) each got their own
-- working public /ad/[id] landing page, but list_teacher_ads()/
-- list_class_batch_ads() -- the two functions that feed the actual public
-- search/homepage listings -- only ever `join batches b on b.id = a.batch_id`.
-- A lesson_id-based or featured_teacher_id-based ad has no batch_id, so it
-- silently never matched that join: the ad existed and worked if you already
-- had the direct link, but nobody browsing the site could ever find it.
--
-- Both functions are widened into a UNION ALL of the existing batch-based
-- branch (untouched) plus a new branch for the ad shape that was missing.
-- Neither new branch has a price -- a single lesson and a "meet this teacher"
-- ad were never rate-bearing concepts -- so the new `is_lesson`/
-- `is_teacher_wise` flags let the frontend skip the "no price = not ready to
-- compare, leave it out of search" rule (see public-directory.ts) that
-- rate-bearing ad types still get.

drop function if exists public.list_teacher_ads();
drop function if exists public.list_class_batch_ads();

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
  lesson_duration_minutes integer
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
    lesson_scheduled_at, lesson_duration_minutes
  from combined
  order by created_at desc;
$$;

grant execute on function public.list_teacher_ads() to anon, authenticated;

create function public.list_class_batch_ads()
returns table (
  ad_id uuid,
  class_id uuid,
  batch_id uuid,
  name text,
  photo_url text,
  ad_title text,
  ad_content text,
  subject text,
  grade_band text,
  location text,
  mode text,
  batch_title text,
  hourly_rate numeric,
  monthly_rate numeric,
  rating numeric,
  review_count bigint,
  institution_verified boolean,
  course_code text,
  total_sessions integer,
  is_teacher_wise boolean,
  featured_teacher_headline text
)
language sql
stable
security definer
set search_path = public
as $$
  with combined as (
    select
      a.id as ad_id,
      cp.id as class_id,
      b.id as batch_id,
      cp.name,
      cp.photo_url,
      a.title as ad_title,
      a.content as ad_content,
      s.translations ->> 'en' as subject,
      b.grade_band,
      b.location,
      b.mode,
      b.title as batch_title,
      coalesce(b.hourly_rate, pr.hourly_rate) as hourly_rate,
      coalesce(b.monthly_rate, pr.monthly_rate) as monthly_rate,
      coalesce(rv.rating, 0) as rating,
      coalesce(rv.review_count, 0) as review_count,
      cp.institution_verified,
      b.course_code,
      b.total_sessions,
      false as is_teacher_wise,
      null::text as featured_teacher_headline,
      a.created_at
    from advertisements a
    join batches b on b.id = a.batch_id
    join class_profiles cp on cp.id = a.owner_id
    left join subjects s on s.id = a.subject_id
    left join prices pr on pr.owner_type = 'class' and pr.owner_id = cp.id
    left join lateral (
      select avg(r.rating)::numeric(3, 2) as rating, count(*) as review_count
      from reviews r
      where r.target_type = 'class' and r.target_id = cp.id
    ) rv on true
    where a.owner_type = 'class'
      and a.placement = 'search_results'
      and a.status = 'active'
      and (a.expires_at is null or a.expires_at > now())
      and cp.status = 'approved'
      and cp.owner_published

    union all

    select
      a.id,
      cp.id,
      null::uuid as batch_id,
      cp.name,
      cp.photo_url,
      a.title,
      a.content,
      (
        select s.translations ->> 'en'
        from subject_links sl
        join subjects s on s.id = sl.subject_id
        where sl.owner_type = 'teacher' and sl.owner_id = tp.id
        order by s.translations ->> 'en'
        limit 1
      ) as subject,
      null::text as grade_band,
      null::text as location,
      null::text as mode,
      null::text as batch_title,
      null::numeric as hourly_rate,
      null::numeric as monthly_rate,
      coalesce(rv.rating, 0),
      coalesce(rv.review_count, 0),
      cp.institution_verified,
      null::text as course_code,
      null::integer as total_sessions,
      true as is_teacher_wise,
      tp.headline as featured_teacher_headline,
      a.created_at
    from advertisements a
    join teacher_profiles tp on tp.id = a.featured_teacher_id
    join class_profiles cp on cp.id = a.owner_id
    left join lateral (
      select avg(r.rating)::numeric(3, 2) as rating, count(*) as review_count
      from reviews r
      where r.target_type = 'teacher' and r.target_id = tp.id
    ) rv on true
    where a.owner_type = 'class'
      and a.placement = 'search_results'
      and a.status = 'active'
      and (a.expires_at is null or a.expires_at > now())
      and cp.status = 'approved'
      and cp.owner_published
      and tp.status = 'approved'
  )
  select
    ad_id, class_id, batch_id, name, photo_url, ad_title, ad_content, subject, grade_band,
    location, mode, batch_title, hourly_rate, monthly_rate, rating, review_count,
    institution_verified, course_code, total_sessions, is_teacher_wise, featured_teacher_headline
  from combined
  order by created_at desc;
$$;

grant execute on function public.list_class_batch_ads() to anon, authenticated;
