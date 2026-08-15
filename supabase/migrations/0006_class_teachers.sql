-- Links an individual teacher into an institute. `is_visible` backs the
-- Institute Dashboard's per-teacher toggle switch (e.g. teacher on leave)
-- without unlinking them (03-Full-Scenarios-Feature-Coverage.md §9).

create table class_teachers (
  class_id uuid not null references class_profiles (id) on delete cascade,
  teacher_id uuid not null references teacher_profiles (id) on delete cascade,
  is_visible boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (class_id, teacher_id)
);

alter table class_teachers enable row level security;

create policy "visible links are public; owner/teacher/admin see all"
  on class_teachers for select
  using (
    is_visible
    or is_owner('class', class_id)
    or teacher_id = auth.uid()
    or is_admin()
  );

create policy "class owner manages its teacher links"
  on class_teachers for all
  using (is_owner('class', class_id) or is_admin())
  with check (is_owner('class', class_id) or is_admin());
