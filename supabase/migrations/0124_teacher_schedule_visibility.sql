-- A teacher managing an institute's assigned batch (can_manage_content, 0093)
-- can already see/manage that batch's notes/exams/live-classes/assignments,
-- but batch_schedule_slots' select policy (0118) still only checked
-- is_owner() — so the new teacher-side Schedule tab would see nothing for
-- an institute-assigned batch's weekly timetable. Read-only for a linked
-- teacher, same as every other institute-batch surface (InstituteTab) — only
-- the select policy widens here; insert/update/delete stay is_owner-only
-- since editing an institute's own batch schedule is still the institute's
-- call, not a linked teacher's.
drop policy if exists "schedule slots visible to owner, enrolled students, or admin" on batch_schedule_slots;
create policy "schedule slots visible to owner, enrolled students, or admin"
  on batch_schedule_slots for select
  using (can_manage_content(owner_type, owner_id, batch_id) or is_enrolled(owner_type, owner_id));
