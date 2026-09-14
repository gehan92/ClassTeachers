-- Teacher/institute class ads (0119/upsertBatchAd, createIndividualAd,
-- institute batches-tab) could only ever be 'online' or 'physical' —
-- Gehan's mockup wants a third delivery mode for a teacher/institute that
-- travels to the student instead of teaching from a fixed location.
-- Deliberately one combined value, not separate "home visit"/"travel to
-- student" options (Gehan's call) — same underlying arrangement, one label.
--
-- Scoped to batches only (class ads) — live_classes (0012) and wanted_ads
-- (0071) keep their own separate mode columns/constraints untouched, so a
-- live video session or a student's request still only ever says
-- online/physical/both.

alter table batches drop constraint if exists batches_mode_check;
alter table batches add constraint batches_mode_check
  check (mode in ('online', 'physical', 'travels_to_student'));
