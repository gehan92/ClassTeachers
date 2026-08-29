-- Institute Blueprint, step 3a (database layer). A teacher accepted onto an
-- institute's roster (0091) and assigned to one of its classes via
-- batches.taught_by_teacher_id (0091) still can't do anything with that
-- class today — every content table's RLS gates writes through
-- is_owner(owner_type, owner_id), which only ever means "the institute
-- account itself," never "a teacher this institute assigned." Extending
-- is_owner() directly would be wrong: it's the same function guarding
-- prices, advertisements, and institute settings, none of which a linked
-- teacher should be able to touch just by being assigned one class. This
-- adds two narrow, purpose-built checks instead, and threads them through
-- only the tables a teacher actually needs to run a class: notes, exams,
-- live_classes, question_bank_items, and assignments.
--
-- App-layer changes (which action files let a teacher target an institute
-- batch, and the teacher dashboard surfacing that content) are step 3b, not
-- in this file — this migration only creates the capability at the
-- database level; nothing in the app uses it yet, so nothing changes for
-- any existing user until 3b ships.

-- True only for the specific teacher a batch names, and only while their
-- roster link is still accepted — both taught_by_teacher_id and
-- class_teachers.status are the institute's own doing (0091), so this
-- automatically revokes the moment either one changes (removeTeacherFromRoster
-- deletes the class_teachers row, which sets taught_by_teacher_id to null
-- via its own on-delete-set-null FK; the institute could also flip status
-- itself even though there's no UI for that today).
create or replace function public.can_manage_class_batch(p_batch_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  b_owner_type text;
  b_owner_id uuid;
  b_teacher_id uuid;
begin
  select owner_type, owner_id, taught_by_teacher_id into b_owner_type, b_owner_id, b_teacher_id
  from batches where id = p_batch_id;

  if not found or b_owner_type <> 'class' or b_teacher_id is null or b_teacher_id <> auth.uid() then
    return false;
  end if;

  return exists (
    select 1 from class_teachers ct
    where ct.class_id = b_owner_id and ct.teacher_id = auth.uid() and ct.status = 'accepted'
  );
end;
$$;

-- Deliberately narrower than "any institute content" — batch_id is null for
-- general/institute-wide content (an all-classes announcement note, say),
-- which stays the institute account's own call, not something a teacher
-- assigned to one class of many can create or touch.
create or replace function public.can_manage_content(p_owner_type text, p_owner_id uuid, p_batch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_owner(p_owner_type, p_owner_id)
    or is_admin()
    or (p_owner_type = 'class' and p_batch_id is not null and can_manage_class_batch(p_batch_id));
$$;

-- assignments has no batch_id of its own (0047 chose lesson-level scoping
-- over batch-level deliberately) — resolves through lesson_id's live_class
-- instead of duplicating that design decision with a redundant column.
create or replace function public.can_manage_assignment_content(p_owner_type text, p_owner_id uuid, p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_owner(p_owner_type, p_owner_id)
    or is_admin()
    or (
      p_owner_type = 'class'
      and p_lesson_id is not null
      and exists (
        select 1 from live_classes lc
        where lc.id = p_lesson_id and lc.batch_id is not null and can_manage_class_batch(lc.batch_id)
      )
    );
$$;

-- notes
drop policy if exists "notes visible to owner, enrolled students, or admin" on notes;
create policy "notes visible to owner, enrolled students, or admin"
  on notes for select
  using (can_manage_content(owner_type, owner_id, batch_id) or is_enrolled(owner_type, owner_id));

drop policy if exists "owner manages their own notes" on notes;
create policy "owner manages their own notes"
  on notes for insert
  with check (can_manage_content(owner_type, owner_id, batch_id));

drop policy if exists "owner or admin updates a note" on notes;
create policy "owner or admin updates a note"
  on notes for update
  using (can_manage_content(owner_type, owner_id, batch_id))
  with check (can_manage_content(owner_type, owner_id, batch_id));

drop policy if exists "owner or admin deletes a note" on notes;
create policy "owner or admin deletes a note"
  on notes for delete
  using (can_manage_content(owner_type, owner_id, batch_id));

-- exams
drop policy if exists "exams visible to owner, enrolled students, or admin" on exams;
create policy "exams visible to owner, enrolled students, or admin"
  on exams for select
  using (can_manage_content(owner_type, owner_id, batch_id) or is_enrolled(owner_type, owner_id));

drop policy if exists "owner manages their own exams" on exams;
create policy "owner manages their own exams"
  on exams for insert
  with check (can_manage_content(owner_type, owner_id, batch_id));

drop policy if exists "owner or admin updates an exam" on exams;
create policy "owner or admin updates an exam"
  on exams for update
  using (can_manage_content(owner_type, owner_id, batch_id))
  with check (can_manage_content(owner_type, owner_id, batch_id));

drop policy if exists "owner or admin deletes an exam" on exams;
create policy "owner or admin deletes an exam"
  on exams for delete
  using (can_manage_content(owner_type, owner_id, batch_id));

-- live_classes (schedule itself is public; only the write policy narrows)
drop policy if exists "owner manages their own live classes" on live_classes;
create policy "owner manages their own live classes"
  on live_classes for all
  using (can_manage_content(owner_type, owner_id, batch_id))
  with check (can_manage_content(owner_type, owner_id, batch_id));

drop policy if exists "join link visible to owner, enrolled students, or admin" on live_class_links;
create policy "join link visible to owner, enrolled students, or admin"
  on live_class_links for select
  using (
    exists (
      select 1 from live_classes lc
      where lc.id = live_class_id
        and (can_manage_content(lc.owner_type, lc.owner_id, lc.batch_id) or is_enrolled(lc.owner_type, lc.owner_id))
    )
  );

drop policy if exists "owner manages their own join links" on live_class_links;
create policy "owner manages their own join links"
  on live_class_links for all
  using (exists (select 1 from live_classes lc where lc.id = live_class_id and can_manage_content(lc.owner_type, lc.owner_id, lc.batch_id)))
  with check (exists (select 1 from live_classes lc where lc.id = live_class_id and can_manage_content(lc.owner_type, lc.owner_id, lc.batch_id)));

-- question_bank_items (single "for all" policy, unlike the split tables above)
drop policy if exists "question bank is owner/admin only" on question_bank_items;
create policy "question bank is owner/admin only"
  on question_bank_items for all
  using (can_manage_content(owner_type, owner_id, batch_id))
  with check (can_manage_content(owner_type, owner_id, batch_id));

-- get_my_question_answers (0085) still only checked is_owner() — a linked
-- teacher could now see/edit their assigned batch's questions via RLS above
-- but never their own answer keys, which would make authoring genuinely
-- broken rather than just incomplete.
create or replace function public.get_my_question_answers()
returns table (id uuid, correct_option_id text, correct_option_ids text[], sample_answer text)
language sql
stable
security definer
set search_path = public
as $$
  select qbi.id, qbi.correct_option_id, qbi.correct_option_ids, qbi.sample_answer
  from question_bank_items qbi
  where can_manage_content(qbi.owner_type, qbi.owner_id, qbi.batch_id);
$$;

-- assignments
drop policy if exists "assignments visible to owner, enrolled students, or admin" on assignments;
create policy "assignments visible to owner, enrolled students, or admin"
  on assignments for select
  using (can_manage_assignment_content(owner_type, owner_id, lesson_id) or is_enrolled(owner_type, owner_id));

drop policy if exists "owner manages their own assignments" on assignments;
create policy "owner manages their own assignments"
  on assignments for insert
  with check (can_manage_assignment_content(owner_type, owner_id, lesson_id));

drop policy if exists "owner or admin updates an assignment" on assignments;
create policy "owner or admin updates an assignment"
  on assignments for update
  using (can_manage_assignment_content(owner_type, owner_id, lesson_id))
  with check (can_manage_assignment_content(owner_type, owner_id, lesson_id));

drop policy if exists "owner or admin deletes an assignment" on assignments;
create policy "owner or admin deletes an assignment"
  on assignments for delete
  using (can_manage_assignment_content(owner_type, owner_id, lesson_id));

-- owns_assignment (0047) backs assignment_submissions' select/update
-- policies and the grading-lock trigger (0082) — updating it alone extends
-- grading access to a linked teacher for their assigned lesson's
-- submissions without needing to touch assignment_submissions' own
-- policies or 0082's trigger at all.
create or replace function public.owns_assignment(p_assignment_id uuid)
returns boolean
language sql
stable
as $$
  select can_manage_assignment_content(a.owner_type, a.owner_id, a.lesson_id)
  from assignments a
  where a.id = p_assignment_id;
$$;

-- Storage (0019/0046/0048/0052): upload paths are keyed by folder = ownerId
-- only ({ownerId}/...), with no batch segment in the path at all, so a
-- storage-level check can only ever be institute-wide, not batch-scoped
-- the way the table RLS above is. A linked teacher passing this can upload
-- into any of their linked institute's folders; whether they can actually
-- create a *row* pointing at that file is still gated per-batch by the
-- table policies above — an upload with no matching row is inert, same
-- class of harmless orphan this schema already tolerates elsewhere (e.g.
-- ON DELETE SET NULL leaving a note/exam with batch_id null).
create or replace function public.is_linked_teacher(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from class_teachers
    where class_id = p_class_id and teacher_id = auth.uid() and status = 'accepted'
  );
$$;

drop policy if exists "note owner or admin manages note files" on storage.objects;
create policy "note owner or admin manages note files"
  on storage.objects for all
  using (
    bucket_id = 'notes'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_owner('class', ((storage.foldername(name))[1])::uuid)
      or is_linked_teacher(((storage.foldername(name))[1])::uuid)
      or is_admin()
    )
  )
  with check (
    bucket_id = 'notes'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_owner('class', ((storage.foldername(name))[1])::uuid)
      or is_linked_teacher(((storage.foldername(name))[1])::uuid)
      or is_admin()
    )
  );

drop policy if exists "notes storage object readable by anyone who can see its row" on storage.objects;
create policy "notes storage object readable by anyone who can see its row"
  on storage.objects for select
  using (
    bucket_id = 'notes'
    and exists (
      select 1 from notes n
      where n.file_path = storage.objects.name
        and (
          can_manage_content(n.owner_type, n.owner_id, n.batch_id)
          or is_enrolled(n.owner_type, n.owner_id)
          or (n.is_public and auth.uid() is not null)
        )
    )
  );

drop policy if exists "assignment owner or admin manages worksheet files" on storage.objects;
create policy "assignment owner or admin manages worksheet files"
  on storage.objects for all
  using (
    bucket_id = 'assignments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_owner('class', ((storage.foldername(name))[1])::uuid)
      or is_linked_teacher(((storage.foldername(name))[1])::uuid)
      or is_admin()
    )
  )
  with check (
    bucket_id = 'assignments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_owner('class', ((storage.foldername(name))[1])::uuid)
      or is_linked_teacher(((storage.foldername(name))[1])::uuid)
      or is_admin()
    )
  );

