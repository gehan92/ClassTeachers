-- Minimal local-dev seed data. Run after the migrations apply
-- (`supabase db reset` runs both automatically). Intentionally small —
-- this is for exercising the schema locally, not a content fixture.

insert into subjects (slug, translations, grade_band) values
  ('combined-maths', '{"en": "Combined Maths", "si": "සංයුක්ත ගණිතය", "ta": "கூட்டு கணிதம்"}', '12-13'),
  ('physics', '{"en": "Physics", "si": "භෞතික විද්‍යාව", "ta": "இயற்பியல்"}', '12-13'),
  ('science', '{"en": "Science", "si": "විද්‍යාව", "ta": "அறிவியல்"}', '6-9'),
  ('ict', '{"en": "ICT", "si": "තොරතුරු තාක්ෂණය", "ta": "தகவல் தொழில்நுட்பம்"}', '6-9'),
  ('primary-all-subjects', '{"en": "Primary — All subjects", "si": "ප්‍රාථමික — සියලුම විෂයයන්", "ta": "ஆரம்ப — அனைத்து பாடங்களும்"}', '1-5')
on conflict (slug) do nothing;
