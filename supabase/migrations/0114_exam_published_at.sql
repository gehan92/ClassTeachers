-- Timestamp for when an exam actually became visible to students (the
-- draft-to-published flip added in 0063), distinct from created_at -- a
-- teacher can draft an exam well before class and only publish it live
-- during the session. The student dashboard's "shared during this class"
-- highlight (ClassWorkspace) needs to know when it actually went live, not
-- when it was first drafted.
alter table exams add column if not exists published_at timestamptz;

-- Backfill: every exam that's already published today gets a sensible
-- published_at (its created_at) so it doesn't look "freshly shared" the
-- moment this ships. Going forward, setExamPublished stamps this on every
-- draft-to-published transition instead.
update exams set published_at = created_at where published = true and published_at is null;
