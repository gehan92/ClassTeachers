-- Rounds out the student profile with the fields a tutoring marketplace
-- profile typically shows (0067/0068 covered the academic side): date of
-- birth (age is more useful shown than stored, so it's derived client-side
-- from this rather than a separately-maintained age column), a location/
-- district (plain text, same convention as teacher_profiles.location —
-- 0024), a short learning-goals line, a preferred class mode, and two more
-- text[] lists matching the qualifications/work_experience pattern (0068).
alter table profiles
  add column if not exists date_of_birth date,
  add column if not exists location text,
  add column if not exists learning_goals text,
  add column if not exists preferred_mode text check (preferred_mode in ('online', 'in_person', 'both')),
  add column if not exists achievements text[],
  add column if not exists interests text[],
  add column if not exists availability text;
