-- Open-enrollment classes: "some teachers/lecturers start elder classes,
-- anyone can come and participate" — a batch a teacher or institute marks
-- open lets any student join instantly, no accept/decline step, unlike
-- every other batch which stays request+approval gated (0097). Capacity is
-- optional; null means unlimited.

alter table batches add column is_open_enrollment boolean not null default false;
alter table batches add column capacity integer check (capacity is null or capacity > 0);

-- Bypasses the enrollments insert policy's status='pending' check (0097) the
-- same way rejoin_after_decline/request_to_join_class bypass it for their
-- own narrow purpose — the only way any client-side path can ever write an
-- 'accepted' row directly, gated here on is_open_enrollment=true and, when
-- set, capacity. Mirrors rejoin_after_decline's owner-type branching (0092):
-- a teacher relationship is one row overwritten in place, an institute join
-- is scoped per batch.
create or replace function public.join_open_batch(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b_owner_type text;
  b_owner_id uuid;
  b_is_open boolean;
  b_capacity integer;
  b_title text;
  existing_id uuid;
  existing_status text;
  accepted_count integer;
  v_recipient uuid;
  v_student_name text;
begin
  select owner_type, owner_id, is_open_enrollment, capacity, title
  into b_owner_type, b_owner_id, b_is_open, b_capacity, b_title
  from batches where id = p_batch_id;

  if not found then
    raise exception 'class_not_found';
  end if;
  if not b_is_open then
    raise exception 'not_open_enrollment';
  end if;

  if b_owner_type = 'class' then
    select id, status into existing_id, existing_status
    from enrollments
    where student_id = auth.uid() and owner_type = 'class' and owner_id = b_owner_id and batch_id = p_batch_id;
  else
    select id, status into existing_id, existing_status
    from enrollments
    where student_id = auth.uid() and owner_type = 'teacher' and owner_id = b_owner_id;
  end if;

  -- Already in this exact class — idempotent no-op rather than an error, so
  -- a "Join now" button clicked twice (or reloaded mid-flight) never surfaces
  -- a confusing failure.
  if existing_id is not null and existing_status = 'accepted' then
    return;
  end if;

  if b_capacity is not null then
    select count(*) into accepted_count
    from enrollments
    where owner_type = b_owner_type and owner_id = b_owner_id and batch_id = p_batch_id and status = 'accepted';
    if accepted_count >= b_capacity then
      raise exception 'batch_full';
    end if;
  end if;

  if existing_id is null then
    insert into enrollments (student_id, owner_type, owner_id, batch_id, status)
    values (auth.uid(), b_owner_type, b_owner_id, p_batch_id, 'accepted');
  else
    update enrollments
    set batch_id = p_batch_id, status = 'accepted', joined_at = now()
    where id = existing_id;
  end if;

  if b_owner_type = 'class' then
    select owner_id into v_recipient from class_profiles where id = b_owner_id;
  else
    v_recipient := b_owner_id;
  end if;
  select full_name into v_student_name from profiles where id = auth.uid();
  perform create_notification(
    v_recipient,
    'open_batch_joined',
    jsonb_build_object('studentName', coalesce(v_student_name, '—'), 'batchTitle', b_title),
    'students'
  );
end;
$$;

grant execute on function public.join_open_batch(uuid) to authenticated;

-- Ad-detail pages (get_public_ad/get_public_class_ad, latest signatures from
-- 0087/0103) need a batch's open-enrollment state + spots taken, to render
-- an instant "Join now" button with a spots-left count instead of the
-- request form.
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

drop function if exists public.get_public_class_ad(uuid);
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
  spots_taken bigint
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
    coalesce(sp.taken, 0)
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
