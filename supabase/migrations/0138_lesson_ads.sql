-- "Lesson/Grade-wise Ad" (Gehan's mockup, section 2.2) — the other half of
-- that gap. The "grade-wise, separate from a full class listing" half was
-- already covered by createIndividualAd (0120: a flexible ad with an
-- optional grade_band and no fixed schedule). What was still missing is the
-- "specific lesson" half: promoting one already-scheduled live class as a
-- one-off trial/drop-in, distinct from an ongoing Class Ad's recurring
-- batch. Reuses the existing advertisements table (same as every other ad
-- type) rather than a new one — a lesson ad is a search_results ad like any
-- other, just pointed at a live_classes row instead of a batches row.
alter table advertisements add column if not exists lesson_id uuid references live_classes (id) on delete cascade;

alter table advertisements drop constraint if exists advertisements_batch_or_lesson_check;
alter table advertisements add constraint advertisements_batch_or_lesson_check
  check (not (batch_id is not null and lesson_id is not null));

-- Public landing page counterpart to get_public_ad (0040/.../0120) — same
-- shape philosophy and the same rating/approval/expiry checks, joined to
-- live_classes instead of batches. No enrollment concepts here (open-
-- enrollment/capacity/spots) since a single lesson isn't something you
-- enroll in — a visitor expresses interest via a plain inquiry to the
-- teacher instead (JoinRequestBox's own AnonymousRequestForm already works
-- this way with no batch_id, see submitInquiry).
create function public.get_public_lesson_ad(p_ad_id uuid)
returns table (
  ad_id uuid,
  teacher_id uuid,
  display_name text,
  photo_url text,
  ad_title text,
  ad_content text,
  subject text,
  lesson_title text,
  scheduled_at timestamptz,
  duration_minutes integer,
  mode text,
  location text,
  rating numeric,
  review_count bigint,
  is_campus_lecturer boolean,
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
    case when auth.uid() is null then mask_display_name(p.full_name) else p.full_name end,
    tp.photo_url,
    a.title,
    a.content,
    s.translations ->> 'en',
    lc.title,
    lc.scheduled_at,
    lc.duration_minutes,
    lc.mode,
    lc.location,
    coalesce(rv.rating, 0),
    coalesce(rv.review_count, 0),
    p.role = 'campus_lecturer',
    tp.institution_verified
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
  where a.id = p_ad_id
    and a.owner_type = 'teacher'
    and a.placement = 'search_results'
    and a.status = 'active'
    and (a.expires_at is null or a.expires_at > now())
    and tp.status = 'approved';
$$;

grant execute on function public.get_public_lesson_ad(uuid) to anon, authenticated;
