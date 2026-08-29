-- Institute Blueprint, step 2: enrollments' unique (student_id, owner_type,
-- owner_id) (0013) means a student can hold exactly one relationship with a
-- given institute, full stop — there's structurally nowhere for "join a
-- second class at the same institute" to go. is_enrolled() (0039) is a pure
-- EXISTS check, unaffected either way, so this only needed the uniqueness
-- rule itself to change, not the access-control function every other
-- feature (notes/exams/assignments/live-classes/reviews/contact) already
-- calls through it.
--
-- Deliberately scoped to institutes only. Teacher-owned enrollments keep
-- their exact old one-relationship-per-teacher behavior — nothing in what
-- Gehan described needed a student joining the same independent teacher
-- twice, and loosening it there too would have meant auditing every
-- teacher-side student count/roster query for the same double-counting risk
-- this migration already had to fix on the institute side (see the app-code
-- changes alongside this file). Widen this later if a real need for it
-- shows up.

alter table enrollments
  drop constraint if exists enrollments_student_id_owner_type_owner_id_key;

-- Teacher case: identical to the constraint just dropped, restated as a
-- partial index so it applies to owner_type='teacher' rows only.
create unique index if not exists enrollments_teacher_student_key
  on enrollments (student_id, owner_id)
  where owner_type = 'teacher';

-- Institute case: one row per (student, institute, batch) instead of per
-- (student, institute) — coalesce guards the batch_id IS NULL case, since
-- Postgres treats NULL as distinct from NULL and a plain multi-column
-- unique index would silently let a student accumulate duplicate
-- unscoped-institute enrollment rows.
create unique index if not exists enrollments_class_student_batch_key
  on enrollments (student_id, owner_id, coalesce(batch_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where owner_type = 'class';

-- rejoin_after_decline (0066) looked up "the" existing row for a (student,
-- owner) pair — correct when there could only ever be one, wrong now that
-- an institute join can have several. Scoped to batch_id for the class
-- case only; the teacher branch is untouched (still owner-level, matching
-- the partial index above).
create or replace function public.rejoin_after_decline(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b_owner_type text;
  b_owner_id uuid;
  existing_id uuid;
  existing_status text;
  new_status text;
begin
  select owner_type, owner_id into b_owner_type, b_owner_id
  from batches where id = p_batch_id;
  if not found then
    raise exception 'class_not_found';
  end if;

  new_status := case when b_owner_type = 'teacher' then 'pending' else 'accepted' end;

  if b_owner_type = 'class' then
    select id, status into existing_id, existing_status
    from enrollments
    where student_id = auth.uid() and owner_type = b_owner_type and owner_id = b_owner_id and batch_id = p_batch_id;
  else
    select id, status into existing_id, existing_status
    from enrollments
    where student_id = auth.uid() and owner_type = b_owner_type and owner_id = b_owner_id;
  end if;

  if existing_id is null then
    insert into enrollments (student_id, owner_type, owner_id, batch_id, status)
    values (auth.uid(), b_owner_type, b_owner_id, p_batch_id, new_status);
    return;
  end if;

  if existing_status <> 'declined' then
    raise exception 'already_requested';
  end if;

  update enrollments
  set batch_id = p_batch_id, status = new_status, joined_at = now()
  where id = existing_id;
end;
$$;
