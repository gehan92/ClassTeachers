-- The public /teacher/[id] page (src/app/[locale]/(public)/teacher/[id])
-- was still rendering src/lib/mock-data's fixture teacher regardless of
-- which real id was requested, since getTeacherProfile() only ever matched
-- against the mock array — real Supabase teacher ids never matched, so the
-- page 404'd for every real teacher. These two functions give it real data
-- to query instead, following list_public_teachers'/get_teacher_contact's
-- existing SECURITY DEFINER pattern (0021, 0004): profiles.full_name and
-- reviews.reviewer_id -> profiles are both self-only under normal RLS, so a
-- plain join would either leak a real name or return nothing.

create or replace function public.get_public_teacher_profile(p_teacher_id uuid)
returns table (
  id uuid,
  display_name text,
  headline text,
  bio text,
  location text,
  class_type text,
  experience_years integer,
  qualifications text[],
  photo_url text,
  hourly_rate numeric,
  monthly_rate numeric,
  rating numeric,
  review_count bigint,
  notes_count bigint,
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
    mask_display_name(p.full_name),
    tp.headline,
    tp.bio,
    tp.location,
    tp.class_type,
    tp.experience_years,
    tp.qualifications,
    tp.photo_url,
    pr.hourly_rate,
    pr.monthly_rate,
    coalesce(rv.rating, 0),
    coalesce(rv.review_count, 0),
    coalesce(nt.notes_count, 0),
    coalesce(sj.subjects, array[]::text[]),
    sj.top_grade_band
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
  where tp.id = p_teacher_id and tp.status = 'approved';
$$;

grant execute on function public.get_public_teacher_profile(uuid) to anon, authenticated;

-- Reused for both teacher and class profiles (reviews.target_type already
-- covers 'teacher' | 'class' | 'teacher_in_class') — reviews themselves are
-- public (0015), only the reviewer's real name needs masking.
create or replace function public.list_public_reviews(p_target_type text, p_target_id uuid)
returns table (
  id uuid,
  author text,
  rating smallint,
  body text,
  reply text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    mask_display_name(p.full_name),
    r.rating,
    r.comment,
    r.reply_text,
    r.created_at
  from reviews r
  join profiles p on p.id = r.reviewer_id
  where r.target_type = p_target_type and r.target_id = p_target_id
  order by r.created_at desc;
$$;

grant execute on function public.list_public_reviews(text, uuid) to anon, authenticated;
