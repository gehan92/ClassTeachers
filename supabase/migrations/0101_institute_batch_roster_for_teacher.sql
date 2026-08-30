-- Institute Blueprint step 3b, the missing half. 0093/0094 already made a
-- linked teacher's assigned institute batch fully manageable at the RLS
-- layer — notes, exams, live_classes, question_bank_items, assignments,
-- and every submission/attendance/participant table one level below all
-- already grant access via can_manage_content()/can_manage_assignment_
-- content(). But the teacher dashboard's own read queries never asked for
-- any of it (still hardcoded to owner_type = 'teacher'), and there was no
-- way to resolve an institute student's name at all: get_roster_student_info
-- (0032) only ever opened up for the institute's own owner account, never a
-- teacher merely assigned to one of its batches. In practice, content
-- created against an institute batch was invisible again the moment the
-- page reloaded, and grading it was impossible since the submission never
-- surfaced either.
--
-- This migration is the one piece the database layer was still missing:
-- a way to resolve who's actually enrolled in a batch a teacher manages.
-- Narrow, purpose-built RPC rather than widening enrollments' own SELECT
-- policy — same reasoning 0093's own comment gives for not widening
-- is_owner() directly: a linked teacher should see exactly the roster of
-- the batch they manage, nothing broader about the institute's enrollments.
-- The rest of this fix (teacher/page.tsx no longer filtering its content
-- queries to owner_type = 'teacher') is an app-layer change, not a schema
-- one — RLS already allows it, so nothing here is needed for that half.
create or replace function public.get_managed_batch_student_info()
returns table (
  enrollment_id uuid,
  student_id uuid,
  full_name text,
  phone text,
  batch_id uuid,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.student_id, p.full_name, p.phone, e.batch_id, e.joined_at
  from enrollments e
  join profiles p on p.id = e.student_id
  where e.owner_type = 'class'
    and e.status = 'accepted'
    and e.batch_id is not null
    and can_manage_class_batch(e.batch_id);
$$;

grant execute on function public.get_managed_batch_student_info() to authenticated;
