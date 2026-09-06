-- A student can now decide on a wanted-ad response (Accept/Decline), not
-- just read it — widens the status enum introduced in 0073 (which only
-- ever had 'new'/'read') to include a real decision. The existing
-- "the posting student can mark a response as read" UPDATE policy (0073)
-- and restrict_wanted_ad_response_update trigger (0084) already allow any
-- status value change (only message/responder_* are locked down), so no
-- policy changes are needed — just the constraint and the responder-facing
-- read model below.

alter table wanted_ad_responses drop constraint if exists wanted_ad_responses_status_check;
alter table wanted_ad_responses add constraint wanted_ad_responses_status_check
  check (status in ('new', 'read', 'accepted', 'declined'));

-- Lets a teacher/institute see whether their own response was accepted or
-- declined, not just that they sent one. A RETURNS TABLE column change
-- needs drop + recreate (same as 0111's own comment on this function).
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
