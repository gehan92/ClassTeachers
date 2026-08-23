-- Assignments (0047) could only be tied to a lesson, not the class/batch it
-- belongs to — notes already have batch_id (0008); assignments should match
-- so a teacher managing several classes can organize both the same way.
-- lesson_id stays as an optional further narrowing within the class.

alter table assignments add column if not exists batch_id uuid references batches (id) on delete set null;
