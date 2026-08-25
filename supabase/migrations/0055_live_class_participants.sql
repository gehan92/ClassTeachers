-- Explicit per-student override for a live class, layered on top of the
-- batch scoping from 0054. A teacher can narrow a class down to a
-- hand-picked subset of students within the chosen batch/pool — not just
-- "everyone in this batch". Semantics: when this table has ANY rows for a
-- live class, only those specific students count as enrolled in it; an
-- empty table for that class means "no override", falling back to the
-- batch/owner-level check exactly as before 0054. Deliberately NOT storing
-- an "excluded" list — an empty override table for a class the teacher
-- hasn't customized keeps behaving dynamically (a student who joins the
-- batch later automatically gets access), which a snapshot of "everyone,
-- explicitly" would not.
create table if not exists live_class_participants (
  live_class_id uuid not null references live_classes (id) on delete cascade,
  student_id uuid not null references profiles (id) on delete cascade,
  primary key (live_class_id, student_id)
);

alter table live_class_participants enable row level security;

drop policy if exists "student sees own participant row; owner/admin see all" on live_class_participants;
create policy "student sees own participant row; owner/admin see all"
  on live_class_participants for select
  using (
    student_id = auth.uid()
    or exists (select 1 from live_classes lc where lc.id = live_class_id and (is_owner(lc.owner_type, lc.owner_id) or is_admin()))
  );

drop policy if exists "owner manages participants for their own live class" on live_class_participants;
create policy "owner manages participants for their own live class"
  on live_class_participants for all
  using (exists (select 1 from live_classes lc where lc.id = live_class_id and is_owner(lc.owner_type, lc.owner_id)) or is_admin())
  with check (exists (select 1 from live_classes lc where lc.id = live_class_id and is_owner(lc.owner_type, lc.owner_id)) or is_admin());

-- Extends 0054's function with a participants branch, checked first: if a
-- live class has an explicit participant list, that list is authoritative
-- and the batch/owner-level checks below it are skipped entirely.
--
-- SECURITY DEFINER (unlike 0054's original version of this function): the
-- "does this class have ANY participant rows at all" check below needs to
-- see rows belonging to OTHER students, not just the caller's own — under
-- plain RLS as invoker, a student who was deliberately excluded would only
-- ever see their own (nonexistent) row, the exists-check would come back
-- false, and the function would wrongly fall through to the batch/owner
-- check and let them in anyway. Same reasoning as is_admin() (0001): this
-- only ever returns a boolean, never row data, so the bypass doesn't leak
-- anything through it.
create or replace function public.is_enrolled_in_live_class(p_live_class_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  lc_owner_type text;
  lc_owner_id uuid;
  lc_batch_id uuid;
  has_participants boolean;
begin
  select owner_type, owner_id, batch_id into lc_owner_type, lc_owner_id, lc_batch_id
  from live_classes where id = p_live_class_id;

  if not found then
    return false;
  end if;

  select exists (select 1 from live_class_participants where live_class_id = p_live_class_id) into has_participants;

  if has_participants then
    return exists (
      select 1 from live_class_participants
      where live_class_id = p_live_class_id and student_id = auth.uid()
    );
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

-- Batched wrapper the student dashboard calls once per page load instead
-- of re-deriving the batch/participant visibility rules client-side (which
-- would drift from the RLS logic above over time) or making one round trip
-- per live class.
create or replace function public.visible_live_class_ids(p_ids uuid[])
returns uuid[]
language sql
stable
as $$
  select coalesce(array_agg(id), '{}') from unnest(p_ids) as id where is_enrolled_in_live_class(id);
$$;
