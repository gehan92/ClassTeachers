-- The student dashboard's "Grade / level" field (Profile & Account tab) has
-- been UI-only since it was built: no backing column, so it never loads or
-- saves. This adds the column so it behaves like the adjacent name/phone
-- fields, which already round-trip through `profiles`.

alter table profiles
  add column if not exists grade_level text;
