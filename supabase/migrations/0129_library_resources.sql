-- Institute dashboard's Library tab -- a digital resource library (staff
-- upload PDFs, track views), not a physical book-lending catalog. Mirrors
-- the existing `notes` table's shape/visibility, plus a view counter (same
-- pattern as advertisements.view_count, 0122). Kept as its own table rather
-- than folding into `notes` since it's a school-wide resource shelf, not
-- tied to one teacher's own class content.
create table library_resources (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('class')),
  owner_id uuid not null,
  title text not null,
  description text,
  category text,
  file_path text not null,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index library_resources_owner_idx on library_resources (owner_type, owner_id, created_at desc);

alter table library_resources enable row level security;

-- Same visibility rule as notes/announcements/every other content table:
-- the owner (or admin) always sees their own; an enrolled student sees it
-- once actually accepted.
create policy "library resources visible to owner, enrolled students, or admin"
  on library_resources for select
  using (is_owner(owner_type, owner_id) or is_admin() or is_enrolled(owner_type, owner_id));

create policy "owner manages their own library resources"
  on library_resources for insert
  with check (is_owner(owner_type, owner_id));

create policy "owner or admin updates a library resource"
  on library_resources for update
  using (is_owner(owner_type, owner_id) or is_admin())
  with check (is_owner(owner_type, owner_id) or is_admin());

create policy "owner or admin deletes a library resource"
  on library_resources for delete
  using (is_owner(owner_type, owner_id) or is_admin());

-- Security definer so any visitor who can already see the row (RLS above)
-- can bump its counter without a table-level UPDATE grant -- same reasoning
-- as increment_ad_view (0122).
create or replace function public.increment_library_resource_view(p_resource_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update library_resources
  set view_count = view_count + 1
  where id = p_resource_id
    and (is_owner(owner_type, owner_id) or is_admin() or is_enrolled(owner_type, owner_id));
end;
$$;

grant execute on function public.increment_library_resource_view(uuid) to authenticated;

-- Public bucket: these are general school resources meant for open access
-- within the app (unlike `notes`/`submissions`, which stay private and are
-- served through a signed-URL route) -- a direct URL is fine here, same
-- tradeoff as `avatars`.
insert into storage.buckets (id, name, public)
values ('library', 'library', true)
on conflict (id) do nothing;

create policy "library resource files are publicly readable"
  on storage.objects for select
  using (bucket_id = 'library');

create policy "library resource owner or admin manages their files"
  on storage.objects for all
  using (
    bucket_id = 'library'
    and (is_owner('class', ((storage.foldername(name))[1])::uuid) or is_admin())
  )
  with check (
    bucket_id = 'library'
    and (is_owner('class', ((storage.foldername(name))[1])::uuid) or is_admin())
  );
