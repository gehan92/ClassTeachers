-- Institute Blueprint, step 1 (the foundational fix everything else in that
-- proposal depends on): class_teachers already links a teacher into an
-- institute's roster, but addTeacherToRoster() inserts it as an instant,
-- unilateral fact — the teacher never sees or agrees to it. And separately,
-- batches.teacher_label (who actually teaches an institute-owned class) is
-- free text an institute admin types, not a reference to that roster at
-- all — confirmed by 0020's own comment that this was deferred pending "the
-- teacher-invite flow, which isn't built yet." This migration is that
-- invite flow, plus the real link batches were always missing.

-- A pending row is invisible on the public roster already (is_visible
-- defaults true, but nothing shows a not-yet-accepted teacher as a fact of
-- the institute until this migration's UI changes stop rendering it that
-- way) — existing rows default to 'accepted' so every teacher already
-- linked today stays exactly as linked as they were yesterday.
alter table class_teachers
  add column if not exists status text not null default 'accepted'
  check (status in ('pending', 'accepted', 'declined'));

-- The institute already fully controls this table ("class owner manages its
-- teacher links", 0006). This adds the other side: the invited teacher may
-- update their own row, but the trigger below only lets that update be a
-- reply to the invite (pending -> accepted/declined) — never a change to
-- is_visible, joined_at, or which institute/teacher the row even names.
create policy "teacher responds to their own roster invite"
  on class_teachers for update
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create or replace function public.restrict_class_teacher_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_owner('class', new.class_id) or is_admin() then
    return new;
  end if;

  if old.teacher_id = auth.uid() then
    if new.class_id is distinct from old.class_id
      or new.teacher_id is distinct from old.teacher_id
      or new.is_visible is distinct from old.is_visible
      or new.joined_at is distinct from old.joined_at
      or old.status is distinct from 'pending'
      or new.status not in ('accepted', 'declined')
    then
      raise exception 'You can only accept or decline a pending invite.';
    end if;
    return new;
  end if;

  raise exception 'You do not have permission to update this link.';
end;
$$;

drop trigger if exists class_teachers_restrict_update on class_teachers;
create trigger class_teachers_restrict_update
  before update on class_teachers
  for each row execute function restrict_class_teacher_update();

-- The actual missing link: which roster teacher runs a given institute-
-- owned class. Nullable — a teacher-owned batch has no use for this (the
-- owner already is the teacher), and an institute batch may still be typed
-- as free text (teacher_label kept, not dropped) until re-saved through the
-- new picker, so nothing existing breaks.
alter table batches
  add column if not exists taught_by_teacher_id uuid references teacher_profiles (id) on delete set null;
