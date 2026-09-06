-- Optional context a teacher/institute can leave when declining a join
-- request (Gehan: a decline reason is a nice-to-have, not mandatory — a
-- bare decline needs no explanation). Nullable, written only by
-- respondToJoinRequest when accept=false; the existing "owner can update
-- enrollment status" policy (0039) already covers writing this column, so
-- no RLS change is needed here.
alter table enrollments add column if not exists decline_reason text;
