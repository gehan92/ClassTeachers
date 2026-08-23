-- Worksheet PDFs get their own bucket. Submission photos reuse the existing
-- `submissions` bucket (0019) — its student-manages-own-files policy is
-- already generic on path shape ({entityId}/{studentId}/...) regardless of
-- entity type, so only a new read policy for the assignment owner is
-- needed there. Unlike notes' storage policy (0008/0019), which only
-- granted the owner read access and needed a follow-up fix (0046) once
-- students actually tried to open one, the assignments bucket gets its
-- owner+enrolled+admin read policy from day one.

insert into storage.buckets (id, name, public)
values ('assignments', 'assignments', false)
on conflict (id) do nothing;

create policy "assignment owner or admin manages worksheet files"
  on storage.objects for all
  using (
    bucket_id = 'assignments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_owner('class', ((storage.foldername(name))[1])::uuid)
      or is_admin()
    )
  )
  with check (
    bucket_id = 'assignments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_owner('class', ((storage.foldername(name))[1])::uuid)
      or is_admin()
    )
  );

create policy "assignment worksheet readable by anyone who can see its row"
  on storage.objects for select
  using (
    bucket_id = 'assignments'
    and exists (
      select 1 from assignments a
      where a.file_path = storage.objects.name
        and (is_owner(a.owner_type, a.owner_id) or is_enrolled(a.owner_type, a.owner_id) or is_admin())
    )
  );

create policy "assignment owner or admin can read submission files"
  on storage.objects for select
  using (
    bucket_id = 'submissions'
    and (owns_assignment(((storage.foldername(name))[1])::uuid) or is_admin())
  );
