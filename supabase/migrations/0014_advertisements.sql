-- Covers all four ad types from 01-Project-Overview.md §11/§14:
-- teacher-level and class-level ads use owner_type/owner_id like every
-- other owned table here; standalone ads (no profile) and site-wide ads
-- (admin-booked) have owner_type in ('standalone','site') with owner_id
-- null, and are instead tied to whoever paid via purchased_by.

create table advertisements (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('teacher', 'class', 'standalone', 'site')),
  owner_id uuid,
  purchased_by uuid references profiles (id),
  title text not null,
  content text,
  placement text not null default 'search_results' check (
    placement in ('own_profile', 'search_results', 'homepage_banner', 'homepage_spotlight')
  ),
  plan text not null check (plan in ('basic', 'featured', 'homepage_spotlight')),
  status text not null default 'active' check (status in ('active', 'expired', 'removed')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (owner_type in ('teacher', 'class') and owner_id is not null)
    or (owner_type in ('standalone', 'site') and owner_id is null)
  )
);

alter table advertisements enable row level security;

create policy "active ads are public; owner/purchaser/admin see all statuses"
  on advertisements for select
  using (
    (status = 'active' and (expires_at is null or expires_at > now()))
    or (owner_type in ('teacher', 'class') and is_owner(owner_type, owner_id))
    or purchased_by = auth.uid()
    or is_admin()
  );

create policy "a user can create an ad they own or purchase"
  on advertisements for insert
  with check (
    (owner_type in ('teacher', 'class') and is_owner(owner_type, owner_id))
    or (owner_type = 'standalone' and purchased_by = auth.uid())
    or (owner_type = 'site' and is_admin())
  );

create policy "owner/purchaser/admin can update an ad"
  on advertisements for update
  using (
    (owner_type in ('teacher', 'class') and is_owner(owner_type, owner_id))
    or purchased_by = auth.uid()
    or is_admin()
  )
  with check (
    (owner_type in ('teacher', 'class') and is_owner(owner_type, owner_id))
    or purchased_by = auth.uid()
    or is_admin()
  );

create policy "owner/purchaser/admin can delete an ad"
  on advertisements for delete
  using (
    (owner_type in ('teacher', 'class') and is_owner(owner_type, owner_id))
    or purchased_by = auth.uid()
    or is_admin()
  );
