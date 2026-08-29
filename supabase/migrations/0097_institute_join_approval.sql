-- Institute Blueprint, step 4b. 0040's own comment on this exact policy
-- said it plainly: "Institute ('class') joins deliberately stay instant/
-- accepted here — there's no institute-side accept/decline UI yet...
-- Revisit this once that UI exists." That UI is the app-layer change
-- alongside this migration (a Students tab, mirroring the teacher
-- dashboard's) — this is the other half: joining a class now creates a
-- pending request the institute has to accept, exactly like joining an
-- individual teacher already did.

drop policy if exists "a student can request to join themself" on enrollments;
create policy "a student can request to join themself"
  on enrollments for insert
  with check (student_id = auth.uid() and status = 'pending');

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
begin
  select owner_type, owner_id into b_owner_type, b_owner_id
  from batches where id = p_batch_id;
  if not found then
    raise exception 'class_not_found';
  end if;

  if b_owner_type = 'class' then
    select id, status into existing_id, existing_status
    from enrollments
    where student_id = auth.uid() and owner_type = b_owner_type and owner_id = b_owner_id and batch_id = p_batch_id;
  else
    select id, status into existing_id, existing_status
    from enrollments
    where student_id = auth.uid() and owner_type = b_owner_type and owner_id = b_owner_id;
  end if;

  if existing_id is null then
    insert into enrollments (student_id, owner_type, owner_id, batch_id, status)
    values (auth.uid(), b_owner_type, b_owner_id, p_batch_id, 'pending');
    return;
  end if;

  if existing_status <> 'declined' then
    raise exception 'already_requested';
  end if;

  update enrollments
  set batch_id = p_batch_id, status = 'pending', joined_at = now()
  where id = existing_id;
end;
$$;
