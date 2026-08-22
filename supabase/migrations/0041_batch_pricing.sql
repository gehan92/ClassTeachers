-- A teacher's single profile-level rate (0016) applied to every batch/ad
-- regardless of whether it was one-on-one tutoring or a scheduled group
-- class — no way to charge differently for the two. These columns let a
-- specific batch override that default; null means "inherit the teacher's
-- profile rate", so nothing existing changes until a teacher sets one.
alter table batches add column if not exists hourly_rate numeric(10, 2);
alter table batches add column if not exists monthly_rate numeric(10, 2);

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
  review_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    tp.id,
    mask_display_name(p.full_name),
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
    coalesce(rv.review_count, 0)
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
  review_count bigint
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
    mask_display_name(p.full_name),
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
    coalesce(rv.review_count, 0)
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
  where a.id = p_ad_id
    and a.owner_type = 'teacher'
    and a.placement = 'search_results'
    and a.status = 'active'
    and (a.expires_at is null or a.expires_at > now())
    and tp.status = 'approved';
$$;

grant execute on function public.get_public_ad(uuid) to anon, authenticated;
