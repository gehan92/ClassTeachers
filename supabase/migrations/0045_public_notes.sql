-- Lets a teacher flag a small number of their notes as free previews,
-- viewable by any signed-in account (not just students enrolled with them)
-- — a low-cost way to show off teaching quality before someone requests to
-- join, reusing the existing PDF/watermark/signed-URL pipeline from 0008
-- rather than building a separate content system. Enrollment-gated notes
-- (the default) are completely unaffected; this only adds a new, narrower
-- exception on top of the existing owner/enrolled/admin checks.

alter table notes add column if not exists is_public boolean not null default false;

drop policy if exists "notes visible to owner, enrolled students, or admin" on notes;
drop policy if exists "notes visible to owner, enrolled students, admin, or public" on notes;

create policy "notes visible to owner, enrolled students, admin, or public"
  on notes for select
  using (
    is_owner(owner_type, owner_id)
    or is_enrolled(owner_type, owner_id)
    or is_admin()
    or (is_public and auth.uid() is not null)
  );
