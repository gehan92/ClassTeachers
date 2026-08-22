-- Phase 1 of the ad-driven discovery model: advertisements become scopable
-- to a specific batch (and the subject that batch teaches) instead of only
-- the whole teacher/class profile, and enrollments gain an approval step
-- instead of being instant on insert. This migration is schema-only and
-- deliberately non-breaking on its own — no application code writes
-- status='pending' yet, so every row (existing and new) stays 'accepted'
-- and today's instant-join behavior is unaffected until the join-request UI
-- (a later migration/PR) starts inserting pending rows on purpose.

-- Existing owner_id/owner_type still identify who the ad belongs to;
-- batch_id narrows a 'search_results' ad to one specific class of theirs.
-- subject_id is denormalized from the batch for cheap search filtering.
-- 'own_profile' promo-box ads are untouched — both columns stay null there.
alter table advertisements add column if not exists subject_id uuid references subjects (id) on delete set null;
alter table advertisements add column if not exists batch_id uuid references batches (id) on delete cascade;

-- One active search-results ad per batch.
create unique index if not exists advertisements_one_active_per_batch
  on advertisements (batch_id)
  where placement = 'search_results' and status = 'active' and batch_id is not null;

-- Approval state for a join. Defaults to 'accepted' (not 'pending') so this
-- column addition can't retroactively lock out anyone already enrolled, or
-- anyone who joins before the request-and-accept UI ships.
alter table enrollments add column if not exists status text not null default 'accepted';
alter table enrollments drop constraint if exists enrollments_status_check;
alter table enrollments add constraint enrollments_status_check
  check (status in ('pending', 'accepted', 'declined'));

-- The owner (teacher, or institute for a 'class' enrollment) can now accept
-- or decline a request. No policy existed for updating this table before.
drop policy if exists "owner can update enrollment status; admin can too" on enrollments;
create policy "owner can update enrollment status; admin can too"
  on enrollments for update
  using (is_owner(owner_type, owner_id) or is_admin())
  with check (is_owner(owner_type, owner_id) or is_admin());

-- Contact info, notes access, review rights etc. all read is_enrolled() —
-- updating it here is what makes "pending" actually mean something once
-- something starts inserting pending rows.
create or replace function public.is_enrolled(p_owner_type text, p_owner_id uuid)
returns boolean
language plpgsql
stable
as $$
begin
  return exists (
    select 1 from enrollments
    where student_id = auth.uid()
      and owner_type = p_owner_type
      and owner_id = p_owner_id
      and status = 'accepted'
  );
end;
$$;

-- Same tightening for the roster name/phone lookup (0032), which inlines
-- its own enrollment check rather than calling is_enrolled().
create or replace function public.get_roster_student_info(p_student_ids uuid[])
returns table (id uuid, full_name text, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.phone
  from profiles p
  where p.id = any(p_student_ids)
    and (
      auth.uid() = p.id
      or is_admin()
      or exists (
        select 1 from enrollments e
        where e.student_id = p.id
          and e.status = 'accepted'
          and (
            (e.owner_type = 'teacher' and e.owner_id = auth.uid())
            or (e.owner_type = 'class' and is_owner('class', e.owner_id))
          )
      )
    );
$$;

grant execute on function public.get_roster_student_info(uuid[]) to authenticated;
