-- Bug fix: expire_stale_join_requests() (0146) pointed its notification at
-- tab 'connections', but the student dashboard's actual nav key for that
-- tab is still 'requests' (only its visible label was renamed to
-- "Connections" — see src/components/dashboard/student/connections-tab.tsx
-- and student/page.tsx's groups array). Clicking the notification would
-- try to navigate to a tab key that doesn't exist and silently do nothing.
-- Same bug, same fix, as the one already caught and corrected in
-- src/lib/dashboard/batches-actions.ts's respondToJoinRequest.
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
      perform create_notification(r.student_id, 'join_request_expired', jsonb_build_object('ownerType', r.owner_type), 'requests');
    exception when others then null;
    end;
  end loop;
end;
$$;
