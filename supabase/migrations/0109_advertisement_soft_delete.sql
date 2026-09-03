-- Ads/promotions could only ever be paused (status='removed', still visible
-- to the owner in their own dashboard) or hard-deleted (.delete(), gone for
-- good with no way to see what was posted before). Gehan wants a real
-- history of past ads plus a way to undo a delete, so this adds a fourth
-- status value instead of a new column -- 'deleted' means "the owner
-- explicitly removed this," distinct from 'removed' which already means
-- "paused, still in the owner's working list."
--
-- Existing RLS already lets an owner select every status on their own rows
-- (0014's "active ads are public; owner/purchaser/admin see all statuses"),
-- so no policy changes are needed here -- only the app-level queries need to
-- start filtering 'deleted' out of the working list and into a history one.

alter table advertisements drop constraint if exists advertisements_status_check;
alter table advertisements add constraint advertisements_status_check
  check (status in ('active', 'expired', 'removed', 'deleted'));
