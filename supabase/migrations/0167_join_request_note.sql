-- 0167: keep the note a signed-in student writes when asking to join a class.
--
-- The ad page's "Request to join" box always asked for "a note for the
-- teacher", but requestToJoin only called rejoin_after_decline(batch), which
-- has nowhere to put it — the note was silently thrown away. This adds a
-- column for it and a narrow function that lets a student attach a note to
-- their OWN pending request (nothing else). rejoin_after_decline itself is
-- left untouched.
--
-- Safe to run more than once.

alter table public.enrollments add column if not exists request_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'enrollments_request_note_length'
  ) then
    alter table public.enrollments
      add constraint enrollments_request_note_length check (request_note is null or char_length(request_note) <= 500);
  end if;
end;
$$;

drop function if exists public.set_join_request_note(uuid, text);

create function public.set_join_request_note(p_batch_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b_owner_type text;
  b_owner_id uuid;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;

  select owner_type, owner_id into b_owner_type, b_owner_id from batches where id = p_batch_id;
  if not found then
    raise exception 'class_not_found';
  end if;

  -- Same row rejoin_after_decline just created or reopened: the caller's
  -- own request, and only while it is still waiting for an answer.
  update enrollments
  set request_note = v_note
  where student_id = auth.uid()
    and owner_type = b_owner_type
    and owner_id = b_owner_id
    and status = 'pending'
    and (b_owner_type <> 'class' or batch_id = p_batch_id);
end;
$$;

revoke execute on function public.set_join_request_note(uuid, text) from public, anon;
grant execute on function public.set_join_request_note(uuid, text) to authenticated;
