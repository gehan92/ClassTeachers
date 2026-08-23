-- The question bank's create form only ever wrote English text — a teacher
-- who also teaches in Sinhala/Tamil had no way to tag which language a
-- question is written in, or filter the bank by it. Defaulting to 'en'
-- since that matches every question written before this column existed.
alter table question_bank_items
  add column if not exists language text not null default 'en' check (language in ('en', 'si', 'ta'));
