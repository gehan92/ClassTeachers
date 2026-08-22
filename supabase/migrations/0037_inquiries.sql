-- "Message" on PriceBox (src/components/features/price-box.tsx) has always
-- been a dead button with no onClick — the reference model Gehan pointed to
-- (findtutors.co.uk) never exposes a tutor's phone number to a browsing
-- visitor at all; first contact goes through a lead-capture form instead.
-- This adds that as a genuinely new capability, additive to (not replacing)
-- the existing enrollment-gated phone reveal (get_teacher_contact/
-- get_class_contact) — an inquiry is how someone who *hasn't* enrolled yet
-- gets a first response.
--
-- Visitors can submit without an account (confirmed with Gehan), so this
-- can't follow the usual "every action requires auth.getUser()" pattern —
-- it's the first anon-writable path in this schema. Rather than an open
-- RLS insert policy (which would need its own basic-abuse guard duplicated
-- at the app layer), the only way to write a row is through submit_inquiry()
-- below: a SECURITY DEFINER function that rejects an obvious spam pattern
-- (same sender contacting the same target again within 10 minutes) before
-- inserting. There is deliberately no other INSERT policy on this table.

create table inquiries (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('teacher', 'class')),
  owner_id uuid not null,
  inquirer_id uuid references profiles (id) on delete set null,
  sender_name text not null check (length(trim(sender_name)) > 0),
  sender_contact text not null check (length(trim(sender_contact)) > 0),
  message text not null check (length(trim(message)) > 0),
  status text not null default 'new' check (status in ('new', 'read')),
  created_at timestamptz not null default now()
);

alter table inquiries enable row level security;

create policy "owner or admin can view their inquiries"
  on inquiries for select
  using (
    (owner_type = 'teacher' and auth.uid() = owner_id)
    or (owner_type = 'class' and is_owner('class', owner_id))
    or is_admin()
  );

create policy "owner or admin can update their inquiries"
  on inquiries for update
  using (
    (owner_type = 'teacher' and auth.uid() = owner_id)
    or (owner_type = 'class' and is_owner('class', owner_id))
    or is_admin()
  )
  with check (
    (owner_type = 'teacher' and auth.uid() = owner_id)
    or (owner_type = 'class' and is_owner('class', owner_id))
    or is_admin()
  );

create policy "owner or admin can delete their inquiries"
  on inquiries for delete
  using (
    (owner_type = 'teacher' and auth.uid() = owner_id)
    or (owner_type = 'class' and is_owner('class', owner_id))
    or is_admin()
  );

create or replace function public.submit_inquiry(
  p_owner_type text,
  p_owner_id uuid,
  p_sender_name text,
  p_sender_contact text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_owner_type not in ('teacher', 'class') then
    raise exception 'invalid_owner_type';
  end if;

  if exists (
    select 1 from inquiries
    where owner_type = p_owner_type
      and owner_id = p_owner_id
      and sender_contact = trim(p_sender_contact)
      and created_at > now() - interval '10 minutes'
  ) then
    raise exception 'duplicate_inquiry';
  end if;

  insert into inquiries (owner_type, owner_id, inquirer_id, sender_name, sender_contact, message)
  values (p_owner_type, p_owner_id, auth.uid(), trim(p_sender_name), trim(p_sender_contact), trim(p_message));
end;
$$;

grant execute on function public.submit_inquiry(text, uuid, text, text, text) to anon, authenticated;
