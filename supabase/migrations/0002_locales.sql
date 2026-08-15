-- Which UI locales exist and which are shown to end users. The app ships
-- translation files for all of these (messages/{code}.json); this table
-- only controls the `is_active` subset surfaced in the public language
-- switcher, so Admin -> Languages can soft-launch a locale without a
-- code deploy. See src/i18n/active-locales.ts.

create table locales (
  code text primary key check (code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  label text not null,
  native_label text not null,
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

alter table locales enable row level security;

-- Public read: every visitor needs this to render the language switcher.
create policy "locales are publicly readable"
  on locales for select
  using (true);

create policy "only admins manage locales"
  on locales for all
  using (is_admin())
  with check (is_admin());

insert into locales (code, label, native_label, is_active, is_default) values
  ('en', 'English', 'English', true, true),
  ('si', 'Sinhala', 'සිංහල', true, false),
  ('ta', 'Tamil', 'தமிழ்', true, false);
