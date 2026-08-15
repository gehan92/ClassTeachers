-- The question bank is a teacher/institute-internal authoring tool —
-- students never query it directly, they only see the exams assembled
-- from it (0010). So unlike notes/exams, there's no is_enrolled() branch
-- here at all.

create table question_bank_items (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('teacher', 'class')),
  owner_id uuid not null,
  subject_id uuid references subjects (id),
  question_text text not null,
  type text not null check (type in ('theory', 'practical')),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  correct_answer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table question_bank_items enable row level security;

create trigger question_bank_items_set_updated_at
  before update on question_bank_items
  for each row execute function set_updated_at();

create policy "question bank is owner/admin only"
  on question_bank_items for all
  using (is_owner(owner_type, owner_id) or is_admin())
  with check (is_owner(owner_type, owner_id) or is_admin());
