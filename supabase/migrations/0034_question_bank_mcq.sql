-- question_bank_items (0009) shipped with type in ('theory', 'practical')
-- and just a single `correct_answer` text column — but the teacher Question
-- Bank tab (question-bank-tab.tsx) has always been built for MCQ (4 options,
-- one correct) vs Essay, with topic/marks/grade-band/optional-batch fields
-- that never had columns either. Table has zero rows in production (nothing
-- has ever written to it — see the codebase audit), so this reshapes it in
-- place rather than layering a migration on top of unused data.

alter table question_bank_items drop constraint if exists question_bank_items_type_check;
alter table question_bank_items add constraint question_bank_items_type_check check (type in ('mcq', 'essay'));

alter table question_bank_items
  add column if not exists topic text,
  add column if not exists marks integer not null default 1 check (marks > 0),
  add column if not exists grade_band text check (grade_band in ('1-5', '6-9', '10-11', '12-13', 'campus')),
  add column if not exists batch_id uuid references batches (id) on delete set null,
  -- [{"id": "q1-o1", "text": "..."}, ...] — mcq only, null for essay.
  add column if not exists options jsonb,
  add column if not exists correct_option_id text;
