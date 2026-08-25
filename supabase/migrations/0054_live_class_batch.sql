-- Live classes previously had no batch scoping at all — 0033's own comment
-- notes this explicitly ("live_classes has no batch scoping of its own"),
-- meaning every accepted-enrollment student of a teacher/institute could
-- see and join EVERY one of that teacher's live classes, regardless of
-- which specific batch/subject it was actually for. Same optional-scoping
-- shape as assignments (0049): batch_id nullable, null keeps today's
-- behavior ("all my students") unchanged for existing rows and for
-- teachers who don't use batches.
alter table live_classes add column if not exists batch_id uuid references batches (id) on delete set null;

-- Batch-aware replacement for the plain owner-level is_enrolled() check —
-- when a live class is scoped to a batch, a student only counts as
-- "enrolled in it" if their accepted enrollment is for THAT batch, not just
-- enrolled with the owner in general. Falls back to the old owner-level
-- check when batch_id is null, so unscoped classes behave exactly as
-- before this migration.
create or replace function public.is_enrolled_in_live_class(p_live_class_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  lc_owner_type text;
  lc_owner_id uuid;
  lc_batch_id uuid;
begin
  select owner_type, owner_id, batch_id into lc_owner_type, lc_owner_id, lc_batch_id
  from live_classes where id = p_live_class_id;

  if not found then
    return false;
  end if;

  if lc_batch_id is null then
    return is_enrolled(lc_owner_type, lc_owner_id);
  end if;

  return exists (
    select 1 from enrollments
    where student_id = auth.uid()
      and owner_type = lc_owner_type
      and owner_id = lc_owner_id
      and batch_id = lc_batch_id
      and status = 'accepted'
  );
end;
$$;

-- Tighten the actual join-link visibility to the batch-aware check — this
-- is the real access boundary (see 0012's comment on why the link lives in
-- its own RLS-gated table).
drop policy if exists "join link visible to owner, enrolled students, or admin" on live_class_links;
create policy "join link visible to owner, enrolled students, or admin"
  on live_class_links for select
  using (
    exists (
      select 1 from live_classes lc
      where lc.id = live_class_id
        and (is_owner(lc.owner_type, lc.owner_id) or is_enrolled_in_live_class(lc.id) or is_admin())
    )
  );

-- Same tightening for a student self-marking attendance by clicking Join —
-- without this, a student outside the batch could still write an
-- attendance row for a class they can no longer even see the link for.
drop policy if exists "enrolled student marks self present; owner marks anyone" on attendance_records;
create policy "enrolled student marks self present; owner marks anyone"
  on attendance_records for insert
  with check (
    (student_id = auth.uid() and is_enrolled_in_live_class(live_class_id))
    or exists (select 1 from live_classes lc where lc.id = live_class_id and is_owner(lc.owner_type, lc.owner_id))
    or is_admin()
  );
