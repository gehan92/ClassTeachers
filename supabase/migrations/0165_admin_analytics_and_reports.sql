-- Admin reporting: traffic, feature usage and a user "Report" button.
--
-- 1. page_visits — one row per page view (public site and dashboards).
--    Privacy by design: no IP address, no name, no email. The visitor is an
--    anonymous random id the browser keeps in localStorage; the role is
--    looked up from auth.uid() inside the function, never trusted from the
--    browser.
--
-- 2. feature_events — named actions (exam_created, pdf_import, tab_open,
--    search_performed, ...) so admin can see which features people use.
--
-- 3. content_reports — the Report button on ads, profiles, reviews and
--    student requests. Signed-in users only, one open report per user per
--    item, reviewed by admin in Admin -> Reports.
--
-- Nothing here can be read by ordinary users except their own reports. The
-- two tracking tables are written ONLY through the SECURITY DEFINER
-- functions below, which cap every text field so the tables can't be
-- stuffed with junk.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------- tables

create table if not exists page_visits (
  id bigint generated always as identity primary key,
  visited_at timestamptz not null default now(),
  path text not null,
  locale text,
  role text,
  device text,
  referrer_host text,
  search_query text,
  visitor_id uuid,
  user_id uuid
);

create index if not exists page_visits_visited_at_idx on page_visits (visited_at desc);

create table if not exists feature_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event text not null,
  role text,
  user_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists feature_events_created_at_idx on feature_events (created_at desc);

