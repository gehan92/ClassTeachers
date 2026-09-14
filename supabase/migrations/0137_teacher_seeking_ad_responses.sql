-- Response side of 0136, mirroring wanted_ad_responses (0072/0084/0116) --
-- an institute answers a teacher's seeking-ad, the teacher accepts/
-- declines. Simpler than wanted_ad_responses' responder_type/responder_id
-- polymorphism: only an institute ever responds here (a teacher wouldn't
-- respond to another teacher's own seeking-ad), so this just points
-- straight at class_profiles.
create table teacher_seeking_ad_responses (
  id uuid primary key default gen_random_uuid(),
  teacher_seeking_ad_id uuid not null references teacher_seeking_ads (id) on delete cascade,
  institute_id uuid not null,
  message text not null check (length(trim(message)) > 0),
  status text not null default 'new' check (status in ('new', 'read', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  -- One response per institute per ad -- same "single reply, not a thread"
  -- shape wanted_ad_responses already uses.
  unique (teacher_seeking_ad_id, institute_id)
);

alter table teacher_seeking_ad_responses enable row level security;

create policy "the posting teacher, the responding institute, or admin can see a response"
  on teacher_seeking_ad_responses for select
  using (
    exists (select 1 from teacher_seeking_ads tsa where tsa.id = teacher_seeking_ad_id and tsa.teacher_id = auth.uid())
    or is_owner('class', institute_id)
    or is_admin()
  );

create policy "an institute can respond to an active seeking ad"
  on teacher_seeking_ad_responses for insert
  with check (
    exists (select 1 from teacher_seeking_ads tsa where tsa.id = teacher_seeking_ad_id and tsa.status = 'active')
    and is_owner('class', institute_id)
  );

-- Only the posting teacher (or admin) ever updates a response -- to mark it
-- read, or to accept/decline. Locked to the status column only, same
-- reasoning as restrict_wanted_ad_response_update (0084): without this, the
-- update policy's own USING/CHECK would otherwise let the teacher rewrite
-- the institute's message text too.
create policy "the posting teacher can decide on a response"
  on teacher_seeking_ad_responses for update
  using (
    exists (select 1 from teacher_seeking_ads tsa where tsa.id = teacher_seeking_ad_id and tsa.teacher_id = auth.uid())
    or is_admin()
  )
  with check (
    exists (select 1 from teacher_seeking_ads tsa where tsa.id = teacher_seeking_ad_id and tsa.teacher_id = auth.uid())
    or is_admin()
  );

create or replace function public.restrict_teacher_seeking_ad_response_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() then
    return new;
  end if;

  if new.message is distinct from old.message
    or new.institute_id is distinct from old.institute_id
    or new.teacher_seeking_ad_id is distinct from old.teacher_seeking_ad_id
  then
    raise exception 'You can only mark a response as read or decide on it, not edit it.';
  end if;

  return new;
end;
$$;

create trigger teacher_seeking_ad_responses_restrict_update
  before update on teacher_seeking_ad_responses
  for each row execute function restrict_teacher_seeking_ad_response_update();

-- Institute-side browse feed -- authenticated only (no public/anon grant,
-- see 0136's comment: there's no existing public page for this). Shows
-- whether *this* institute already responded, same shape as
-- list_wanted_ads_for_responder (0072/0116).
create function public.list_teacher_seeking_ads_for_institutes()
returns table (
  id uuid,
  teacher_id uuid,
  display_name text,
  photo_url text,
  subject text,
  grade_band text,
  mode text,
  title text,
  content text,
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
    tsa.id,
    tsa.teacher_id,
    case when auth.uid() is null then mask_display_name(p.full_name) else p.full_name end,
    tp.photo_url,
    s.translations ->> 'en',
    tsa.grade_band,
    tsa.mode,
    tsa.title,
    tsa.content,
    tsa.created_at,
    r.message,
    r.status
  from teacher_seeking_ads tsa
  join profiles p on p.id = tsa.teacher_id
  left join teacher_profiles tp on tp.id = tsa.teacher_id
  left join subjects s on s.id = tsa.subject_id
  left join teacher_seeking_ad_responses r
    on r.teacher_seeking_ad_id = tsa.id
    and r.institute_id in (select id from class_profiles where owner_id = auth.uid())
  where tsa.status = 'active'
  order by tsa.created_at desc;
$$;

grant execute on function public.list_teacher_seeking_ads_for_institutes() to authenticated;

-- Teacher-side "what came in" feed, mirroring
-- list_wanted_ad_responses_for_student (0072/0073).
create function public.list_teacher_seeking_ad_responses_for_teacher()
returns table (
  id uuid,
  teacher_seeking_ad_id uuid,
  institute_name text,
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
    r.teacher_seeking_ad_id,
    cp.name,
    r.message,
    r.status,
    r.created_at
  from teacher_seeking_ad_responses r
  join teacher_seeking_ads tsa on tsa.id = r.teacher_seeking_ad_id
  join class_profiles cp on cp.id = r.institute_id
  where tsa.teacher_id = auth.uid()
  order by r.created_at desc;
$$;

grant execute on function public.list_teacher_seeking_ad_responses_for_teacher() to authenticated;
