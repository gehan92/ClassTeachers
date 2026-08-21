-- Both the student and teacher dashboards show notification toggles
-- (Profile & Account / Settings tabs) that have always been local `useState`
-- seeded to `true` — never loaded, never saved, reset to "on" on every
-- refresh. One jsonb column covers both dashboards' toggle sets (each
-- profile row belongs to a single role, so there's no key collision), same
-- pattern already used for `subjects.translations`.

alter table profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;
