-- Institute Blueprint, step 3a — third correction. 0093's
-- can_manage_assignment_content only ever looked at lesson_id, on the
-- assumption assignments scope purely by lesson (0047's original design).
-- Missed that 0049 gave assignments a batch_id too, alongside lesson_id
-- ("lesson_id stays as an optional further narrowing within the class" —
-- 0049's own comment), specifically so a teacher could organize assignments
-- the same way as notes. A linked teacher creating an assignment scoped
-- directly to their batch (no specific lesson picked) would have been
-- silently rejected by RLS despite 0093's own intent. Changes the
-- function's parameter list, so it needs drop+create rather than
-- create-or-replace (same reason 0026/0074/0075/0076/0087 all needed it) —
-- and every policy still referencing the old signature has to be dropped
-- BEFORE the function itself, or Postgres refuses the drop (2BP01:
-- dependent objects still exist) — the ordering this file got wrong the
-- first time.

drop policy if exists "assignments visible to owner, enrolled students, or admin" on assignments;
drop policy if exists "owner manages their own assignments" on assignments;
drop policy if exists "owner or admin updates an assignment" on assignments;
drop policy if exists "owner or admin deletes an assignment" on assignments;
drop policy if exists "assignment worksheet readable by anyone who can see its row" on storage.objects;

drop function if exists public.can_manage_assignment_content(text, uuid, uuid);

create function public.can_manage_assignment_content(p_owner_type text, p_owner_id uuid, p_batch_id uuid, p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_owner(p_owner_type, p_owner_id)
    or is_admin()
    or (p_owner_type = 'class' and p_batch_id is not null and can_manage_class_batch(p_batch_id))
    or (
      p_owner_type = 'class'
      and p_lesson_id is not null
      and exists (
        select 1 from live_classes lc
        where lc.id = p_lesson_id and lc.batch_id is not null and can_manage_class_batch(lc.batch_id)
      )
    );
$$;

create policy "assignments visible to owner, enrolled students, or admin"
  on assignments for select
  using (can_manage_assignment_content(owner_type, owner_id, batch_id, lesson_id) or is_enrolled(owner_type, owner_id));

create policy "owner manages their own assignments"
  on assignments for insert
  with check (can_manage_assignment_content(owner_type, owner_id, batch_id, lesson_id));

create policy "owner or admin updates an assignment"
  on assignments for update
  using (can_manage_assignment_content(owner_type, owner_id, batch_id, lesson_id))
  with check (can_manage_assignment_content(owner_type, owner_id, batch_id, lesson_id));

create policy "owner or admin deletes an assignment"
  on assignments for delete
  using (can_manage_assignment_content(owner_type, owner_id, batch_id, lesson_id));

create or replace function public.owns_assignment(p_assignment_id uuid)
returns boolean
language sql
stable
as $$
  select can_manage_assignment_content(a.owner_type, a.owner_id, a.batch_id, a.lesson_id)
  from assignments a
  where a.id = p_assignment_id;
$$;

create policy "assignment worksheet readable by anyone who can see its row"
  on storage.objects for select
  using (
    bucket_id = 'assignments'
    and exists (
      select 1 from assignments a
      where a.file_path = storage.objects.name
        and (can_manage_assignment_content(a.owner_type, a.owner_id, a.batch_id, a.lesson_id) or is_enrolled(a.owner_type, a.owner_id))
    )
  );
