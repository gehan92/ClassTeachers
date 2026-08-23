-- A question stem (or an MCQ option) is sometimes a graph/diagram, not just
-- text. `options` is already flexible jsonb, so an option's image just adds
-- an `imagePath` key there — no column needed for that. The question stem
-- itself needs one, since it's a top-level field, not an array entry.
alter table question_bank_items
  add column if not exists question_image_path text;
