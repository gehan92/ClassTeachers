-- 0085 tried to lock down question_bank_items' answer-key columns
-- (correct_option_id, correct_option_ids, sample_answer) with:
--   revoke select (correct_option_id, correct_option_ids, sample_answer)
--     on question_bank_items from authenticated, anon;
-- Confirmed live against the real database (twice, hours apart) that this
-- has zero effect — a direct anon-key select of those columns still
-- succeeds. Root cause: every table in this schema has table-level SELECT
-- granted to anon/authenticated from Supabase's own project-level defaults
-- (never done by any migration here — nothing in this repo's history ever
-- grants it, it's provisioned outside the migration set, which is exactly
-- why it was never visible as "missing" before). In Postgres, a column-level
-- REVOKE cannot narrow an existing table-level GRANT — the table-level
-- privilege is checked first and satisfies the access check on its own, so
-- the column-level revoke silently becomes a no-op. This is why 0085 never
-- errored and its 3 SECURITY DEFINER functions worked fine (those don't
-- depend on the revoke at all) while the direct-column block never took.
--
-- The fix has to invert the approach: revoke the table-level SELECT
-- entirely, then re-grant column-level SELECT on an explicit allow-list of
-- every column except the answer-key ones (plus correct_answer — 0009's
-- original single-column answer field, superseded by correct_option_id/
-- correct_option_ids/sample_answer per 0034/0062/0077 and confirmed unused
-- by any app code via grep, but still answer-key-shaped, so it goes on the
-- same deny list for defense in depth rather than being left open by
-- omission). RLS still applies on top of this exactly as before — this
-- only narrows which columns are visible at all, same as 0085 intended.

revoke select on question_bank_items from authenticated, anon;

grant select (
  id, owner_type, owner_id, subject_id, question_text, type, difficulty,
  created_at, updated_at, topic, marks, grade_band, batch_id, options,
  language, question_image_path, multi_select, code_format
) on question_bank_items to authenticated, anon;
