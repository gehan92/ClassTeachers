-- profiles' own UPDATE policy (0003) is "auth.uid() = id or is_admin()" with
-- no column restriction — RLS can't split "your own row" from "except this
-- one column", so a signed-in user could set their own `role` to 'admin'
-- directly via the Supabase client and gain every admin-gated action in the
-- app (is_admin()/requireAdmin() both just read this column). Locking it
-- with a trigger instead: any UPDATE that changes role is rejected unless
-- the caller is already an admin. security definer so the is_admin() check
-- inside it can read profiles despite profiles' own restrictive SELECT
-- policy, same reasoning as is_admin() itself (0001).

create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    raise exception 'Only an admin can change a profile''s role.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_self_role_change on profiles;
create trigger profiles_prevent_self_role_change
  before update on profiles
  for each row execute function prevent_self_role_change();