drop policy if exists "assignment worksheet readable by anyone who can see its row" on storage.objects;
create policy "assignment worksheet readable by anyone who can see its row"
  on storage.objects for select
  using (
    bucket_id = 'assignments'
    and exists (
      select 1 from assignments a
      where a.file_path = storage.objects.name
        and (can_manage_assignment_content(a.owner_type, a.owner_id, a.lesson_id) or is_enrolled(a.owner_type, a.owner_id))
    )
  );

drop policy if exists "question image owner or admin manages files" on storage.objects;
create policy "question image owner or admin manages files"
  on storage.objects for all
  using (
    bucket_id = 'question-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_owner('class', ((storage.foldername(name))[1])::uuid)
      or is_linked_teacher(((storage.foldername(name))[1])::uuid)
      or is_admin()
    )
  )
  with check (
    bucket_id = 'question-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_owner('class', ((storage.foldername(name))[1])::uuid)
      or is_linked_teacher(((storage.foldername(name))[1])::uuid)
      or is_admin()
    )
  );

drop policy if exists "question image readable by anyone who can see its question" on storage.objects;
create policy "question image readable by anyone who can see its question"
  on storage.objects for select
  using (
    bucket_id = 'question-images'
    and exists (
      select 1 from question_bank_items q
      where q.id = ((storage.foldername(name))[2])::uuid
        and (can_manage_content(q.owner_type, q.owner_id, q.batch_id) or is_enrolled(q.owner_type, q.owner_id))
    )
  );
