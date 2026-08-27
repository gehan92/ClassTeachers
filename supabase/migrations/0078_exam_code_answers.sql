-- Code/Terminal questions (0077) need a typed answer per question, not a
-- shared photo upload like essay — mirrors mcq_answers (0057): questionId ->
-- the student's typed answer text. Always manually graded, same as essay,
-- so there's no code_score column the way mcq_score exists.
alter table exam_submissions add column if not exists code_answers jsonb not null default '{}'::jsonb;
