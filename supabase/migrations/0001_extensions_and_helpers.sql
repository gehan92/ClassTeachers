-- Extensions + shared helper functions used by every later migration's RLS
-- policies. Kept in one file so the "how does ownership/enrollment get
-- checked" logic exists in exactly one place instead of being copy-pasted
-- (and drifting) across 15+ table policies.

create extension if not exists pgcrypto;

-- Auto-maintained updated_at column, attached per-table via trigger.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- True if the current request is authenticated as a platform admin.
-- SECURITY DEFINER: profiles has its own RLS (users can only read their own
-- row), so a plain function running as the caller couldn't check somebody
-- else's role. This function only ever returns a boolean, never row data,
-- so it doesn't leak anything through the bypass.
--
-- language plpgsql (not sql): profiles/class_profiles/enrollments are
-- created by later migrations. plpgsql bodies are only name-resolved on
-- first *call*, not at CREATE FUNCTION time, so these can live here in one
-- shared file instead of being scattered next to whichever table happened
-- to exist first.
create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$;

-- True if the current user owns the given (owner_type, owner_id) pair.
-- 'teacher' owner_id is a profiles.id (the teacher IS the profile).
-- 'class' owner_id is a class_profiles.id (owned by class_profiles.owner_id).
-- Used identically across subjects, notes, question bank, exams, live
-- classes, advertisements and prices so ownership rules can't drift between
-- tables.
create or replace function public.is_owner(p_owner_type text, p_owner_id uuid)
returns boolean
language plpgsql
stable
as $$
begin
  return case p_owner_type
    when 'teacher' then p_owner_id = auth.uid()
    when 'class' then exists (
      select 1 from class_profiles
      where id = p_owner_id and owner_id = auth.uid()
    )
    else false
  end;
end;
$$;

-- True if the current user is a student enrolled with the given
-- (owner_type, owner_id). Deliberately NOT security definer: enrollments'
-- own RLS policy already lets a student see rows where student_id =
-- auth.uid(), so this query succeeds under normal RLS.
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
  );
end;
$$;

-- Some tables (reviews, prices) use an owner_type of 'teacher_in_class' to
-- represent "this teacher, specifically within this institute" as distinct
-- from the teacher's own standalone profile. Ownership/enrollment checks
-- for that pseudo-type collapse back onto the underlying teacher — this
-- resolves that mapping in one place instead of duplicating the `case`
-- in every table that needs it.
create or replace function public.resolve_owner_type(p_owner_type text)
returns text
language sql
immutable
as $$
  select case when p_owner_type = 'teacher_in_class' then 'teacher' else p_owner_type end;
$$;

-- First letter of each name segment kept, rest masked — e.g.
-- "Piyal Kumara" -> "P*** K***". This is a placeholder pending the actual
-- masking format decision (see 01-Project-Overview.md §19 "Open Questions").
create or replace function public.mask_display_name(full_name text)
returns text
language sql
immutable
as $$
  select case
    when full_name is null or length(trim(full_name)) = 0 then full_name
    else (
      select string_agg(left(word, 1) || '***', ' ' order by ord)
      from unnest(regexp_split_to_array(trim(full_name), '\s+')) with ordinality as t(word, ord)
    )
  end;
$$;
