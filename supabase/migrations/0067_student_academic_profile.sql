-- The student Profile tab only ever round-tripped name/phone/grade_level
-- (0027) — everything else a student might want to show about themselves
-- (an "about me" blurb, whether they're currently in school or on campus,
-- their institution, a degree/diploma they're pursuing or hold, subjects
-- they study, languages they speak) had no column at all. Same shape as
-- the equivalent teacher_profiles fields (bio: 0004; languages: 0043,
-- plain text[] rather than the subject_links many-to-many table, since
-- these are informational only — nothing here feeds public search).
alter table profiles
  add column if not exists bio text,
  add column if not exists education_level text check (education_level in ('school', 'campus', 'graduated')),
  add column if not exists institution_name text,
  add column if not exists qualification text,
  add column if not exists subjects text[],
  add column if not exists languages text[];
