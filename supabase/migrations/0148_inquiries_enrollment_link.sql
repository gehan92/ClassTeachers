-- Links a Q&A thread (Flow A/B step 2) to the specific join request it
-- belongs to, instead of building new thread UI — reuses the existing
-- inquiries/inquiry_messages system (0037/0088) as-is. Nullable + on delete
-- set null: a general anonymous inquiry that never became a request has no
-- enrollment to point at.
alter table inquiries add column if not exists enrollment_id uuid references enrollments (id) on delete set null;

create index if not exists inquiries_enrollment_id_idx on inquiries (enrollment_id) where enrollment_id is not null;

-- respondToJoinRequest (app code) calls this right after moving an
-- enrollment to 'qna_open', so the Q&A thread exists from the moment the
-- student can see it. Kept as its own SECURITY DEFINER function (not
-- inlined as a plain insert) so the "does a thread already exist for this
-- enrollment" idempotency check can't be skipped by a future caller doing
-- a plain .insert().
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
    select e.owner_type, e.owner_id, e.student_id, coalesce(p.full_name, '—'), coalesce(p.phone, '—'),
           'Q&A opened for a join request.', p_enrollment_id
    from profiles p where p.id = e.student_id;
  end if;
end;
$$;

grant execute on function public.open_qna_thread(uuid) to authenticated;
