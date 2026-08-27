-- Whether a graded exam's correct answers (and, for a "code" question, the
-- teacher's reference answer) become visible to the student in their own
-- results view. Off by default and NOT retroactively enabled for existing
-- exams — question_bank_items are a reusable bank (the same question can be
-- pulled into a later exam or a different batch), so revealing an answer
-- once leaks it forever for that question. A teacher opts in per exam,
-- typically a one-off test they won't reuse questions from.
alter table exams add column if not exists reveal_answers boolean not null default false;
