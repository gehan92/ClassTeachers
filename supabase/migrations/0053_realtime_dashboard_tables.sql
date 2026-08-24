-- Enables Supabase Realtime (Postgres change streams over websockets) for
-- the "needs to feel alive" tables — new inquiry, new join request, a
-- submission coming in, attendance being marked. Without a table being
-- added to this publication, postgres_changes subscriptions to it never
-- fire client-side, no matter what filter is passed.
--
-- All five already have RLS enabled (0011/0013/0033/0037/0047) — Realtime
-- authorizes postgres_changes against the subscriber's own SELECT policy,
-- same as any other read, so this doesn't loosen who can see what.
--
-- `alter publication ... add table` errors if the table is already a
-- member, so this checks pg_publication_tables first — migrations here are
-- hand-applied with no tracking of what ran (see migration-workflow notes),
-- so every migration needs to survive being run more than once.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inquiries'
  ) then
    alter publication supabase_realtime add table inquiries;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'enrollments'
  ) then
    alter publication supabase_realtime add table enrollments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'exam_submissions'
  ) then
    alter publication supabase_realtime add table exam_submissions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'assignment_submissions'
  ) then
    alter publication supabase_realtime add table assignment_submissions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attendance_records'
  ) then
    alter publication supabase_realtime add table attendance_records;
  end if;
end $$;
