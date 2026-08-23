-- Two independent additions, bundled since both came out of the same
-- "how do other platforms handle student-teacher connections" review:
--
-- 1. Contact preference (pattern #4): a teacher previously had no say in
--    whether their phone number gets shown once a student is accepted —
--    get_teacher_contact() always returned it. This adds an opt-in
--    "messaging only" mode. Default 'phone' preserves exactly today's
--    behavior for every existing teacher.
-- 2. Inquiry replies (partial #1): the "Message" contact form was one-way —
--    a teacher could read an inquiry but had no way to respond except
--    externally, off-platform, using whatever contact info the sender
--    typed in. This adds a single reply field (not full threaded chat).

alter table teacher_profiles
  add column if not exists contact_mode text not null default 'phone'
  check (contact_mode in ('phone', 'messaging_only'));

create or replace function public.get_teacher_contact(p_teacher_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when coalesce(tp.contact_mode, 'phone') = 'messaging_only'
      and auth.uid() is distinct from p_teacher_id
      and not is_admin()
    then null
    else p.phone
  end
  from profiles p
  left join teacher_profiles tp on tp.id = p.id
  where p.id = p_teacher_id
    and (
      auth.uid() = p_teacher_id
      or is_admin()
      or is_enrolled('teacher', p_teacher_id)
    );
$$;

-- Return shape gained a column (contact_mode), which create-or-replace
-- can't do for a `returns table` function — has to be dropped first.
drop function if exists public.get_public_teacher_profile(uuid);

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
  grade_band text,
  contact_mode text
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
    sj.top_grade_band,
    coalesce(tp.contact_mode, 'phone')
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

alter table inquiries add column if not exists reply text;
alter table inquiries add column if not exists replied_at timestamptz;
