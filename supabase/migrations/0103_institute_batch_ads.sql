-- Institute class-wise ads + general "Join this institute" apply.
--
-- Teachers have had ads-only, batch-scoped search discovery since 0039-0041/
-- 0076 (list_teacher_ads/get_public_ad): a teacher's ad is what shows up in
-- search, and applying goes straight to that one batch. Institutes never got
-- the equivalent — advertisements.batch_id/subject_id were added generically
-- back in 0039 (nothing in the schema restricts them to owner_type='teacher'),
-- but no RPC or UI ever used them for owner_type='class'.
--
-- This is additive, not a replacement: list_public_classes() (0096) keeps
-- powering the always-visible whole-institute card in search regardless of
-- whether an institute has any ads — these new class-batch ads just add
-- extra, more specific cards alongside it, mirroring what a teacher ad card
-- looks like.
--
-- request_to_join_class() covers the other half of "institute-wide ad": a
-- student can already request to join one specific batch (requestToJoin ->
-- rejoin_after_decline, batch-scoped since 0092/0097), but there was no way
-- to send a general "join this institute" request with no batch chosen yet
-- — the schema already supports it (enrollments.batch_id nullable, the
-- partial unique index from 0092 already coalesces the null case), only the
-- RPC to create one pending was missing.

create or replace function public.list_class_batch_ads()
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
  institution_verified boolean
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
    cp.institution_verified
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
    -- Same admin-approval + owner-publish gate list_public_classes() (0096)
    -- already applies to the whole-institute card — a batch ad must never
    -- be discoverable while the institute itself isn't live yet.
    and cp.status = 'approved'
    and cp.owner_published
  order by a.created_at desc;
$$;

grant execute on function public.list_class_batch_ads() to anon, authenticated;

create or replace function public.get_public_class_ad(p_ad_id uuid)
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
  institution_verified boolean
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
    cp.institution_verified
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
  where a.id = p_ad_id
    and a.owner_type = 'class'
    and a.placement = 'search_results'
    and a.status = 'active'
    and (a.expires_at is null or a.expires_at > now())
    and cp.status = 'approved'
    and cp.owner_published;
$$;

grant execute on function public.get_public_class_ad(uuid) to anon, authenticated;

-- Mirrors rejoin_after_decline's upsert-safety (0097): a fresh general join
-- inserts pending; a previously-declined general join re-sends as pending
-- instead of hitting the (student_id, owner_id, coalesce(batch_id, ...))
-- unique index from 0092. Always batch_id is null — a batch-specific
-- request already goes through requestToJoin/rejoin_after_decline instead.
create or replace function public.request_to_join_class(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  existing_status text;
begin
  if not exists (select 1 from class_profiles where id = p_class_id) then
    raise exception 'class_not_found';
  end if;

  select id, status into existing_id, existing_status
  from enrollments
  where student_id = auth.uid() and owner_type = 'class' and owner_id = p_class_id and batch_id is null;

  if existing_id is null then
    insert into enrollments (student_id, owner_type, owner_id, batch_id, status)
    values (auth.uid(), 'class', p_class_id, null, 'pending');
    return;
  end if;

  if existing_status <> 'declined' then
    raise exception 'already_requested';
  end if;

  update enrollments
  set status = 'pending', joined_at = now()
  where id = existing_id;
end;
$$;

grant execute on function public.request_to_join_class(uuid) to authenticated;
