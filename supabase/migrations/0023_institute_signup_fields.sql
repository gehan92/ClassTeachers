-- Class/Institute signup collects a first slice of the profile immediately,
-- same treatment as Teacher and Campus Lecturer (0022) — a fresh institute
-- account previously had nothing published until someone visited Settings
-- later. class_type is new, nullable, and mirrors teacher_profiles'
-- physical/online/both column so both profile kinds read the same way.
alter table class_profiles
  add column if not exists class_type text check (class_type in ('physical', 'online', 'both'));
