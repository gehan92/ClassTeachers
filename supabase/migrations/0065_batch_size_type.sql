-- "Group" vs "individual" tutoring was only ever implied by a batch's
-- auto-generated title text (createIndividualAd in ads-actions.ts writes
-- "<Subject> — Individual tutoring") — never a real, queryable attribute.
-- This makes it a real column so the Classes tab can show/edit/filter it
-- directly instead of guessing from a title string. Existing rows default
-- to 'group', matching today's implicit assumption for every batch created
-- through the ordinary "+ Add batch" flow.
alter table batches add column if not exists class_size_type text not null default 'group'
  check (class_size_type in ('group', 'individual'));

-- One-time backfill for the individual-tutoring batches that already exist
-- (created via createIndividualAd before this column existed), identifiable
-- only by their generated title suffix. Safe to re-run — it just re-sets
-- the same value each time.
update batches set class_size_type = 'individual'
where class_size_type = 'group' and title ilike '%individual tutoring';
