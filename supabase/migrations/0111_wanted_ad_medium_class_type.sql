-- Two more filters on a wanted ad (0071): what language the student wants
-- to be taught in (medium of instruction), and whether they're after a
-- brand-new class or specifically a revision/repeat class. Both are plain
-- enum columns on wanted_ads, same "small fixed set, doesn't need its own
-- table" call as mode. medium defaults to 'sinhala' and class_type to 'new'
-- so existing rows (and any insert that doesn't set them) land on the most
-- common case rather than an empty/unknown state.

alter table wanted_ads add column if not exists medium text not null default 'sinhala'
  check (medium in ('english', 'sinhala', 'tamil', 'other'));
alter table wanted_ads add column if not exists class_type text not null default 'new'
  check (class_type in ('new', 'revision'));

-- Adding columns to a RETURNS TABLE function's output requires drop +
-- recreate — CREATE OR REPLACE errors on "cannot change return type of
-- existing function" whenever the OUT column list changes.

drop function if exists public.list_public_wanted_ads();
create function public.list_public_wanted_ads()
returns table (
  id uuid,
  looking_for text,
  subject text,
  mode text,
  grade_level text,
  medium text,
  class_type text,
  title text,
  description text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    wa.id,
    wa.looking_for,
    s.translations ->> 'en',
    wa.mode,
    wa.grade_level,
    wa.medium,
    wa.class_type,
    wa.title,
    wa.description,
    wa.created_at
  from wanted_ads wa
  left join subjects s on s.id = wa.subject_id
  where wa.status = 'active'
  order by wa.created_at desc;
$$;

grant execute on function public.list_public_wanted_ads() to anon, authenticated;

drop function if exists public.get_public_wanted_ad(uuid);
create function public.get_public_wanted_ad(p_id uuid)
returns table (
  id uuid,
  looking_for text,
  subject text,
  mode text,
  grade_level text,
  medium text,
  class_type text,
  title text,
  description text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    wa.id,
    wa.looking_for,
    s.translations ->> 'en',
    wa.mode,
    wa.grade_level,
    wa.medium,
    wa.class_type,
    wa.title,
    wa.description,
    wa.created_at
  from wanted_ads wa
  left join subjects s on s.id = wa.subject_id
  where wa.id = p_id and wa.status = 'active';
$$;

grant execute on function public.get_public_wanted_ad(uuid) to anon, authenticated;

drop function if exists public.list_wanted_ads_for_responder();
create function public.list_wanted_ads_for_responder()
returns table (
  id uuid,
  looking_for text,
  subject text,
  mode text,
  grade_level text,
  medium text,
  class_type text,
  title text,
  description text,
  created_at timestamptz,
  my_response text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    wa.id,
    wa.looking_for,
    s.translations ->> 'en',
    wa.mode,
    wa.grade_level,
    wa.medium,
    wa.class_type,
    wa.title,
    wa.description,
    wa.created_at,
    r.message
  from wanted_ads wa
  left join subjects s on s.id = wa.subject_id
  left join wanted_ad_responses r
    on r.wanted_ad_id = wa.id
    and (
      (r.responder_type = 'teacher' and r.responder_id = auth.uid())
      or (r.responder_type = 'class' and r.responder_id in (select id from class_profiles where owner_id = auth.uid()))
    )
  where wa.status = 'active'
  order by wa.created_at desc;
$$;

grant execute on function public.list_wanted_ads_for_responder() to authenticated;
