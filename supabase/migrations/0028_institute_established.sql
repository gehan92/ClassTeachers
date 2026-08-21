-- Institute settings' "Established" field (Institute Dashboard -> Settings)
-- has been UI-only since it was built: local state seeded to "", never
-- loaded, never sent to updateInstituteProfile. Adds the missing column.

alter table class_profiles
  add column if not exists established text;
