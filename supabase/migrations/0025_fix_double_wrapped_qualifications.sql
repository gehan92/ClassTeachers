-- 0024's "using" clause ran twice against the live database (the alter
-- column type statement was executed a second time after it had already
-- converted qualifications to text[]), which re-wrapped the already-array
-- value in another array — e.g. ["BSc Maths"] became [["BSc Maths"]].
-- unnest() flattens every level of nesting regardless of how many times
-- this happened, so this is safe to run even if only some rows were
-- affected or if it's run more than once.
update teacher_profiles
set qualifications = (
  select array_agg(elem order by ord)
  from unnest(qualifications) with ordinality as t(elem, ord)
)
where qualifications is not null;
