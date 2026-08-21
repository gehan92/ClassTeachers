-- The Profile tab only ever offered one free-text "Degree" field, but real
-- teachers commonly hold several credentials (a degree plus a diploma, a
-- teaching certificate, etc.) — this turns qualifications into a list a
-- teacher can add to/remove from, rather than cramming everything into one
-- input. Existing single values are preserved as one-element arrays rather
-- than dropped.
alter table teacher_profiles
  alter column qualifications type text[]
  using case when qualifications is null then null else array[qualifications] end;
