-- Institute Supply-Side gap fixes (Gehan's mockup, section 2.4), part 2 of 2:
-- Vacancy Ad -- "Institute is hiring, can specify physical location or
-- online-only role." Exact mirror of the reverse direction already built
-- (teacher_seeking_ads/teacher_seeking_ad_responses, 0136/0137): there, a
-- teacher posts availability and institutes browse+respond; here, an
-- institute posts an opening and teachers browse+apply. Its own tables, not
-- a sixth advertisements placement -- a vacancy isn't tied to a batch and
-- was in fact removed once already as a fake ad type with no schema backing
-- (see ad-board.tsx's own history comment), so this gives it a real one.

create table vacancy_ads (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references class_profiles (id) on delete cascade,
  subject_id uuid references subjects (id) on delete set null,
  mode text check (mode in ('online', 'physical')),
  location text,
  title text not null,
  content text not null,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table vacancy_ads enable row level security;

create trigger vacancy_ads_set_updated_at
  before update on vacancy_ads
  for each row execute function set_updated_at();

-- Same shape as teacher_seeking_ads' own select policy (0136) -- active rows
-- are readable by anyone (a teacher needs to browse these), the posting
-- institute and admin can always see their own regardless of status. No
-- anon grant on the browse RPC below -- same reasoning as 0136/0137: this
-- stays a signed-in, teacher-side surface, not a public job board.
create policy "active vacancy ads are public; owner/admin see all statuses"
  on vacancy_ads for select
  using (status = 'active' or is_owner('class', institute_id) or is_admin());

create policy "an institute creates its own vacancy ads"
  on vacancy_ads for insert
  with check (is_owner('class', institute_id));

create policy "an institute updates its own vacancy ads"
  on vacancy_ads for update
  using (is_owner('class', institute_id) or is_admin())
  with check (is_owner('class', institute_id) or is_admin());

create policy "an institute deletes its own vacancy ads"
  on vacancy_ads for delete
  using (is_owner('class', institute_id) or is_admin());

-- Response side, mirroring teacher_seeking_ad_responses (0137) exactly --
-- only a teacher ever applies here, so this points straight at profiles
-- rather than a responder_type/responder_id polymorphism.
create table vacancy_applications (
  id uuid primary key default gen_random_uuid(),
  vacancy_id uuid not null references vacancy_ads (id) on delete cascade,
  teacher_id uuid not null references profiles (id) on delete cascade,
  message text not null check (length(trim(message)) > 0),
  status text not null default 'new' check (status in ('new', 'read', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  -- One application per teacher per vacancy -- same "single reply, not a
  -- thread" shape teacher_seeking_ad_responses already uses.
  unique (vacancy_id, teacher_id)
);

alter table vacancy_applications enable row level security;

create policy "the posting institute, the applying teacher, or admin can see an application"
  on vacancy_applications for select
  using (
    exists (select 1 from vacancy_ads va where va.id = vacancy_id and is_owner('class', va.institute_id))
    or teacher_id = auth.uid()
    or is_admin()
  );

create policy "a teacher applies to an active vacancy"
  on vacancy_applications for insert
  with check (
    exists (select 1 from vacancy_ads va where va.id = vacancy_id and va.status = 'active')
    and teacher_id = auth.uid()
  );

-- Only the posting institute (or admin) ever updates an application -- to
-- mark it read, or to accept/decline. Locked to the status column only,
-- same reasoning as restrict_teacher_seeking_ad_response_update (0137).
create policy "the posting institute can decide on an application"
  on vacancy_applications for update
  using (
    exists (select 1 from vacancy_ads va where va.id = vacancy_id and is_owner('class', va.institute_id))
    or is_admin()
  )
  with check (
    exists (select 1 from vacancy_ads va where va.id = vacancy_id and is_owner('class', va.institute_id))
    or is_admin()
  );

create or replace function public.restrict_vacancy_application_update()
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
    or new.teacher_id is distinct from old.teacher_id
    or new.vacancy_id is distinct from old.vacancy_id
  then
    raise exception 'You can only mark an application as read or decide on it, not edit it.';
  end if;

  return new;
end;
$$;

create trigger vacancy_applications_restrict_update
  before update on vacancy_applications
  for each row execute function restrict_vacancy_application_update();

-- Teacher-side browse feed -- authenticated only, mirrors
-- list_teacher_seeking_ads_for_institutes (0137). Shows whether *this*
-- teacher already applied, same shape as list_wanted_ads_for_responder.
create function public.list_vacancy_ads_for_teachers()
returns table (
  id uuid,
  institute_id uuid,
  institute_name text,
  institute_photo_url text,
  institution_verified boolean,
  subject text,
  mode text,
  location text,
  title text,
  content text,
  created_at timestamptz,
  my_application text,
  my_application_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    va.id,
    cp.id,
    cp.name,
    cp.photo_url,
    cp.institution_verified,
    s.translations ->> 'en',
    va.mode,
    va.location,
    va.title,
    va.content,
    va.created_at,
    app.message,
    app.status
  from vacancy_ads va
  join class_profiles cp on cp.id = va.institute_id
  left join subjects s on s.id = va.subject_id
  left join vacancy_applications app on app.vacancy_id = va.id and app.teacher_id = auth.uid()
  where va.status = 'active'
    and cp.status = 'approved'
    and cp.owner_published
  order by va.created_at desc;
$$;

grant execute on function public.list_vacancy_ads_for_teachers() to authenticated;

-- Institute-side "who applied" feed, mirroring
-- list_teacher_seeking_ad_responses_for_teacher (0137).
create function public.list_vacancy_applications_for_institute()
returns table (
  id uuid,
  vacancy_id uuid,
  teacher_id uuid,
  teacher_name text,
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
    app.id,
    app.vacancy_id,
    app.teacher_id,
    p.full_name,
    app.message,
    app.status,
    app.created_at
  from vacancy_applications app
  join vacancy_ads va on va.id = app.vacancy_id
  join profiles p on p.id = app.teacher_id
  where is_owner('class', va.institute_id)
  order by app.created_at desc;
$$;

grant execute on function public.list_vacancy_applications_for_institute() to authenticated;
