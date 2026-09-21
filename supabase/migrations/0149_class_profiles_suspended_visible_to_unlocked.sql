-- Edge case (b) of the institute-unlock feature: a student who already paid
-- to unlock an institute (institute_access, 0147) must still be able to see
-- that institute's page (to show a "this institute is suspended" banner) if
-- Admin later suspends it — not a blank 404. class_profiles' existing
-- select policy (0005) only ever allowed 'approved' rows to be public, so a
-- 'suspended' row is invisible to everyone except the owner/admin today.
-- This adds exactly one more carve-out: an already-unlocked student.
drop policy if exists "approved class profiles are public, others owner/admin only" on class_profiles;
create policy "approved (or unlocked-by-this-student) class profiles are visible"
  on class_profiles for select
  using (
    status = 'approved'
    or auth.uid() = owner_id
    or is_admin()
    or exists (select 1 from institute_access where institute_id = class_profiles.id and student_id = auth.uid())
  );
