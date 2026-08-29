-- teacher_profiles/class_profiles UPDATE policies (0004/0005) are also
-- "auth.uid() = id/owner_id or is_admin()" with no column restriction. The
-- app itself never lets an owner write `status` or `institution_verified`
-- (0075 already documented this as a known, accepted RLS gap — "enforced at
-- the app layer, not a schema-level lock") but nothing stops a direct
-- Supabase call from setting status='approved' or institution_verified=true
-- and bypassing admin review entirely. Locking both with triggers, same
-- pattern as profiles.role (0080).

create or replace function public.prevent_self_listing_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and not is_admin() then
    raise exception 'Only an admin can change a listing''s status.';
  end if;
  return new;
end;
$$;

drop trigger if exists teacher_profiles_prevent_self_status_change on teacher_profiles;
create trigger teacher_profiles_prevent_self_status_change
  before update on teacher_profiles
  for each row execute function prevent_self_listing_status_change();

drop trigger if exists class_profiles_prevent_self_status_change on class_profiles;
create trigger class_profiles_prevent_self_status_change
  before update on class_profiles
  for each row execute function prevent_self_listing_status_change();

create or replace function public.prevent_self_verification_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.institution_verified is distinct from old.institution_verified and not is_admin() then
    raise exception 'Only an admin can change a verification badge.';
  end if;
  return new;
end;
$$;

drop trigger if exists teacher_profiles_prevent_self_verification_change on teacher_profiles;
create trigger teacher_profiles_prevent_self_verification_change
  before update on teacher_profiles
  for each row execute function prevent_self_verification_change();
