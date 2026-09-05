-- Homework reuses the existing `assignments` table/storage/RLS — same shape
-- as an assignment (owner-scoped worksheet PDF + photo-upload submission +
-- grading). A dashboard tab is now dedicated to each type, so the type is
-- implicit from which tab a teacher uploads through, not a field they pick.
alter table assignments add column assignment_type text not null default 'assignment'
  check (assignment_type in ('assignment', 'homework'));