create table if not exists content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles (id) on delete cascade,
  target_type text not null check (target_type in ('ad', 'teacher', 'institute', 'review', 'wanted_ad')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'fake', 'inappropriate', 'scam', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution_note text check (char_length(resolution_note) <= 500),
  resolved_by uuid references profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists content_reports_status_idx on content_reports (status, created_at desc);

-- One open report per person per item — a second click doesn't pile up.
create unique index if not exists content_reports_one_open_per_reporter
  on content_reports (reporter_id, target_type, target_id)
  where status = 'open';

-- ------------------------------------------------------------------- RLS

alter table page_visits enable row level security;
alter table feature_events enable row level security;
alter table content_reports enable row level security;

drop policy if exists "admins read page visits" on page_visits;
create policy "admins read page visits" on page_visits for select using (is_admin());

drop policy if exists "admins read feature events" on feature_events;
create policy "admins read feature events" on feature_events for select using (is_admin());

drop policy if exists "users file their own reports" on content_reports;
create policy "users file their own reports" on content_reports for insert
  with check (reporter_id = auth.uid() and status = 'open' and resolved_by is null and resolved_at is null and resolution_note is null);

drop policy if exists "users see their own reports, admins see all" on content_reports;
create policy "users see their own reports, admins see all" on content_reports for select
  using (reporter_id = auth.uid() or is_admin());

drop policy if exists "admins resolve reports" on content_reports;
create policy "admins resolve reports" on content_reports for update
  using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------- functions

drop function if exists public.track_page_visit(text, text, text, text, text, uuid);
create function public.track_page_visit(
  p_path text,
  p_locale text,
  p_device text,
  p_referrer_host text,
  p_search_query text,
  p_visitor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if p_path is null or p_path = '' or left(p_path, 1) <> '/' then
    return;
  end if;
  if auth.uid() is not null then
    select role into v_role from profiles where id = auth.uid();
  end if;
  insert into page_visits (path, locale, role, device, referrer_host, search_query, visitor_id, user_id)
  values (
    left(p_path, 200),
    case when p_locale in ('en', 'si', 'ta') then p_locale else null end,
    coalesce(v_role, 'visitor'),
    case when p_device in ('mobile', 'tablet', 'desktop') then p_device else null end,
    nullif(left(lower(coalesce(p_referrer_host, '')), 100), ''),
    nullif(left(trim(coalesce(p_search_query, '')), 100), ''),
    p_visitor_id,
    auth.uid()
  );
end;
$$;

grant execute on function public.track_page_visit(text, text, text, text, text, uuid) to anon, authenticated;

drop function if exists public.track_feature_event(text, jsonb);
create function public.track_feature_event(p_event text, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  -- Event names are short snake_case identifiers only.
  if p_event is null or p_event !~ '^[a-z][a-z0-9_]{1,40}$' then
    return;
  end if;
  if auth.uid() is not null then
    select role into v_role from profiles where id = auth.uid();
  end if;
  insert into feature_events (event, role, user_id, metadata)
  values (
    p_event,
    coalesce(v_role, 'visitor'),
    auth.uid(),
    case
      when p_metadata is null or jsonb_typeof(p_metadata) <> 'object' or length(p_metadata::text) > 500
        then '{}'::jsonb
      else p_metadata
    end
  );
end;
$$;

grant execute on function public.track_feature_event(text, jsonb) to anon, authenticated;

-- Keeps the tracking tables small: raw rows older than 400 days are
-- removed (12-month charts plus a month of margin). Admin-only; the admin
-- dashboard calls it now and then.
drop function if exists public.prune_analytics();
create function public.prune_analytics()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    return;
  end if;
  delete from page_visits where visited_at < now() - interval '400 days';
  delete from feature_events where created_at < now() - interval '400 days';
end;
$$;

grant execute on function public.prune_analytics() to authenticated;

-- One call returns everything Admin -> Traffic shows for the last p_days
-- days, aggregated inside the database (so it stays fast no matter how many
-- visits pile up). Admin visits are left out so your own clicking around
-- doesn't inflate the numbers. Days are Sri Lanka days (Asia/Colombo).
drop function if exists public.admin_traffic_report(integer);
create function public.admin_traffic_report(p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 400)));
  v_result jsonb;
begin
  if not is_admin() then
    raise exception 'not allowed';
  end if;

  with v as (
    select *
    from page_visits
    where visited_at >= v_since and coalesce(role, 'visitor') <> 'admin'
  ),
  f as (
    select *
    from feature_events
    where created_at >= v_since and coalesce(role, 'visitor') <> 'admin'
  )
  select jsonb_build_object(
    'firstVisitAt', (select min(visited_at) from page_visits),
    'totals', (
      select jsonb_build_object(
        'visits', count(*),
        'visitors', count(distinct visitor_id),
        'signedInUsers', count(distinct user_id),
        'publicVisits', count(*) filter (where role = 'visitor')
      )
      from v
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('d', d, 'visits', visits, 'visitors', visitors) order by d), '[]'::jsonb)
      from (
        select to_char(visited_at at time zone 'Asia/Colombo', 'YYYY-MM-DD') as d,
               count(*) as visits,
               count(distinct visitor_id) as visitors
        from v
        group by 1
      ) x
    ),
    'pages', (
      select coalesce(jsonb_agg(jsonb_build_object('path', path, 'n', n, 'visitors', visitors) order by n desc), '[]'::jsonb)
      from (
        select regexp_replace(path, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', ':id', 'g') as path,
               count(*) as n,
               count(distinct visitor_id) as visitors
        from v
        group by 1
        order by 2 desc
        limit 20
      ) x
    ),
    'ads', (
      select coalesce(jsonb_agg(jsonb_build_object('id', ad_id, 'n', n, 'visitors', visitors) order by n desc), '[]'::jsonb)
      from (
        select substring(path from '^/ad/([0-9a-f-]{36})') as ad_id,
               count(*) as n,
               count(distinct visitor_id) as visitors
        from v
        where path ~ '^/ad/[0-9a-f-]{36}'
        group by 1
        order by 2 desc
        limit 15
      ) x
    ),
    'referrers', (
      select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
      from (
        select coalesce(referrer_host, 'direct') as k, count(*) as n
        from v
        group by 1
        order by 2 desc
        limit 10
      ) x
    ),
    'devices', (
      select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
      from (select coalesce(device, 'unknown') as k, count(*) as n from v group by 1) x
    ),
    'locales', (
      select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
      from (select coalesce(locale, 'en') as k, count(*) as n from v group by 1) x
    ),
    'roles', (
      select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
      from (select coalesce(role, 'visitor') as k, count(*) as n from v group by 1) x
    ),
    'features', (
      select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n, 'users', users) order by n desc), '[]'::jsonb)
      from (
        select event as k, count(*) as n, count(distinct user_id) as users
        from f
        where event <> 'search_performed'
        group by 1
      ) x
    ),
    'searches', (
      select coalesce(jsonb_agg(jsonb_build_object('term', term, 'n', n, 'noResults', no_results) order by n desc), '[]'::jsonb)
      from (
        select lower(trim(concat_ws(' · ', nullif(metadata ->> 'subject', ''), nullif(metadata ->> 'location', '')))) as term,
               count(*) as n,
               count(*) filter (where coalesce(metadata ->> 'results', '') = '0') as no_results
        from f
        where event = 'search_performed'
        group by 1
        order by 2 desc
        limit 20
      ) x
    )
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.admin_traffic_report(integer) to authenticated;
