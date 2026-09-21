-- Extends enrollments' pending/accepted/declined status machine (0039) with
-- a paid-unlock step between "owner said yes" and "student is actually in."
-- Nothing here rewrites any existing row, only widens what a *future*
-- status value is allowed to be and what counts as "in":
--
--   pending   -> unchanged: request sent, awaiting accept/decline.
--   qna_open  -> NEW: owner accepted, free Q&A thread open (see 0148),
--                contact/content still locked, no fee paid yet.
--   joined    -> NEW: platform fee paid (or waived, see 0147's
--                is_first_platform_connection()) — the new "fully in"
--                terminal state for a request-based join.
--   accepted  -> kept, not retired: join_open_batch (0106) and
--                join_batch_by_code (0131) still write 'accepted' directly
--                and stay untouched/out of scope for the fee funnel.
--                request_to_join_class (0103) is request-based like
--                requestToJoin, so its accept step now lands on 'qna_open'
--                same as a teacher-request accept — no separate handling
--                needed here since it shares respondToJoinRequest.
alter table enrollments drop constraint if exists enrollments_status_check;
alter table enrollments add constraint enrollments_status_check
  check (status in ('pending', 'accepted', 'declined', 'qna_open', 'joined'));

alter table enrollments add column if not exists platform_fee_paid boolean not null default false;
alter table enrollments add column if not exists platform_fee_waived boolean not null default false;

-- "In" now means either the old instant-accept path (accepted) or the new
-- paid/waived terminal state (joined). qna_open is deliberately excluded —
-- that's the actual behavior change this feature wants: an accept alone no
-- longer unlocks contact/notes/exams/reviews, a paid (or waived) join does.
create or replace function public.is_enrolled(p_owner_type text, p_owner_id uuid)
returns boolean
language plpgsql
stable
as $$
begin
  return exists (
    select 1 from enrollments
    where student_id = auth.uid()
      and owner_type = p_owner_type
      and owner_id = p_owner_id
      and status in ('accepted', 'joined')
  );
end;
$$;

-- Same widening for the roster name/phone lookup (0039), which inlines its
-- own check rather than calling is_enrolled().
create or replace function public.get_roster_student_info(p_student_ids uuid[])
returns table (id uuid, full_name text, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.phone
  from profiles p
  where p.id = any(p_student_ids)
    and (
      auth.uid() = p.id
      or is_admin()
      or exists (
        select 1 from enrollments e
        where e.student_id = p.id
          and e.status in ('accepted', 'joined')
          and (
            (e.owner_type = 'teacher' and e.owner_id = auth.uid())
            or (e.owner_type = 'class' and is_owner('class', e.owner_id))
          )
      )
    );
$$;

-- Lazy 7-day auto-expiry for a request the owner never responded to,
-- following 0117's exact precedent: no pg_cron (this app has none), just a
-- sweep run at read time (called from wherever pending requests are
-- already loaded — Students tabs, the student Connections tab). Reuses
-- joined_at as the "last state change" clock: rejoin_after_decline and
-- request_to_join_class both stamp it to now() on every (re)request, so a
-- separate requested_at column would just be a second source of truth for
-- the same fact.
create or replace function public.expire_stale_join_requests()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    update enrollments
    set status = 'declined', decline_reason = 'Auto-expired after 7 days with no response.'
    where status = 'pending' and joined_at < now() - interval '7 days'
    returning student_id, owner_type
  loop
    begin
      perform create_notification(r.student_id, 'join_request_expired', jsonb_build_object('ownerType', r.owner_type), 'connections');
    exception when others then null;
    end;
  end loop;
end;
$$;

grant execute on function public.expire_stale_join_requests() to authenticated;
