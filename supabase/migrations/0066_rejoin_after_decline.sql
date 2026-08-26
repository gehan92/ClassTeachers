-- enrollments has `unique (student_id, owner_type, owner_id)` (0013) — once
-- a teacher declines a request, that row still exists with status
-- 'declined', so a plain re-request (INSERT) always hits the unique
-- constraint and requestToJoin (batches-actions.ts) reports the generic
-- "you've already sent a request" error even though the student was
-- actually turned down, with no way to ask again.
--
-- The enrollments UPDATE policy (0039) only lets the owner/admin change
-- status — deliberately, so a student can never self-approve their own
-- request by editing the row directly. Re-requesting after a decline still
-- needs to flip status back to 'pending' (or 'accepted' for a 'class'
-- owner, which auto-accepts, same as a fresh join), so this has to happen
-- through a SECURITY DEFINER function that fully controls the new values
-- itself rather than widening the RLS policy to let students UPDATE their
-- own row (which would open a path for a crafted request to set
-- owner_type/status to something the policy's WITH CHECK didn't intend).
create or replace function public.rejoin_after_decline(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b_owner_type text;
  b_owner_id uuid;
  existing_id uuid;
  existing_status text;
  new_status text;
begin
  select owner_type, owner_id into b_owner_type, b_owner_id
  from batches where id = p_batch_id;
  if not found then
    raise exception 'class_not_found';
  end if;

  new_status := case when b_owner_type = 'teacher' then 'pending' else 'accepted' end;

  select id, status into existing_id, existing_status
  from enrollments
  where student_id = auth.uid() and owner_type = b_owner_type and owner_id = b_owner_id;

  if existing_id is null then
    insert into enrollments (student_id, owner_type, owner_id, batch_id, status)
    values (auth.uid(), b_owner_type, b_owner_id, p_batch_id, new_status);
    return;
  end if;

  if existing_status <> 'declined' then
    raise exception 'already_requested';
  end if;

  update enrollments
  set batch_id = p_batch_id, status = new_status, joined_at = now()
  where id = existing_id;
end;
$$;

grant execute on function public.rejoin_after_decline(uuid) to authenticated;
