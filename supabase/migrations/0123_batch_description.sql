-- Spec doc's Flow 1 ("Add Batch -> fill title, grade, capacity,
-- description -> Save") -- a free-text description distinct from
-- schedule_note (which is specifically about timing/logistics, e.g. "Tue
-- and Thu evenings"). Shared by both teacher and institute batches, same as
-- every other batches column.

alter table batches add column if not exists description text;
