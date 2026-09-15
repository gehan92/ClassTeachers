-- "Course Ad" (Gehan's mockup, section 2.3 Lecturer/Professor — Supply-Side):
-- "Everything available to Teachers, plus: Course Ad — promotes a full
-- course (not just a single class), reflecting that lecturers typically run
-- structured multi-session courses rather than ongoing tuition classes."
--
-- Rather than a parallel entity, a course is simply a batch with a defined
-- number of sessions instead of an open-ended schedule — total_sessions
-- being set is what distinguishes a "Course" from an ordinary "Class" batch.
-- This reuses the entire existing batch+ad machinery (Classes tab, search,
-- roster, the public /ad/[id] page, list_teacher_ads) unchanged, rather than
-- inventing a new course_id-shaped ad type the way lesson_id (0138) needed
-- to for a genuinely different concept (a single already-scheduled lesson).
-- Creation is gated to campus lecturers at the UI layer only (Advertisement
-- tab), the same convention already used for course_code (0075/0076) and
-- other lecturer-only batch fields — not a security boundary, just
-- role-appropriate framing, same as those.

alter table batches add column if not exists total_sessions integer;

alter table batches drop constraint if exists batches_total_sessions_check;
alter table batches add constraint batches_total_sessions_check
  check (total_sessions is null or total_sessions > 0);

-- Adding a column to an existing function's return table changes its row
-- type, which create-or-replace refuses -- drop first, same as every prior
-- migration that widened list_teacher_ads/get_public_ad (0119, 0120).

drop function if exists public.list_teacher_ads();
drop function if exists public.get_public_ad(uuid);

create or replace function public.list_teacher_ads()
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
  total_sessions integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    tp.id,
    case when auth.uid() is null then mask_display_name(p.full_name) else p.full_name end,
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
    tp.institution_verified,
    b.course_code,
    b.medium,
    b.class_type,
    case when b.hourly_rate is not null then b.hourly_rate_max end,
    case when b.monthly_rate is not null then b.monthly_rate_max end,
    b.total_sessions
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

create or replace function public.get_public_ad(p_ad_id uuid)
returns table (
  ad_id uuid,
  teacher_id uuid,
  batch_id uuid,
  display_name text,
  photo_url text,
  ad_title text,
  ad_content text,
  subject text,
  grade_band text,
  location text,
  mode text,
  schedule_note text,
  hourly_rate numeric,
  monthly_rate numeric,
  rating numeric,
  review_count bigint,
  is_campus_lecturer boolean,
  course_code text,
  institution_verified boolean,
  is_open_enrollment boolean,
  capacity integer,
  spots_taken bigint,
  medium text,
  class_type text,
  hourly_rate_max numeric,
  monthly_rate_max numeric,
  total_sessions integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    tp.id,
    b.id,
    case when auth.uid() is null then mask_display_name(p.full_name) else p.full_name end,
    tp.photo_url,
    a.title,
    a.content,
    s.translations ->> 'en',
    b.grade_band,
    b.location,
    b.mode,
    b.schedule_note,
    coalesce(b.hourly_rate, pr.hourly_rate),
    coalesce(b.monthly_rate, pr.monthly_rate),
    coalesce(rv.rating, 0),
    coalesce(rv.review_count, 0),
    p.role = 'campus_lecturer',
    b.course_code,
    tp.institution_verified,
    b.is_open_enrollment,
    b.capacity,
    coalesce(sp.taken, 0),
    b.medium,
    b.class_type,
    case when b.hourly_rate is not null then b.hourly_rate_max end,
    case when b.monthly_rate is not null then b.monthly_rate_max end,
    b.total_sessions
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
  left join lateral (
    select count(*) as taken from enrollments e where e.batch_id = b.id and e.status = 'accepted'
  ) sp on true
  where a.id = p_ad_id
    and a.owner_type = 'teacher'
    and a.placement = 'search_results'
    and a.status = 'active'
    and (a.expires_at is null or a.expires_at > now())
    and tp.status = 'approved';
$$;

grant execute on function public.get_public_ad(uuid) to anon, authenticated;
