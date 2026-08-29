-- reviews' UPDATE policy (0015) already documents the gap in its own
-- comment: "RLS can't split which columns each side may touch — that's
-- enforced by two separate server actions". That's an app-layer promise
-- only — a direct Supabase call from the reviewed teacher/institute can
-- rewrite the reviewer's own rating/comment, or the reviewer can write
-- reply_text/is_flagged/flagged_reason meant for the reviewed party. Locks
-- both halves with a trigger: the reviewer may only ever change
-- rating/comment, the reviewed party (or admin) only reply_text and the
-- flag fields.

create or replace function public.restrict_review_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() then
    return new;
  end if;

  if new.reviewer_id = auth.uid() then
    if new.reply_text is distinct from old.reply_text
      or new.is_flagged is distinct from old.is_flagged
      or new.flagged_reason is distinct from old.flagged_reason
    then
      raise exception 'You can only edit your own rating and comment.';
    end if;
    return new;
  end if;

  if is_owner(resolve_owner_type(new.target_type), new.target_id) then
    if new.rating is distinct from old.rating or new.comment is distinct from old.comment then
      raise exception 'You can only reply to or flag this review, not edit its rating or comment.';
    end if;
    return new;
  end if;

  raise exception 'You do not have permission to update this review.';
end;
$$;

drop trigger if exists reviews_restrict_update on reviews;
create trigger reviews_restrict_update
  before update on reviews
  for each row execute function restrict_review_update();
