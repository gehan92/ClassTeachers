-- MCQ questions on an exam were only ever shown read-only to the student
-- (see 0034/0052) — exam_submissions had nowhere to store a selected
-- option per question, so every exam, even a pure-MCQ one, forced the
-- student through the handwritten-answer photo-upload flow with no way
-- to actually answer an MCQ question in the app. This is the real
-- auto-grading piece explicitly deferred from the question bank roadmap,
-- picked up now because a pure-MCQ exam currently has no working
-- submission path at all, not just a missing nice-to-have.
--
-- mcq_score/mcq_max_score are computed and stored at submit time (not
-- derived on read) so the teacher's grading view can show the auto-graded
-- MCQ portion even after question_bank_items rows are later edited or
-- deleted.
alter table exam_submissions add column if not exists mcq_answers jsonb not null default '{}'::jsonb;
alter table exam_submissions add column if not exists mcq_score numeric;
alter table exam_submissions add column if not exists mcq_max_score numeric;
