-- Campus lecturer, round 2 (follow-up to 0075). Three gaps identified after
-- the first build shipped: (1) the admin "Verify" toggle had zero evidence
-- behind it — a badge nobody can back up is worse than no badge; (2) a
-- lecturer's real offering is a course/module, not a generic school subject,
-- so there was nowhere to say "CS301" instead of just "Computer Science";
-- (3) "Course" terminology only reached the tab heading (0075), the batch
-- editor and student enrollment flow underneath still said "class" — this
-- migration carries it through both.

alter table teacher_profiles
  add column if not exists verification_document_path text null,
  add column if not exists verification_submitted_at timestamptz null;

alter table batches
  add column if not exists course_code text null;

-- Private bucket, same owner-or-admin shape as the assignments bucket
-- (0048) — a staff ID or appointment letter is exactly the kind of file
-- that must never be publicly listable, unlike avatars/notes.
insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

drop policy if exists "verification document owner or admin access" on storage.objects;
create policy "verification document owner or admin access"
  on storage.objects for all
  using (
    bucket_id = 'verification-docs'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  )
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Both RPCs need course_code added to their RETURNS TABLE, which
-- CREATE OR REPLACE can't do (Postgres rejects a changed column list) —
-- same drop-then-recreate this project has used every time before (0026,
-- 0074, 0075).
drop function if exists public.list_teacher_ads();
create function public.list_teacher_ads()
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
  review_count bigint,
  is_campus_lecturer boolean,
  institution text,
  academic_title text,
  institution_verified boolean,
  course_code text
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
    coalesce(rv.review_count, 0),
    p.role = 'campus_lecturer',
    tp.institution,
    tp.academic_title,
    tp.institution_verified,
    b.course_code
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
  course_code text
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
    b.course_code
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

-- Student dashboard's "My Classes"/"Browse" tabs need to know which teacher
-- rows are campus lecturers to swap the Class/Course wording per-row (a
-- student can have both a regular teacher and a campus lecturer at once, so
-- this can't be a page-level decision) — same drop/recreate reasoning as
-- above, appending is_campus_lecturer to the RETURNS TABLE.
drop function if exists public.get_enrolled_teacher_names(uuid[]);
create function public.get_enrolled_teacher_names(p_teacher_ids uuid[])
returns table (id uuid, full_name text, is_campus_lecturer boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.role = 'campus_lecturer'
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
