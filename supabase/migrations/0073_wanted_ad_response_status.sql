-- Gehan noticed the student side has no header-bell notification for new
-- wanted-ad responses, unlike teacher/institute which get one for inquiries
-- (0037) and for unresponded requests (0072). The header bell in
-- dashboard-shell.tsx is driven off a nav item's `count`, which for
-- inquiries comes from a real 'new'/'read' status column — wanted_ad_responses
-- (0072) had no such column yet, so there was nothing to count. This adds
-- the same 'new'/'read' shape inquiries already uses.

alter table wanted_ad_responses
  add column status text not null default 'new' check (status in ('new', 'read'));

create policy "the posting student can mark a response as read"
  on wanted_ad_responses for update
  using (
    exists (select 1 from wanted_ads wa where wa.id = wanted_ad_id and wa.student_id = auth.uid())
  )
  with check (
    exists (select 1 from wanted_ads wa where wa.id = wanted_ad_id and wa.student_id = auth.uid())
  );

create or replace function public.list_wanted_ad_responses_for_student()
returns table (
  id uuid,
  wanted_ad_id uuid,
  responder_type text,
  responder_name text,
  message text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.wanted_ad_id,
    r.responder_type,
    case when r.responder_type = 'teacher' then p.full_name else cp.name end,
    r.message,
    r.status,
    r.created_at
  from wanted_ad_responses r
  join wanted_ads wa on wa.id = r.wanted_ad_id
  left join profiles p on r.responder_type = 'teacher' and p.id = r.responder_id
  left join class_profiles cp on r.responder_type = 'class' and cp.id = r.responder_id
  where wa.student_id = auth.uid()
  order by r.created_at desc;
$$;

grant execute on function public.list_wanted_ad_responses_for_student() to authenticated;
