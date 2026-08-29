-- Institute Blueprint, step 5: open/non-syllabus course support (a
-- "Spoken English" or "Elders class" with no grade band, joinable by
-- anyone). Mechanically this was already almost free — subjects.grade_band
-- and batches.grade_band are both nullable, and resolve_subject() (0022)
-- already creates an ad-hoc ungraded subject by typed name — but neither
-- the institute's nor the teacher's own class-builder form had a subject
-- field at all, and both forced a real grade band with no "open" choice.
-- The app-layer half of this migration (alongside it, same commit) adds
-- those fields.

-- This half: list_public_classes()' subjects/grade_band/grade_bands came
-- from subject_links (owner_type='class') — a checklist frozen at institute
-- signup, never editable afterward and never actually tied to what's really
-- being taught. A new open course (or any batch, for that matter) wouldn't
-- change what public search shows for that institute. Repointed to read
-- straight from the institute's own batches instead, which is exactly what
-- the class-builder form now lets an institute set per class. Same return
-- shape as before, so create-or-replace is enough — no policy anywhere
-- references this function, so unlike 0095 there's no drop-order risk.
create or replace function public.list_public_classes()
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
    coalesce(bj.subjects, array[]::text[]),
    bj.top_grade_band,
    coalesce(bj.grade_bands, array[]::text[]),
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
      mode() within group (order by b.grade_band) as top_grade_band,
      array_agg(distinct b.grade_band) filter (where b.grade_band is not null) as grade_bands
    from batches b
    left join subjects s on s.id = b.subject_id
    where b.owner_type = 'class' and b.owner_id = cp.id
  ) bj on true
  left join lateral (
    select bool_or(b.mode = 'online') as has_online
    from batches b
    where b.owner_type = 'class' and b.owner_id = cp.id
  ) bt on true
  left join lateral (
    select count(*) as teacher_count
    from class_teachers ct
    where ct.class_id = cp.id and ct.is_visible and ct.status = 'accepted'
  ) tc on true
  where cp.status = 'approved' and cp.owner_published;
$$;

grant execute on function public.list_public_classes() to anon, authenticated;
