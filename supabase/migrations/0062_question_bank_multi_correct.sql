-- MCQ questions could only ever have exactly one correct option
-- (correct_option_id). Some questions genuinely need "select all that
-- apply" with more than one correct answer — this adds an array column
-- alongside it rather than replacing it, backfilled from the existing
-- single-answer column so nothing already in the question bank changes
-- behavior. App code now writes/reads correct_option_ids only;
-- correct_option_id is left in place (unused by new code) rather than
-- dropped, since dropping a column is destructive and this one's cheap to
-- just stop touching.
alter table question_bank_items add column if not exists correct_option_ids text[] not null default '{}';

update question_bank_items
set correct_option_ids = array[correct_option_id]
where correct_option_id is not null and correct_option_ids = '{}';
