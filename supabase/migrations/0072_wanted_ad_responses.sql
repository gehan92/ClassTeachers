-- Closes the loop 0071 left open: a wanted_ads row was only ever visible to
-- the student who posted it. This adds the three missing pieces —
-- 1) a public, searchable listing (list_public_wanted_ads, anon-readable,
--    same shape as list_teacher_ads/0040), 2) a teacher/institute-side
--    browse feed that also shows whether *they* already responded
--    (list_wanted_ads_for_responder), and 3) storage for the responses
--    themselves plus a student-side feed of what came in
--    (list_wanted_ad_responses_for_student) — mirroring the existing
--    inquiries system (0037/0042: one message each way, no threaded chat)
--    rather than building a new messaging system from scratch.
--
-- Deliberately does NOT reveal the posting student's name anywhere public —
-- list_public_wanted_ads and list_wanted_ads_for_responder both omit it
-- entirely, unlike list_teacher_ads (which reveals a masked teacher name).
-- The student only becomes identifiable to a specific teacher/institute once
-- that teacher/institute has itself responded — the same "you have to show
-- up before you see a name" shape as 0040's pending-request visibility.

create table wanted_ad_responses (
  id uuid primary key default gen_random_uuid(),
  wanted_ad_id uuid not null references wanted_ads (id) on delete cascade,
  responder_type text not null check (responder_type in ('teacher', 'class')),
  responder_id uuid not null,
  message text not null check (length(trim(message)) > 0),
  created_at timestamptz not null default now(),
  -- One response per responder per ad — same "single reply, not a thread"
  -- shape the inquiries system already uses, enforced here at the schema
  -- level instead of just in the UI.
  unique (wanted_ad_id, responder_type, responder_id)
);

alter table wanted_ad_responses enable row level security;

create policy "the posting student, the responder, or admin can see a response"
  on wanted_ad_responses for select
  using (
    exists (select 1 from wanted_ads wa where wa.id = wanted_ad_id and wa.student_id = auth.uid())
    or (responder_type = 'teacher' and responder_id = auth.uid())
    or (responder_type = 'class' and is_owner('class', responder_id))
    or is_admin()
  );

create policy "a teacher or institute can respond to an active wanted ad"
  on wanted_ad_responses for insert
  with check (
    exists (select 1 from wanted_ads wa where wa.id = wanted_ad_id and wa.status = 'active')
    and (
      (responder_type = 'teacher' and responder_id = auth.uid())
      or (responder_type = 'class' and is_owner('class', responder_id))
    )
  );

create or replace function public.list_public_wanted_ads()
returns table (
  id uuid,
  looking_for text,
  subject text,
  mode text,
  grade_level text,
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
    wa.title,
    wa.description,
    wa.created_at
  from wanted_ads wa
  left join subjects s on s.id = wa.subject_id
  where wa.status = 'active'
  order by wa.created_at desc;
$$;

grant execute on function public.list_public_wanted_ads() to anon, authenticated;

-- Same rows as above, plus my_response — null until the calling
-- teacher/institute has responded, at which point it's their own message
-- (never someone else's). Lets the dashboard tab show a "Respond" button
-- or the reply already sent, exactly like inquiries-tab.tsx does.
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
  order by wa.created_at desc;
$$;

grant execute on function public.list_wanted_ads_for_responder() to authenticated;

create or replace function public.list_wanted_ad_responses_for_student()
returns table (
  id uuid,
  wanted_ad_id uuid,
  responder_type text,
  responder_name text,
  message text,
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
    r.created_at
  from wanted_ad_responses r
  join wanted_ads wa on wa.id = r.wanted_ad_id
  left join profiles p on r.responder_type = 'teacher' and p.id = r.responder_id
  left join class_profiles cp on r.responder_type = 'class' and cp.id = r.responder_id
  where wa.student_id = auth.uid()
  order by r.created_at desc;
$$;

grant execute on function public.list_wanted_ad_responses_for_student() to authenticated;
