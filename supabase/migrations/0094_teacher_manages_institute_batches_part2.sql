-- Institute Blueprint, step 3a continued. 0093 covered notes/exams/
-- live_classes/question_bank_items/assignments themselves, but missed
-- every table one level down that also gates through is_owner() via the
-- parent's owner_type/owner_id rather than carrying its own: exam grading
-- (owns_exam), attendance, live-class participant overrides and reminders,
-- exam participant overrides, and the "see a question via its exam"
-- read policy. Without this, a linked teacher could create an exam or
-- live class for their assigned batch (0093) but couldn't grade it, take
-- attendance for it, or target specific students in it — genuinely broken
-- rather than just incomplete, exactly the gap 0093's own comment on
-- get_my_question_answers already called out for a different table.

-- owns_exam (0011) backs exam_submissions' select/update policies, the
-- submissions storage bucket's read policy (0019), and the one-attempt
-- trigger (0059) — updating it alone extends grading access to a linked
-- teacher everywhere those already are, same as owns_assignment in 0093.
create or replace function public.owns_exam(p_exam_id uuid)
returns boolean
language sql
stable
as $$
  select can_manage_content(e.owner_type, e.owner_id, e.batch_id)
  from exams e
  where e.id = p_exam_id;
$$;

-- attendance_records (0033/0054)
drop policy if exists "student sees own record; owner/admin see all for their live class" on attendance_records;
create policy "student sees own record; owner/admin see all for their live class"
  on attendance_records for select
  using (
    student_id = auth.uid()
    or exists (
      select 1 from live_classes lc
      where lc.id = live_class_id and can_manage_content(lc.owner_type, lc.owner_id, lc.batch_id)
    )
  );

drop policy if exists "enrolled student marks self present; owner marks anyone" on attendance_records;
create policy "enrolled student marks self present; owner marks anyone"
  on attendance_records for insert
  with check (
    (student_id = auth.uid() and is_enrolled_in_live_class(live_class_id))
    or exists (select 1 from live_classes lc where lc.id = live_class_id and can_manage_content(lc.owner_type, lc.owner_id, lc.batch_id))
    or is_admin()
  );

drop policy if exists "owner or admin updates attendance" on attendance_records;
create policy "owner or admin updates attendance"
  on attendance_records for update
  using (exists (select 1 from live_classes lc where lc.id = live_class_id and can_manage_content(lc.owner_type, lc.owner_id, lc.batch_id)))
  with check (exists (select 1 from live_classes lc where lc.id = live_class_id and can_manage_content(lc.owner_type, lc.owner_id, lc.batch_id)));

drop policy if exists "owner or admin deletes attendance" on attendance_records;
create policy "owner or admin deletes attendance"
  on attendance_records for delete
  using (exists (select 1 from live_classes lc where lc.id = live_class_id and can_manage_content(lc.owner_type, lc.owner_id, lc.batch_id)));

-- live_class_participants (0055)
drop policy if exists "student sees own participant row; owner/admin see all" on live_class_participants;
create policy "student sees own participant row; owner/admin see all"
  on live_class_participants for select
  using (
    student_id = auth.uid()
    or exists (select 1 from live_classes lc where lc.id = live_class_id and can_manage_content(lc.owner_type, lc.owner_id, lc.batch_id))
  );

drop policy if exists "owner manages participants for their own live class" on live_class_participants;
create policy "owner manages participants for their own live class"
  on live_class_participants for all
  using (exists (select 1 from live_classes lc where lc.id = live_class_id and can_manage_content(lc.owner_type, lc.owner_id, lc.batch_id)))
  with check (exists (select 1 from live_classes lc where lc.id = live_class_id and can_manage_content(lc.owner_type, lc.owner_id, lc.batch_id)));

-- live_class_reminders (0056) — the delete policy (student dismisses their
-- own) never referenced is_owner, untouched here.
drop policy if exists "student sees own reminders; owner/admin see all" on live_class_reminders;
create policy "student sees own reminders; owner/admin see all"
  on live_class_reminders for select
  using (
    student_id = auth.uid()
    or exists (select 1 from live_classes lc where lc.id = live_class_id and can_manage_content(lc.owner_type, lc.owner_id, lc.batch_id))
  );

drop policy if exists "owner sends reminders for their own live class" on live_class_reminders;
create policy "owner sends reminders for their own live class"
  on live_class_reminders for insert
  with check (exists (select 1 from live_classes lc where lc.id = live_class_id and can_manage_content(lc.owner_type, lc.owner_id, lc.batch_id)));

drop policy if exists "owner refreshes their own reminders" on live_class_reminders;
create policy "owner refreshes their own reminders"
  on live_class_reminders for update
  using (exists (select 1 from live_classes lc where lc.id = live_class_id and can_manage_content(lc.owner_type, lc.owner_id, lc.batch_id)))
  with check (exists (select 1 from live_classes lc where lc.id = live_class_id and can_manage_content(lc.owner_type, lc.owner_id, lc.batch_id)));

-- exam_participants (0060)
drop policy if exists "student sees own participant row; owner/admin see all" on exam_participants;
create policy "student sees own participant row; owner/admin see all"
  on exam_participants for select
  using (
    student_id = auth.uid()
    or exists (select 1 from exams e where e.id = exam_id and can_manage_content(e.owner_type, e.owner_id, e.batch_id))
  );

drop policy if exists "owner manages participants for their own exam" on exam_participants;
create policy "owner manages participants for their own exam"
  on exam_participants for all
  using (exists (select 1 from exams e where e.id = exam_id and can_manage_content(e.owner_type, e.owner_id, e.batch_id)))
  with check (exists (select 1 from exams e where e.id = exam_id and can_manage_content(e.owner_type, e.owner_id, e.batch_id)));

-- question_bank_items "visible via a visible exam" (0061) — a linked
-- teacher managing an exam for their batch needs to see the questions it's
-- built from, same as the exam's actual owner already could.
drop policy if exists "question bank visible via a visible exam" on question_bank_items;
create policy "question bank visible via a visible exam"
  on question_bank_items for select
  using (
    exists (
      select 1 from exams e
      where question_bank_items.id = any(e.question_ids)
        and (can_manage_content(e.owner_type, e.owner_id, e.batch_id) or is_enrolled_in_exam(e.id))
    )
  );
