-- Question images get their own bucket. Path shape is
-- {ownerId}/{questionId}/{filename} — one question can have a stem image
-- plus one image per MCQ option, all living under the same question
-- folder, so the read policy joins on folder[2] (the question id) rather
-- than an exact file_path column the way notes/assignments do (0046/0048).
-- Built with the owner+enrolled+admin read policy from day one, same
-- lesson as the assignments bucket (0048) — the notes bucket (0008/0019)
-- shipped owner-only and had to be patched later (0046) once students
-- actually tried to open one.

insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', false)
on conflict (id) do nothing;

create policy "question image owner or admin manages files"
  on storage.objects for all
  using (
    bucket_id = 'question-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_owner('class', ((storage.foldername(name))[1])::uuid)
      or is_admin()
    )
  )
  with check (
    bucket_id = 'question-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_owner('class', ((storage.foldername(name))[1])::uuid)
      or is_admin()
    )
  );

create policy "question image readable by anyone who can see its question"
  on storage.objects for select
  using (
    bucket_id = 'question-images'
    and exists (
      select 1 from question_bank_items q
      where q.id = ((storage.foldername(name))[2])::uuid
        and (is_owner(q.owner_type, q.owner_id) or is_enrolled(q.owner_type, q.owner_id) or is_admin())
    )
  );
