-- target_type 'teacher_in_class' (a review of one teacher within an
-- institute, kept separate from that teacher's standalone reviews per
-- 01-Project-Overview.md §8) still checks enrollment against the teacher
-- (target_id is the teacher's id in that case) since that's who the
-- student actually joined.

create table reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references profiles (id) on delete cascade,
  target_type text not null check (target_type in ('teacher', 'class', 'teacher_in_class')),
  target_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  reply_text text,
  is_flagged boolean not null default false,
  flagged_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reviewer_id, target_type, target_id)
);

alter table reviews enable row level security;

create trigger reviews_set_updated_at
  before update on reviews
  for each row execute function set_updated_at();

create policy "reviews are public"
  on reviews for select
  using (true);

-- Only students who've actually joined can review — prevents fake reviews
-- (01-Project-Overview.md §8).
create policy "an enrolled student can review what they joined"
  on reviews for insert
  with check (
    reviewer_id = auth.uid()
    and is_enrolled(resolve_owner_type(target_type), target_id)
  );

-- The reviewer edits their own rating/comment; the reviewed
-- teacher/institute (or admin) posts the public reply. RLS can't split
-- which *columns* each side may touch — that's enforced by two separate
-- server actions (editReview vs replyToReview) that each only ever send
-- their own column, not by relaxing this policy further.
create policy "reviewer or reviewed party can update a review"
  on reviews for update
  using (
    reviewer_id = auth.uid()
    or is_owner(resolve_owner_type(target_type), target_id)
    or is_admin()
  )
  with check (
    reviewer_id = auth.uid()
    or is_owner(resolve_owner_type(target_type), target_id)
    or is_admin()
  );

-- Moderation ("Remove" in Admin -> Flagged Reviews) is admin-only; a
-- reviewer cannot delete their own review through this policy (matches the
-- prototype, which only exposes Keep/Remove to admins).
create policy "only admin deletes a review"
  on reviews for delete
  using (is_admin());
