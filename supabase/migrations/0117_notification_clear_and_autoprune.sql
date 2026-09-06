-- Two things Gehan asked for on the bell dropdown: a real way to clear
-- notifications (not just mark them read), and old ones quietly cleaning
-- themselves up if nobody bothers. This app has no scheduled/background
-- jobs anywhere in it — pruning happens lazily instead, piggybacked on the
-- one query every dashboard's page.tsx already runs to load its own bell,
-- so a 3-day-old notification disappears the next time that recipient
-- actually opens a dashboard, with no pg_cron or other scheduler needed.

create policy "a recipient can delete their own notifications"
  on notifications for delete
  using (recipient_id = auth.uid());

-- Replaces the plain `select ... eq(recipient_id, ...)` every dashboard's
-- page.tsx used to run directly against the table (student/teacher/
-- institute/admin, all identical). Deletes the caller's own notifications
-- older than 3 days first, then returns what's left — same 30-row cap the
-- old query used.
create or replace function public.list_my_notifications()
returns table (
  id uuid,
  type text,
  data jsonb,
  tab text,
  read_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from notifications
  where recipient_id = auth.uid() and created_at < now() - interval '3 days';

  return query
    select n.id, n.type, n.data, n.tab, n.read_at, n.created_at
    from notifications n
    where n.recipient_id = auth.uid()
    order by n.created_at desc
    limit 30;
end;
$$;

grant execute on function public.list_my_notifications() to authenticated;
