-- Supply-side mirror of wanted_ads (0071): there, a student posts what
-- they're looking for and teachers/institutes respond. Here, a teacher (or
-- campus lecturer) posts that they're available to join an institute, and
-- institutes browse and respond -- the "Institute-Seeking Ad" gap flagged
-- against Gehan's mockup, section 2.2. Deliberately its own table, not a
-- fifth advertisements placement (0014): every advertisements row is tied
-- to a batch_id, which doesn't apply here -- a teacher isn't promoting a
-- class, they're promoting themselves as a hire.
--
-- mode reuses batches' just-added three-value vocabulary (0135:
-- online/physical/travels_to_student) since it's the same real-world
-- concept -- how the teacher is willing to work -- applied to a person
-- instead of a class.
create table teacher_seeking_ads (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles (id) on delete cascade,
  subject_id uuid references subjects (id) on delete set null,
  mode text check (mode in ('online', 'physical', 'travels_to_student')),
  grade_band text check (grade_band in ('1-5', '6-9', '10-11', '12-13', 'campus')),
  title text not null,
  content text not null,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table teacher_seeking_ads enable row level security;

create trigger teacher_seeking_ads_set_updated_at
  before update on teacher_seeking_ads
  for each row execute function set_updated_at();

-- Same shape as wanted_ads' own select policy (0071) -- active rows are
-- readable by anyone (an institute needs to browse these), the posting
-- teacher and admin can always see their own regardless of status. No
-- public/anon grant on the browse RPC below though (see 0137) -- unlike
-- wanted_ads there's no existing public "browse teachers seeking a
-- placement" page, so this stays a signed-in, institute-side surface only.
create policy "active teacher-seeking ads are public; teacher/admin see all statuses"
  on teacher_seeking_ads for select
  using (status = 'active' or teacher_id = auth.uid() or is_admin());

create policy "a teacher creates their own seeking ads"
  on teacher_seeking_ads for insert
  with check (teacher_id = auth.uid());

create policy "a teacher updates their own seeking ads"
  on teacher_seeking_ads for update
  using (teacher_id = auth.uid() or is_admin())
  with check (teacher_id = auth.uid() or is_admin());

create policy "a teacher deletes their own seeking ads"
  on teacher_seeking_ads for delete
  using (teacher_id = auth.uid() or is_admin());
