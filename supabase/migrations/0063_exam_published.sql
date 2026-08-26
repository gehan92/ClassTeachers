-- Exams went live to students immediately on creation, no draft/review
-- step. Adds a publish gate: the teacher can create it, check the paper,
-- then explicitly share it. Existing exams are grandfathered as published
-- — ADD COLUMN ... NOT NULL DEFAULT true backfills every existing row to
-- true automatically, so nothing already live becomes invisible. New exams
-- are created as drafts by createExam (exams-actions.ts) explicitly
-- inserting published: false — not by changing this column's default,
-- which is what makes the backfill above safe.
alter table exams add column if not exists published boolean not null default true;
