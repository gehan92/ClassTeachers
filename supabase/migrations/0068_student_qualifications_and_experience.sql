-- Two corrections to 0067's student academic profile fields, based on
-- follow-up feedback:
--
-- 1. `qualification` was a single text field, but a student can hold more
--    than one degree/diploma — same shape as teacher_profiles.qualifications
--    (0024), a repeatable list rather than one string. Replaced with a
--    plural text[] column.
-- 2. subjects/languages were meant to be entered comma-separated in one
--    Input; the UI is being changed to an add/remove list per entry
--    instead (matching teacher_profiles.qualifications/work_experience's
--    UI), so no schema change needed there — text[] already supports it.
--
-- Also adds work_experience, requested alongside the qualifications fix —
-- same shape as teacher_profiles.work_experience (0038).
alter table profiles
  add column if not exists qualifications text[],
  add column if not exists work_experience text[];

alter table profiles drop column if exists qualification;
