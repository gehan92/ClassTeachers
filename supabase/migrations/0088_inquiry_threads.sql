-- Growth Plan item 3: inquiries.reply (0042) is a single column — one reply,
-- ever — and nothing ever let the *inquirer* read their own inquiry back
-- (0037's SELECT policy only covers the owner/admin), even when they're
-- signed in and inquirer_id already identifies them. That made "reply"
-- effectively write-only from the sender's side: a teacher could write a
-- reply that the person who asked could never see.
--
-- This opens a real thread for the case that's actually fixable: a signed-in
-- inquirer. A guest with no account (inquirer_id null) still has nowhere to
-- receive a reply — that needs forced sign-in to inquire, or real email
-- notifications (blocked on the SMTP setup already flagged separately) —
-- out of scope here. Their experience is unchanged: the owner can still
-- write a one-time reply-equivalent as the thread's first message, it's
-- just that only a signed-in sender will ever see it.

create table inquiry_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references inquiries (id) on delete cascade,
  sender_role text not null check (sender_role in ('owner', 'inquirer')),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

alter table inquiry_messages enable row level security;

create policy "owner, inquirer, or admin can view thread messages"
  on inquiry_messages for select
  using (
    exists (
      select 1 from inquiries i
      where i.id = inquiry_messages.inquiry_id
        and (
          (i.owner_type = 'teacher' and auth.uid() = i.owner_id)
          or (i.owner_type = 'class' and is_owner('class', i.owner_id))
          or i.inquirer_id = auth.uid()
          or is_admin()
        )
    )
  );

-- sender_role must match who the caller actually is relative to the
-- inquiry — a student can't post as 'owner' and vice versa.
create policy "owner or inquirer can send a thread message as themselves"
  on inquiry_messages for insert
  with check (
    is_admin()
    or exists (
      select 1 from inquiries i
      where i.id = inquiry_messages.inquiry_id
        and (
          (
            sender_role = 'owner'
            and (
              (i.owner_type = 'teacher' and auth.uid() = i.owner_id)
              or (i.owner_type = 'class' and is_owner('class', i.owner_id))
            )
          )
          or (sender_role = 'inquirer' and i.inquirer_id = auth.uid())
        )
    )
  );

-- inquirer_id (0037) never actually granted the inquirer read access to
-- their own row — fixed here so a signed-in sender can find their inquiry
-- and its thread at all.
drop policy if exists "owner or admin can view their inquiries" on inquiries;
create policy "owner, inquirer, or admin can view their inquiries"
  on inquiries for select
  using (
    (owner_type = 'teacher' and auth.uid() = owner_id)
    or (owner_type = 'class' and is_owner('class', owner_id))
    or inquirer_id = auth.uid()
    or is_admin()
  );

-- The inquirer also needs to flip `status` back to 'new' when they send a
-- follow-up (sendInquirerMessage, inquiries-actions.ts) — otherwise the
-- owner's badge/bell stays on "read" forever after their first reply, and
-- they'd never notice a new message arrived. Locked to just that one
-- column via a trigger, same shape used repeatedly in this schema (0080,
-- 0082-0084, 0086, 0087) — an inquirer touching any other column (message,
-- sender_contact, owner_id, ...) is rejected.
create or replace function public.restrict_inquiry_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() then
    return new;
  end if;

  if (new.owner_type = 'teacher' and auth.uid() = new.owner_id)
    or (new.owner_type = 'class' and is_owner('class', new.owner_id))
  then
    return new;
  end if;

  if old.inquirer_id = auth.uid() then
    if new.owner_type = old.owner_type
      and new.owner_id = old.owner_id
      and new.inquirer_id is not distinct from old.inquirer_id
      and new.sender_name = old.sender_name
      and new.sender_contact = old.sender_contact
      and new.message = old.message
      and new.created_at = old.created_at
    then
      return new;
    end if;
    raise exception 'You can only update the status of your own inquiry.';
  end if;

  raise exception 'You do not have permission to update this inquiry.';
end;
$$;

drop trigger if exists inquiries_restrict_update on inquiries;
create trigger inquiries_restrict_update
  before update on inquiries
  for each row execute function restrict_inquiry_update();

drop policy if exists "owner or admin can update their inquiries" on inquiries;
create policy "owner, inquirer, or admin can update their inquiries"
  on inquiries for update
  using (
    (owner_type = 'teacher' and auth.uid() = owner_id)
    or (owner_type = 'class' and is_owner('class', owner_id))
    or inquirer_id = auth.uid()
    or is_admin()
  )
  with check (
    (owner_type = 'teacher' and auth.uid() = owner_id)
    or (owner_type = 'class' and is_owner('class', owner_id))
    or inquirer_id = auth.uid()
    or is_admin()
  );

-- Carry over any existing single reply as the thread's first owner message
-- before dropping the columns it lived on. replied_at was write-only (never
-- read anywhere in the app) — created_at on the new per-message row replaces
-- it, more precisely.
insert into inquiry_messages (inquiry_id, sender_role, body, created_at)
select id, 'owner', reply, coalesce(replied_at, created_at)
from inquiries
where reply is not null and length(trim(reply)) > 0;

alter table inquiries drop column reply;
alter table inquiries drop column replied_at;
