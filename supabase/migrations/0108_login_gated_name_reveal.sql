-- Teacher/campus-lecturer names on ad cards and the ad detail page were
-- masked unconditionally (mask_display_name(), 0001) regardless of who was
-- looking -- guest or already-logged-in member alike only ever saw
-- "N*** R***". Institute/class names were never masked to begin with, so
-- this was an inconsistency, not a deliberate rule. Gate the reveal on the
-- viewer's own login state instead: a signed-in visitor (any role) now sees
-- the real name, a guest still sees the masked form -- the same "log in to
-- see it" shape already used for contact details elsewhere. Column lists
-- are unchanged, so create-or-replace is enough here (no drop needed).

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
  course_code text
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
    b.course_code
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
  spots_taken bigint
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
    coalesce(sp.taken, 0)
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
