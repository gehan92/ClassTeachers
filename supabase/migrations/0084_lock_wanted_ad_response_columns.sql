-- wanted_ad_responses' "mark as read" UPDATE policy (0073) only intends to
-- let the posting student flip `status`, but the policy itself permits
-- updating any column — a student could rewrite the responder's message
-- text directly. Locks it so only `status` may change for a non-admin
-- update.

create or replace function public.restrict_wanted_ad_response_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() then
    return new;
  end if;

  if new.message is distinct from old.message
    or new.responder_type is distinct from old.responder_type
    or new.responder_id is distinct from old.responder_id
    or new.wanted_ad_id is distinct from old.wanted_ad_id
  then
    raise exception 'You can only mark a response as read, not edit it.';
  end if;

  return new;
end;
$$;

drop trigger if exists wanted_ad_responses_restrict_update on wanted_ad_responses;
create trigger wanted_ad_responses_restrict_update
  before update on wanted_ad_responses
  for each row execute function restrict_wanted_ad_response_update();
