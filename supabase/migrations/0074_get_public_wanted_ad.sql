-- Gehan noticed request cards linked straight to a login/dashboard href
-- instead of letting a visitor open the ad and read it in full (the card's
-- description was line-clamped to 2 lines with no way to see the rest).
-- Adds a single-row counterpart to list_public_wanted_ads() (0072), same
-- shape as get_public_ad (0040) for teacher/institute ad listings, so
-- /requests/[id] can show one ad in full. Scoped to status = 'active' just
-- like the list version, so a closed ad's page 404s instead of half-working.

create or replace function public.get_public_wanted_ad(p_id uuid)
returns table (
  id uuid,
  looking_for text,
  subject text,
  mode text,
  grade_level text,
  title text,
  description text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    wa.id,
    wa.looking_for,
    s.translations ->> 'en',
    wa.mode,
    wa.grade_level,
    wa.title,
    wa.description,
    wa.created_at
  from wanted_ads wa
  left join subjects s on s.id = wa.subject_id
  where wa.id = p_id and wa.status = 'active';
$$;

grant execute on function public.get_public_wanted_ad(uuid) to anon, authenticated;
