-- Audit fix (2026-09-23), teacher/institute dashboard round.
--
-- 1) get_roster_student_info()'s WHERE clause used to have no status
--    filter at all (0069) — any relationship, pending included, was
--    enough to resolve a student's name so an owner could see who a
--    request was *from*. 0146's `create or replace` (done only to widen
--    the fee-funnel status check) accidentally tightened the WHERE clause
--    itself to `status in ('accepted','joined')`, so a *pending* request
--    now resolves no name at all — teacher/institute page.tsx's own
--    comment ("any student who has a relationship... accepted or a
--    pending request") documents the behavior the SQL no longer matches.
--    Restoring "any relationship, any status" for name/id visibility,
--    while keeping phone reveal itself correctly restricted to
--    accepted/joined + share_phone_with_teachers (0155) — a pending
--    request should show a name, never contact info.
-- 2) get_managed_batch_student_info() (institute-managed batches) had the
--    same accepted/joined-only restriction for its one and only purpose
--    (not just phone masking) — widening it the same way, for the same
--    reason.
-- 3) open_qna_thread() (0148) stored the student's raw, unmasked phone
--    number as `sender_contact` on the synthetic Q&A inquiry row,
--    regardless of share_phone_with_teachers — and the plain Inquiries
--    tab's query (teacher/institute page.tsx) never excluded
--    enrollment-linked rows, so that contact leaked straight through the
--    general Inquiries list (plus duplicated the thread that's supposed
--    to live only in the Students tab's Q&A section). Contact info must
--    stay locked until the enrollment is actually 'joined' — the Q&A
--    thread's own messaging doesn't need a contact field, so it's just
--    never populated for these rows.

create or replace function public.get_roster_student_info(p_student_ids uuid[])
returns table (id uuid, full_name text, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    case
      when auth.uid() = p.id or is_admin() then p.phone
      when exists (
        select 1 from enrollments e
        where e.student_id = p.id
          and e.status in ('accepted', 'joined')
          and coalesce(p.share_phone_with_teachers, true)
          and (
            (e.owner_type = 'teacher' and e.owner_id = auth.uid())
            or (e.owner_type = 'class' and is_owner('class', e.owner_id))
          )
      ) then p.phone
      else null
    end as phone
  from profiles p
  where p.id = any(p_student_ids)
    and (
      auth.uid() = p.id
      or is_admin()
      or exists (
        select 1 from enrollments e
        where e.student_id = p.id
          and (
            (e.owner_type = 'teacher' and e.owner_id = auth.uid())
            or (e.owner_type = 'class' and is_owner('class', e.owner_id))
          )
      )
    );
$$;

create or replace function public.get_managed_batch_student_info()
returns table (
  enrollment_id uuid,
  student_id uuid,
  full_name text,
  phone text,
  batch_id uuid,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.student_id,
    p.full_name,
    case
      when e.status in ('accepted', 'joined') and coalesce(p.share_phone_with_teachers, true) then p.phone
      else null
    end as phone,
    e.batch_id,
    e.joined_at
  from enrollments e
  join profiles p on p.id = e.student_id
  where e.owner_type = 'class'
    and e.batch_id is not null
    and can_manage_class_batch(e.batch_id);
$$;

create or replace function public.open_qna_thread(p_enrollment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e record;
begin
  select * into e from enrollments where id = p_enrollment_id;
  if not found then
    raise exception 'enrollment_not_found';
  end if;
  if not (is_owner(e.owner_type, e.owner_id) or is_admin()) then
    raise exception 'not_authorized';
  end if;

  if not exists (select 1 from inquiries where enrollment_id = p_enrollment_id) then
    insert into inquiries (owner_type, owner_id, inquirer_id, sender_name, sender_contact, message, enrollment_id)
    select e.owner_type, e.owner_id, e.student_id, coalesce(p.full_name, '—'), '—',
           'Q&A opened for a join request.', p_enrollment_id
    from profiles p where p.id = e.student_id;
  end if;
end;
$$;
