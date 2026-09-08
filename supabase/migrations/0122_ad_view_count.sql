-- Teacher dashboard spec doc's "Ad analytics" (Promote and Ads) -- the
-- simplest honest version buildable without a payment gateway: how many
-- times each ad's own public page (/ad/[id]) has actually been opened.
-- No leads/contact-unlock tracking here -- that genuinely needs real money
-- movement, which doesn't exist in this app yet.

alter table advertisements add column if not exists view_count integer not null default 0;

-- Security definer so an anonymous visitor (who has no update grant on
-- advertisements at all -- see 0014's "owner/purchaser/admin can update"
-- policy) can still bump this counter just by viewing the ad. Mirrors the
-- same public-visibility rule the SELECT policy already uses, so a viewer
-- can only inflate the count of an ad they could actually see.
create or replace function public.increment_ad_view(p_ad_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update advertisements
  set view_count = view_count + 1
  where id = p_ad_id
    and status = 'active'
    and (expires_at is null or expires_at > now());
end;
$$;

grant execute on function public.increment_ad_view(uuid) to anon, authenticated;
