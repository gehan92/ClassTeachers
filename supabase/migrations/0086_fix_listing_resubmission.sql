-- 0081's prevent_self_listing_status_change() blocked every non-admin
-- status change unconditionally — but resubmitListing() (lib/dashboard/
-- actions.ts) already relied on exactly one non-admin status change: an
-- owner whose listing was rejected flipping it back to 'pending' themselves
-- to re-enter the Admin -> Approvals queue, instead of being stuck
-- rejected forever waiting on an admin. Missed that call site when writing
-- 0081. Carves out exactly that one transition (rejected -> pending, by
-- the row's own owner) while still blocking every other self-directed
-- status change (approving/suspending yourself, re-hiding an approved
-- listing as pending, etc).

create or replace function public.prevent_self_listing_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_type text := case tg_table_name when 'teacher_profiles' then 'teacher' else 'class' end;
begin
  if new.status is distinct from old.status and not is_admin() then
    if old.status = 'rejected' and new.status = 'pending' and is_owner(owner_type, new.id) then
      return new;
    end if;
    raise exception 'Only an admin can change a listing''s status.';
  end if;
  return new;
end;
$$;
