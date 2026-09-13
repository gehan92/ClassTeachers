-- Structured wanted-ad format, part 1: a budget range. Purely informational
-- (what the student is willing to pay) — not a payment/billing field, no
-- gateway involved, same "kept unpriced for now" boundary 0071 already
-- drew for any real transaction. Both ends optional/independent so a
-- student can give just a ceiling ("up to Rs. 3000") or a full range.

alter table wanted_ads add column if not exists budget_min numeric(10, 2) check (budget_min is null or budget_min >= 0);
alter table wanted_ads add column if not exists budget_max numeric(10, 2) check (budget_max is null or budget_max >= 0);

-- RETURNS TABLE column changes need drop + recreate (same rule 0111/0116
-- already followed for these same 3 functions).

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
  budget_min numeric,
  budget_max numeric,
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
    wa.budget_min,
    wa.budget_max,
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
  budget_min numeric,
  budget_max numeric,
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
    wa.budget_min,
    wa.budget_max,
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
  budget_min numeric,
  budget_max numeric,
  created_at timestamptz,
  my_response text,
  my_response_status text
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
    wa.budget_min,
    wa.budget_max,
    wa.created_at,
    r.message,
    r.status
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
