-- Bug fix: enrollments' UPDATE policy (0039) only ever allowed the OWNER
-- (or admin) to update a row, never the student themselves. joinAfterQna's
-- fee-waiver path (first-ever connection is free) tried to update the
-- student's own enrollment directly through their normal RLS-scoped
-- client — that update was silently filtered to zero rows by RLS (Supabase
-- returns no error for an UPDATE that matches nothing), so a waived "Join"
-- click looked like it succeeded in the UI but never actually flipped the
-- row to 'joined'. Fixed the same way mark_payment_completed() already
-- solves the equivalent problem for a real payment: a narrow SECURITY
-- DEFINER function instead of widening the UPDATE policy itself (which
-- would risk letting a student set status to anything, not just this one
-- exact transition).
create or replace function public.waive_platform_fee(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
begin
  select * into e from enrollments where id = p_enrollment_id and student_id = auth.uid();
  if not found then
    raise exception 'enrollment_not_found';
  end if;
  if e.status != 'qna_open' then
    raise exception 'not_qna_open';
  end if;
  if not is_first_platform_connection() then
    raise exception 'not_first_connection';
  end if;

  update enrollments
  set status = 'joined', platform_fee_waived = true
  where id = p_enrollment_id;
end;
$$;

grant execute on function public.waive_platform_fee(uuid) to authenticated;
