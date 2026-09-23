-- Audit fix (2026-09-23): list_wanted_ads_for_responder() (0072) never
-- filtered on wanted_ads.looking_for ('teacher' or 'institute') — every
-- active wanted ad was returned to every responder regardless of role, so
-- a teacher saw ads where the student explicitly said "looking for an
-- institute" and vice versa on the institute dashboard (same RPC). The
-- messaging.en.json copy ("Students looking for a teacher or institute
-- like you") already implied this filtering existed. Institute-vs-teacher
-- is derived the same way the response-matching join already does it two
-- lines down: does the caller own a class_profiles row.
create or replace function public.list_wanted_ads_for_responder()
returns table (
  id uuid,
  looking_for text,
  subject text,
  mode text,
  grade_level text,
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
    and wa.looking_for = case
      when exists (select 1 from class_profiles where owner_id = auth.uid()) then 'institute'
      else 'teacher'
    end
  order by wa.created_at desc;
$$;
