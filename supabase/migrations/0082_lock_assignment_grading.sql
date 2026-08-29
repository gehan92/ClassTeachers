-- assignment_submissions' UPDATE policy (0047) is "student_id = auth.uid()
-- or owns_assignment(...) or is_admin()" with no column split — this is the
-- exact bug exam_submissions had (fixed in 0059: a student could rewrite
-- their own grade). Assignments never got the same fix, and unlike exams
-- they genuinely need to keep student self-update (resubmission is a real
-- feature here — see submitAssignment's upsert in assignments-actions.ts),
-- so this can't just remove the student branch outright. Instead: a
-- student's own write is only allowed when it looks exactly like a
-- resubmission (status reset to pending, grade/feedback/graded_at cleared)
-- — never a self-assigned grade.

create or replace function public.restrict_assignment_submission_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if owns_assignment(new.assignment_id) or is_admin() then
    return new;
  end if;

  if new.student_id = auth.uid() then
    if new.status is distinct from 'pending'
      or new.grade is not null
      or new.feedback is not null
      or new.graded_at is not null
    then
      raise exception 'You can only resubmit your answer, not grade it.';
    end if;
    return new;
  end if;

  raise exception 'You do not have permission to update this submission.';
end;
$$;

drop trigger if exists assignment_submissions_restrict_update on assignment_submissions;
create trigger assignment_submissions_restrict_update
  before update on assignment_submissions
  for each row execute function restrict_assignment_submission_update();
