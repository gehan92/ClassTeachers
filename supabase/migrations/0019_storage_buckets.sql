-- Storage buckets per 02-Technical-Implementation.md §5. Convention: files
-- are uploaded under a folder named for the owner (`{ownerId}/...` or
-- `{examId}/{studentId}/...`), so storage.foldername(name) can express
-- "only the owner" without a second lookup table.
--
-- `notes` and `submissions` stay private even to their own owner's direct
-- Storage reads for the *serving* path — the app never links straight to
-- them, always through a server route that mints a short-lived signed URL
-- (and, for notes, stamps a watermark first). These policies only cover
-- upload/manage access via the client SDK, not the read-and-render path.

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('notes', 'notes', false),
  ('submissions', 'submissions', false)
on conflict (id) do nothing;

-- avatars: public read, owner-only write, path convention `{userId}/...`
create policy "avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "a user manages their own avatar files"
  on storage.objects for all
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- notes: path convention `{ownerId}/...` (ownerId = teacher's profile id,
-- or a class_profiles id for institute-owned notes)
create policy "note owner or admin manages note files"
  on storage.objects for all
  using (
    bucket_id = 'notes'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_owner('class', ((storage.foldername(name))[1])::uuid)
      or is_admin()
    )
  )
  with check (
    bucket_id = 'notes'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_owner('class', ((storage.foldername(name))[1])::uuid)
      or is_admin()
    )
  );

-- submissions: path convention `{examId}/{studentId}/...`
create policy "submitting student manages their own submission files"
  on storage.objects for all
  using (bucket_id = 'submissions' and (storage.foldername(name))[2] = auth.uid()::text)
  with check (bucket_id = 'submissions' and (storage.foldername(name))[2] = auth.uid()::text);

create policy "exam owner or admin can read submission files"
  on storage.objects for select
  using (
    bucket_id = 'submissions'
    and (owns_exam(((storage.foldername(name))[1])::uuid) or is_admin())
  );
