-- Institute Supply-Side gap fixes (Gehan's mockup, section 2.4), part 1 of 2.
-- Three of the seven rows fixed here; Vacancy Ad is 0141 (its own tables).

-- ---------------------------------------------------------------------
-- 1) Course-Wise Ad: total_sessions/course_code (0139, teacher-only so far)
-- now surfaced for institute batches too -- same "a batch with sessions set
-- reads as a course" reasoning, no new entity. Widen the two institute ad
-- RPCs to return them (drop first: adding a column changes the return row
-- type, which create-or-replace refuses).
-- ---------------------------------------------------------------------

drop function if exists public.list_class_batch_ads();
drop function if exists public.get_public_class_ad(uuid);

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
  total_sessions integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    cp.id,
    b.id,
    cp.name,
    cp.photo_url,
    a.title,
    a.content,
    s.translations ->> 'en',
    b.grade_band,
    b.location,
    b.mode,
    b.title,
    coalesce(b.hourly_rate, pr.hourly_rate),
    coalesce(b.monthly_rate, pr.monthly_rate),
    coalesce(rv.rating, 0),
    coalesce(rv.review_count, 0),
    cp.institution_verified,
    b.course_code,
    b.total_sessions
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
  order by a.created_at desc;
$$;

grant execute on function public.list_class_batch_ads() to anon, authenticated;

create function public.get_public_class_ad(p_ad_id uuid)
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
  schedule_note text,
  batch_title text,
  hourly_rate numeric,
  monthly_rate numeric,
  rating numeric,
  review_count bigint,
  institution_verified boolean,
  is_open_enrollment boolean,
  capacity integer,
  spots_taken bigint,
  course_code text,
  total_sessions integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    cp.id,
    b.id,
    cp.name,
    cp.photo_url,
    a.title,
    a.content,
    s.translations ->> 'en',
    b.grade_band,
    b.location,
    b.mode,
    b.schedule_note,
    b.title,
    coalesce(b.hourly_rate, pr.hourly_rate),
    coalesce(b.monthly_rate, pr.monthly_rate),
    coalesce(rv.rating, 0),
    coalesce(rv.review_count, 0),
    cp.institution_verified,
    b.is_open_enrollment,
    b.capacity,
    coalesce(sp.taken, 0),
    b.course_code,
    b.total_sessions
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
  left join lateral (
    select count(*) as taken from enrollments e where e.batch_id = b.id and e.status = 'accepted'
  ) sp on true
  where a.id = p_ad_id
    and a.owner_type = 'class'
    and a.placement = 'search_results'
    and a.status = 'active'
    and (a.expires_at is null or a.expires_at > now())
    and cp.status = 'approved'
    and cp.owner_published;
$$;

grant execute on function public.get_public_class_ad(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) Teacher-Wise Ad: "Promotes a specific staff member under the
-- institute's name" -- a genuinely new ad shape (about a person, not a
-- batch), so it gets its own nullable FK on advertisements, same pattern as
-- lesson_id (0138): mutually exclusive with the existing batch_id/lesson_id,
-- since a teacher-wise ad has no fixed class or lesson of its own.
-- ---------------------------------------------------------------------

alter table advertisements add column if not exists featured_teacher_id uuid references teacher_profiles (id) on delete cascade;

alter table advertisements drop constraint if exists advertisements_batch_or_lesson_check;
alter table advertisements drop constraint if exists advertisements_ad_target_check;
alter table advertisements add constraint advertisements_ad_target_check
  check (
    (case when batch_id is not null then 1 else 0 end
      + case when lesson_id is not null then 1 else 0 end
      + case when featured_teacher_id is not null then 1 else 0 end) <= 1
  );

-- Public landing page counterpart, same shape philosophy as get_public_ad/
-- get_public_lesson_ad -- the institute is the ad's owner/brand (name/photo/
-- verified, unmasked like every other institute-owned ad), the featured
-- teacher's own identity is masked pre-login exactly like it is everywhere
-- else a teacher's name appears (get_public_ad, get_public_teacher_profile).
create function public.get_public_teacher_wise_ad(p_ad_id uuid)
returns table (
  ad_id uuid,
  institute_id uuid,
  institute_name text,
  institute_photo_url text,
  institution_verified boolean,
  teacher_id uuid,
  display_name text,
  photo_url text,
  headline text,
  subjects text[],
  experience_years integer,
  rating numeric,
  review_count bigint,
  ad_title text,
  ad_content text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    cp.id,
    cp.name,
    cp.photo_url,
    cp.institution_verified,
    tp.id,
    case when auth.uid() is null then mask_display_name(p.full_name) else p.full_name end,
    tp.photo_url,
    tp.headline,
    coalesce(sj.subjects, array[]::text[]),
    tp.experience_years,
    coalesce(rv.rating, 0),
    coalesce(rv.review_count, 0),
    a.title,
    a.content
  from advertisements a
  join class_profiles cp on cp.id = a.owner_id
  join teacher_profiles tp on tp.id = a.featured_teacher_id
  join profiles p on p.id = tp.id
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
  where a.id = p_ad_id
    and a.owner_type = 'class'
    and a.placement = 'search_results'
    and a.status = 'active'
    and (a.expires_at is null or a.expires_at > now())
    and cp.status = 'approved'
    and cp.owner_published
    and tp.status = 'approved';
$$;

grant execute on function public.get_public_teacher_wise_ad(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) Adult/Elder Class Ad: "Targets an older audience, distinct from
-- school-grade targeting." OPEN_GRADE_VALUE (grade_band = null) already
-- exists for "no grade at all" (its own code comment names "an elders'
-- class" as the motivating example), but that reads as generic "Open", not
-- a real audience label. Widening the enum with a genuine 'adult' value
-- lets every existing grade_band <Select> (Classes, Batches, Individual/
-- Course Ad, Institute-Seeking Ad) and every grade badge/filter (search,
-- listing cards) offer and display it for free -- no new UI, just a real
-- selectable, distinct value flowing through plumbing that already exists.
-- Only the two grade_band-bearing tables actually driven by those shared
-- pickers are widened; subjects/question_bank_items have their own
-- independent, unrelated (exam-content) grade_band lists and stay untouched.
-- ---------------------------------------------------------------------

alter table batches drop constraint if exists batches_grade_band_check;
alter table batches add constraint batches_grade_band_check
  check (grade_band in ('1-5', '6-9', '10-11', '12-13', 'campus', 'adult'));

alter table teacher_seeking_ads drop constraint if exists teacher_seeking_ads_grade_band_check;
alter table teacher_seeking_ads add constraint teacher_seeking_ads_grade_band_check
  check (grade_band in ('1-5', '6-9', '10-11', '12-13', 'campus', 'adult'));
