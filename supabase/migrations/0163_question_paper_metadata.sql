-- Metadata for questions sourced from a specific past paper (PDF import,
-- 0163+) — year the paper was sat, term/semester, and a 4th "other" medium
-- for a paper written in a language outside en/si/ta (e.g. a bilingual or
-- English-medium-with-local-script paper the teacher wants to tag loosely).
-- Purely descriptive — no grading/access-control logic reads these.

alter table question_bank_items drop constraint if exists question_bank_items_language_check;
alter table question_bank_items add constraint question_bank_items_language_check
  check (language in ('en', 'si', 'ta', 'other'));

alter table question_bank_items add column if not exists paper_year integer;
alter table question_bank_items add column if not exists semester text;
