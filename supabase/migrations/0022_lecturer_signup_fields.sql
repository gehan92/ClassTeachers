-- Campus Lecturer signup collects a first slice of the profile immediately
-- (src/components/features/lecturer-fields.tsx) instead of leaving it empty
-- until the teacher dashboard is edited later. institution/academic_title
-- are new, nullable, and unused by the other three signup roles.
alter table teacher_profiles
  add column if not exists institution text,
  add column if not exists academic_title text;

-- Signup asks for a free-text "Subject / course area" rather than picking
-- from the existing controlled taxonomy (inserting into subjects is
-- admin-only, see 0007) — a brand-new lecturer has no list to pick from
-- yet. This finds a case-insensitive match on the English translation, or
-- creates one, the same narrowly-scoped-privilege pattern as
-- list_public_teachers/get_teacher_contact (0004, 0021).
create or replace function public.resolve_subject(subject_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  found_id uuid;
  new_slug text;
begin
  select id into found_id
  from subjects
  where translations ->> 'en' ilike trim(subject_name)
  limit 1;

  if found_id is not null then
    return found_id;
  end if;

  new_slug := lower(regexp_replace(trim(subject_name), '[^a-zA-Z0-9]+', '-', 'g'));

  insert into subjects (slug, translations)
  values (new_slug, jsonb_build_object('en', trim(subject_name)))
  on conflict (slug) do update set slug = subjects.slug
  returning id into found_id;

  return found_id;
end;
$$;

grant execute on function public.resolve_subject(text) to authenticated;
