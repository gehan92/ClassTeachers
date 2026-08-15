-- Immutable trail of every admin action (approve/reject/suspend/remove
-- review/etc). Required for a trustworthy admin panel — see the plan's
-- "Admin Panel" section. No update/delete policies exist on purpose: with
-- RLS enabled and no matching policy, those statements are denied outright
-- for every role including admins, so the log can't be edited after the
-- fact by anyone through the API.

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles (id),
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table audit_log enable row level security;

create policy "only admin reads the audit log"
  on audit_log for select
  using (is_admin());

-- Written by the admin server actions themselves (as the authenticated
-- admin, not via a service-role bypass) right after they perform the
-- underlying change — so actor_id must be the caller.
create policy "only admin writes to the audit log, as themself"
  on audit_log for insert
  with check (is_admin() and actor_id = auth.uid());
