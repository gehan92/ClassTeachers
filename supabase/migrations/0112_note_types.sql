-- Short Notes and Past Papers reuse the existing `notes` table/storage/RLS —
-- same shape as a tute (owner-scoped PDF upload), just a different category.
-- A dashboard tab is now dedicated to each type, so the type is implicit
-- from which tab a teacher uploads through, not a field they pick.
alter table notes add column note_type text not null default 'tute'
  check (note_type in ('tute', 'short_note', 'past_paper'));
