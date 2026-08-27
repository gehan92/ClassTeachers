-- Question Bank authoring gained two asks from Gehan: (1) teachers pick
-- Single-answer (radio) vs Multiple-answer (checkbox) explicitly, instead of
-- checkbox-always with the tick count implying the mode — the intended mode
-- now persists even for a "select all that apply" question that currently
-- has only one option ticked mid-edit. (2) A third question type for
-- IT/programming questions where the stem (and MCQ options) can render in a
-- dark, monospace, terminal-styled block, plus a genuine "Code / Terminal"
-- answer type where the student types code instead of uploading a photo.

alter table question_bank_items add column if not exists multi_select boolean not null default false;
update question_bank_items set multi_select = true
  where multi_select = false and array_length(correct_option_ids, 1) > 1;

alter table question_bank_items add column if not exists code_format boolean not null default false;

-- Teacher's own reference/expected answer for a 'code' question — shown
-- only in the teacher's question bank and grading views, never sent to the
-- student (mirrors how correct_option_ids never reaches the browser).
alter table question_bank_items add column if not exists sample_answer text;

alter table question_bank_items drop constraint if exists question_bank_items_type_check;
alter table question_bank_items add constraint question_bank_items_type_check check (type in ('mcq', 'essay', 'code'));
