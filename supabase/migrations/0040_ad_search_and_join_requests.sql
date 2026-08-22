-- Phase 3 of the ad-driven discovery model: "Find teachers" now lists
-- active batch-scoped ads (0039) instead of every approved profile, a
-- clicked ad opens a limited-detail landing page, and joining from there
-- creates a request the teacher must accept.

-- 0039 tightened get_roster_student_info to require an accepted enrollment,
-- which also (incorrectly) hid a PENDING requester's name from the very
-- teacher/institute they're requesting to join — the owner needs to see who
-- a request is *from* to decide whether to accept it. The accepted-only
-- restriction belongs to is_enrolled() (a student's own contact-unlock,
-- unaffected by this change), not this owner-gated roster lookup — is_owner
-- is what already restricts who can call this for which student ids.
create or replace function public.get_roster_student_info(p_student_ids uuid[])
returns table (id uuid, full_name text, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.phone
  from profiles p
  where p.id = any(p_student_ids)
    and (
      auth.uid() = p.id
      or is_admin()
      or exists (
        select 1 from enrollments e
        where e.student_id = p.id
          and (
            (e.owner_type = 'teacher' and e.owner_id = auth.uid())
            or (e.owner_type = 'class' and is_owner('class', e.owner_id))
          )
      )
    );
$$;

grant execute on function public.get_roster_student_info(uuid[]) to authenticated;

-- One row per active, batch-scoped teacher ad. This is what "Find teachers"
-- lists now instead of every approved profile — list_public_teachers (0021)
-- stays as-is for other callers.
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
    pr.hourly_rate,
    pr.monthly_rate,
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

-- Single-ad detail for the page a click lands on. Same shape as
-- list_teacher_ads() plus batch_id (needed to send a join request) and the
-- schedule note (too noisy for a search card, useful once you're here).
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
    pr.hourly_rate,
    pr.monthly_rate,
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

-- Closes a real hole in 0039's approval model: the insert policy only ever
-- checked student_id = auth.uid(), never the status column, so a student
-- could insert their own enrollment with status='accepted' directly and
-- skip the owner's approval entirely — indistinguishable at the RLS layer
-- from a legitimate request. A teacher self-insert can now only ever be
-- 'pending'; 'accepted'/'declined' can only be reached via the owner's
-- UPDATE (0039). This also means the dashboard's previously-instant
-- batch-browse join becomes request-based too for teachers (see
-- requestToJoin() in batches-actions.ts).
--
-- Institute ('class') joins deliberately stay instant/accepted here —
-- there's no ad-driven discovery or an institute-side accept/decline UI
-- yet, so requiring approval there would strand students with a pending
-- request nobody can act on. Revisit this once that UI exists.
drop policy if exists "a student can enroll themself" on enrollments;
create policy "a student can request to join themself"
  on enrollments for insert
  with check (
    student_id = auth.uid()
    and (
      (owner_type = 'teacher' and status = 'pending')
      or (owner_type = 'class' and status = 'accepted')
    )
  );

-- Symmetric to the get_roster_student_info fix above: a student's own
-- "pending requests" list needs the teacher's name too (they already saw it
-- masked on the ad they requested from — this isn't new exposure, just
-- surfacing what they already agreed to request). is_enrolled() staying
-- accepted-only is what protects the *contact* details (get_teacher_contact)
-- and live-class access; this is only a name lookup, gated by "do you have
-- any relationship (pending or accepted) with this teacher at all."
create or replace function public.get_enrolled_teacher_names(p_teacher_ids uuid[])
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name
  from profiles p
  where p.id = any(p_teacher_ids)
    and (
      auth.uid() = p.id
      or is_admin()
      or exists (
        select 1 from enrollments e
        where e.student_id = auth.uid() and e.owner_type = 'teacher' and e.owner_id = p.id
      )
    );
$$;

grant execute on function public.get_enrolled_teacher_names(uuid[]) to authenticated;
