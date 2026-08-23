-- Fixes notes never actually opening for students. The `notes` table's own
-- RLS (0008) already lets an enrolled student (or, since 0045, any signed-in
-- viewer of a public note) see that a note exists — but the *Storage*
-- bucket's RLS (0019) only ever granted read access to the note's owner or
-- an admin. createSignedUrl() is itself subject to storage.objects RLS, so
-- for anyone else it silently failed, which the serving routes
-- ((dashboard)/student/notes/[id]/file and (public)/notes/[id]/file) surface
-- as "Couldn't open this file". This adds a second, additive SELECT policy
-- mirroring the same visibility rule the notes table already enforces,
-- joined on file_path -> storage object name.

create policy "notes storage object readable by anyone who can see its row"
  on storage.objects for select
  using (
    bucket_id = 'notes'
    and exists (
      select 1 from notes n
      where n.file_path = storage.objects.name
        and (
          is_owner(n.owner_type, n.owner_id)
          or is_enrolled(n.owner_type, n.owner_id)
          or is_admin()
          or (n.is_public and auth.uid() is not null)
        )
    )
  );
