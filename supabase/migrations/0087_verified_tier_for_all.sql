-- Growth Plan item 2: the "Reviewed by ClassPortals" badge (0085's ListingCard
-- change) is baseline and automatic. This adds a second, stronger tier any
-- teacher or institute can opt into — the same document-upload-then-admin-
-- review pattern campus lecturers already have (0076), extended to
-- everyone instead of being campus_lecturer-only.

-- class_profiles never had a verification concept at all — teacher_profiles
-- already carries all three columns (0076).
alter table class_profiles
  add column if not exists institution_verified boolean not null default false,
  add column if not exists verification_document_path text null,
  add column if not exists verification_submitted_at timestamptz null;

-- 0081's prevent_self_verification_change() has the exact same bug 0086 just
-- fixed on listing status: it blocks EVERY non-admin change to
-- institution_verified, including the one legitimate self-directed change
-- that already existed — uploadVerificationDocument (verification-actions.ts)
-- resets institution_verified back to false on every re-upload, since the
-- previous approval was for whatever document used to be at that path. Once
-- 0081 is live that reset itself would be rejected. Carves out exactly that
-- one transition (verified -> not verified, by the row's own owner), same
-- shape as 0086's fix, and makes the function table-generic so it can also
-- cover class_profiles below.
create or replace function public.prevent_self_verification_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_type text := case tg_table_name when 'teacher_profiles' then 'teacher' else 'class' end;
begin
  if new.institution_verified is distinct from old.institution_verified and not is_admin() then
    if new.institution_verified = false and is_owner(owner_type, new.id) then
      return new;
    end if;
    raise exception 'Only an admin can change a verification badge.';
  end if;
  return new;
end;
$$;

drop trigger if exists class_profiles_prevent_self_verification_change on class_profiles;
create trigger class_profiles_prevent_self_verification_change
  before update on class_profiles
  for each row execute function prevent_self_verification_change();

-- list_public_classes()/get_public_ad() need institution_verified added to
-- their RETURNS TABLE, which CREATE OR REPLACE can't do (Postgres rejects a
-- changed column list) — same drop-then-recreate this project always uses
-- (0026, 0074, 0075, 0076).

drop function if exists public.list_public_classes();
create function public.list_public_classes()
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
  teacher_count bigint,
  institution_verified boolean
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
    coalesce(tc.teacher_count, 0),
    cp.institution_verified
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

drop function if exists public.get_public_ad(uuid);
create function public.get_public_ad(p_ad_id uuid)
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
  institution_verified boolean
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
    coalesce(rv.review_count, 0),
    p.role = 'campus_lecturer',
    b.course_code,
    tp.institution_verified
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

grant execute on function public.list_public_classes() to anon, authenticated;
grant execute on function public.get_public_ad(uuid) to anon, authenticated;
