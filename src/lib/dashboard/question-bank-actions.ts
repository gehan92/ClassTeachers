"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveBatchOwner } from "@/lib/dashboard/resolve-batch-owner";
import type { Database } from "@/types/database";

type ActionResult = { error: string } | { error?: undefined };
type QuestionBankItemInsert = Database["public"]["Tables"]["question_bank_items"]["Insert"];

const MAX_OPTIONS = 8;

const allowedImageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type RawOption = { id: string; text: string; imagePath?: string };

const questionFieldsSchema = z.object({
  text: z.string().trim().min(1),
  topic: z.string().trim().min(1),
  subjectId: z.string().uuid().optional(),
  gradeBand: z.enum(["1-5", "6-9", "10-11", "12-13", "campus"]),
  batchId: z.string().uuid().optional(),
  type: z.enum(["mcq", "essay", "code"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  marks: z.coerce.number().int().min(1),
  language: z.enum(["en", "si", "ta", "other"]),
  paperYear: z.coerce.number().int().min(1900).max(2200).optional(),
  semester: z.string().trim().max(60).optional(),
});

/** "1"/absent flags, same convention as removeQuestionImage/optionRemoveImage
 * below — not run through zod's coerce.boolean(), which would treat the
 * literal string "false" as truthy. */
function readFlag(formData: FormData, key: string): boolean {
  return formData.get(key) === "1";
}

/** Reads the option-N fields a FormData submission carries — text is
 * required per row, id is present only for a row that already existed
 * (used to carry its image forward across an edit), image is the file
 * input for that row if the teacher picked a new one this submission. */
function readOptionRows(formData: FormData): { id: string; text: string; image: File | null; removeImage: boolean }[] {
  const count = Number(formData.get("optionCount") ?? "0");
  const rows: { id: string; text: string; image: File | null; removeImage: boolean }[] = [];
  for (let i = 0; i < Math.min(count, MAX_OPTIONS); i++) {
    const text = formData.get(`optionText-${i}`);
    if (typeof text !== "string" || !text.trim()) continue;
    const id = formData.get(`optionId-${i}`);
    const image = formData.get(`optionImage-${i}`);
    rows.push({
      id: typeof id === "string" && id ? id : "",
      text: text.trim(),
      image: image instanceof File && image.size > 0 ? image : null,
      removeImage: formData.get(`optionRemoveImage-${i}`) === "1",
    });
  }
  return rows;
}

/** correctIndexes is sent as a JSON array of option-row indices — more than
 * one means "select all that apply" (checkboxes on the student side). */
function readCorrectIndexes(formData: FormData): number[] {
  const raw = formData.get("correctIndexes");
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0);
  } catch {
    return [];
  }
}

async function uploadQuestionImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  questionId: string,
  slot: string,
  file: File,
): Promise<{ path?: string; error?: string }> {
  const extension = allowedImageTypes[file.type];
  if (!extension) {
    return { error: "Images must be JPG, PNG, or WEBP." };
  }
  const path = `${ownerId}/${questionId}/${slot}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("question-images").upload(path, file, { contentType: file.type });
  if (error) {
    return { error: "Couldn't upload the image. Please try again." };
  }
  return { path };
}

export async function createQuestion(formData: FormData): Promise<ActionResult> {
  const parsed = questionFieldsSchema.safeParse({
    text: formData.get("text"),
    topic: formData.get("topic"),
    subjectId: formData.get("subjectId") || undefined,
    gradeBand: formData.get("gradeBand"),
    batchId: formData.get("batchId") || undefined,
    type: formData.get("type"),
    difficulty: formData.get("difficulty"),
    marks: formData.get("marks") || "1",
    language: formData.get("language") || "en",
    paperYear: formData.get("paperYear") || undefined,
    semester: formData.get("semester") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the question fields." };
  }

  const multiSelect = readFlag(formData, "multiSelect");
  const codeFormat = readFlag(formData, "codeFormat");
  const sampleAnswerRaw = formData.get("sampleAnswer");
  const sampleAnswer = typeof sampleAnswerRaw === "string" && sampleAnswerRaw.trim() ? sampleAnswerRaw.trim() : null;

  const optionRows = parsed.data.type === "mcq" ? readOptionRows(formData) : [];
  const correctIndexes = readCorrectIndexes(formData);
  if (parsed.data.type === "mcq") {
    if (optionRows.length < 2 || correctIndexes.every((i) => !optionRows[i])) {
      return { error: "MCQ questions need at least two options and a correct answer." };
    }
    if (!multiSelect && correctIndexes.length !== 1) {
      return { error: "Single-answer questions need exactly one correct option." };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const target = await resolveBatchOwner(supabase, user.id, parsed.data.batchId);
  if ("error" in target) {
    return target;
  }

  const questionId = crypto.randomUUID();
  const uploadedPaths: string[] = [];

  let questionImagePath: string | null = null;
  const questionImage = formData.get("questionImage");
  if (questionImage instanceof File && questionImage.size > 0) {
    const result = await uploadQuestionImage(supabase, target.ownerId, questionId, "stem", questionImage);
    if (result.error) return { error: result.error };
    questionImagePath = result.path!;
    uploadedPaths.push(result.path!);
  }

  const options: RawOption[] = [];
  for (const [i, row] of optionRows.entries()) {
    const id = `${questionId}-o${i + 1}`;
    let imagePath: string | undefined;
    if (row.image) {
      const result = await uploadQuestionImage(supabase, target.ownerId, questionId, `option-${i}`, row.image);
      if (result.error) {
        await supabase.storage.from("question-images").remove(uploadedPaths);
        return { error: result.error };
      }
      imagePath = result.path!;
      uploadedPaths.push(result.path!);
    }
    options.push({ id, text: row.text, ...(imagePath ? { imagePath } : {}) });
  }
  const correctOptionIds =
    parsed.data.type === "mcq"
      ? correctIndexes.map((i) => options[i]?.id).filter((id): id is string => Boolean(id))
      : [];

  const { error } = await supabase.from("question_bank_items").insert({
    id: questionId,
    owner_type: target.ownerType,
    owner_id: target.ownerId,
    question_text: parsed.data.text,
    topic: parsed.data.topic,
    subject_id: parsed.data.subjectId ?? null,
    grade_band: parsed.data.gradeBand,
    batch_id: target.batchId,
    type: parsed.data.type,
    difficulty: parsed.data.difficulty,
    marks: parsed.data.marks,
    language: parsed.data.language,
    paper_year: parsed.data.paperYear ?? null,
    semester: parsed.data.semester ?? null,
    question_image_path: questionImagePath,
    options: parsed.data.type === "mcq" ? options : null,
    correct_option_id: correctOptionIds[0] ?? null,
    correct_option_ids: correctOptionIds,
    multi_select: parsed.data.type === "mcq" ? multiSelect : false,
    code_format: codeFormat,
    sample_answer: parsed.data.type === "code" ? sampleAnswer : null,
  });
  if (error) {
    if (uploadedPaths.length > 0) await supabase.storage.from("question-images").remove(uploadedPaths);
    return { error: "Couldn't save this question. Please try again." };
  }
  return {};
}

export async function updateQuestion(questionId: string, formData: FormData): Promise<ActionResult> {
  if (!questionId) {
    return { error: "Invalid question." };
  }

  const parsed = questionFieldsSchema.safeParse({
    text: formData.get("text"),
    topic: formData.get("topic"),
    subjectId: formData.get("subjectId") || undefined,
    gradeBand: formData.get("gradeBand"),
    batchId: formData.get("batchId") || undefined,
    type: formData.get("type"),
    difficulty: formData.get("difficulty"),
    marks: formData.get("marks") || "1",
    language: formData.get("language") || "en",
    paperYear: formData.get("paperYear") || undefined,
    semester: formData.get("semester") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the question fields." };
  }

  const multiSelect = readFlag(formData, "multiSelect");
  const codeFormat = readFlag(formData, "codeFormat");
  const sampleAnswerRaw = formData.get("sampleAnswer");
  const sampleAnswer = typeof sampleAnswerRaw === "string" && sampleAnswerRaw.trim() ? sampleAnswerRaw.trim() : null;

  const optionRows = parsed.data.type === "mcq" ? readOptionRows(formData) : [];
  const correctIndexes = readCorrectIndexes(formData);
  if (parsed.data.type === "mcq") {
    if (optionRows.length < 2 || correctIndexes.every((i) => !optionRows[i])) {
      return { error: "MCQ questions need at least two options and a correct answer." };
    }
    if (!multiSelect && correctIndexes.length !== 1) {
      return { error: "Single-answer questions need exactly one correct option." };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: existing } = await supabase
    .from("question_bank_items")
    .select("owner_type, owner_id, options, question_image_path")
    .eq("id", questionId)
    .maybeSingle();
  if (!existing) {
    return { error: "Question not found." };
  }

  let batchId: string | null = null;
  if (parsed.data.batchId) {
    const target = await resolveBatchOwner(supabase, user.id, parsed.data.batchId);
    if ("error" in target) {
      return target;
    }
    if (target.ownerType !== existing.owner_type || target.ownerId !== existing.owner_id) {
      return { error: "That class doesn't belong to this question's owner." };
    }
    batchId = target.batchId;
  }

  const existingImagePathByOptionId = new Map(
    ((existing.options as RawOption[] | null) ?? []).map((o) => [o.id, o.imagePath]),
  );
  const removedPaths: string[] = [];
  const uploadedPaths: string[] = [];

  let questionImagePath = existing.question_image_path;
  const questionImage = formData.get("questionImage");
  const removeQuestionImage = formData.get("removeQuestionImage") === "1";
  if (questionImage instanceof File && questionImage.size > 0) {
    const result = await uploadQuestionImage(supabase, existing.owner_id, questionId, "stem", questionImage);
    if (result.error) return { error: result.error };
    if (questionImagePath) removedPaths.push(questionImagePath);
    questionImagePath = result.path!;
    uploadedPaths.push(result.path!);
  } else if (removeQuestionImage && questionImagePath) {
    removedPaths.push(questionImagePath);
    questionImagePath = null;
  }

  const options: RawOption[] = [];
  for (const [i, row] of optionRows.entries()) {
    const id = row.id || `${questionId}-o${Date.now()}-${i}`;
    let imagePath = row.id ? existingImagePathByOptionId.get(row.id) : undefined;
    if (row.image) {
      const result = await uploadQuestionImage(supabase, existing.owner_id, questionId, `option-${i}`, row.image);
      if (result.error) {
        if (uploadedPaths.length > 0) await supabase.storage.from("question-images").remove(uploadedPaths);
        return { error: result.error };
      }
      if (imagePath) removedPaths.push(imagePath);
      imagePath = result.path!;
      uploadedPaths.push(result.path!);
    } else if (row.removeImage && imagePath) {
      removedPaths.push(imagePath);
      imagePath = undefined;
    }
    options.push({ id, text: row.text, ...(imagePath ? { imagePath } : {}) });
  }
  // Any option dropped entirely during this edit (removed via the form)
  // loses its image too — otherwise it'd orphan in storage forever.
  const keptOptionIds = new Set(optionRows.filter((r) => r.id).map((r) => r.id));
  for (const [id, path] of existingImagePathByOptionId) {
    if (path && !keptOptionIds.has(id)) removedPaths.push(path);
  }

  const correctOptionIds =
    parsed.data.type === "mcq"
      ? correctIndexes.map((i) => options[i]?.id).filter((id): id is string => Boolean(id))
      : [];

  const { error } = await supabase
    .from("question_bank_items")
    .update({
      question_text: parsed.data.text,
      topic: parsed.data.topic,
      subject_id: parsed.data.subjectId ?? null,
      grade_band: parsed.data.gradeBand,
      batch_id: batchId,
      type: parsed.data.type,
      difficulty: parsed.data.difficulty,
      marks: parsed.data.marks,
      language: parsed.data.language,
      paper_year: parsed.data.paperYear ?? null,
      semester: parsed.data.semester ?? null,
      question_image_path: questionImagePath,
      options: parsed.data.type === "mcq" ? options : null,
      correct_option_id: correctOptionIds[0] ?? null,
      correct_option_ids: correctOptionIds,
      multi_select: parsed.data.type === "mcq" ? multiSelect : false,
      code_format: codeFormat,
      sample_answer: parsed.data.type === "code" ? sampleAnswer : null,
    })
    .eq("id", questionId);
  if (error) {
    if (uploadedPaths.length > 0) await supabase.storage.from("question-images").remove(uploadedPaths);
    return { error: "Couldn't update this question. Please try again." };
  }
  if (removedPaths.length > 0) {
    await supabase.storage.from("question-images").remove(removedPaths);
  }
  return {};
}

export async function deleteQuestion(questionId: string): Promise<ActionResult> {
  if (!questionId) {
    return { error: "Invalid question." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("question_bank_items")
    .select("options, question_image_path")
    .eq("id", questionId)
    .maybeSingle();

  const { error } = await supabase.from("question_bank_items").delete().eq("id", questionId);
  if (error) {
    return { error: "Couldn't delete this question. Please try again." };
  }

  if (existing) {
    const paths = [
      existing.question_image_path,
      ...((existing.options as RawOption[] | null) ?? []).map((o) => o.imagePath),
    ].filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      await supabase.storage.from("question-images").remove(paths);
    }
  }
  return {};
}

/**
 * Deletes several questions in one round trip (the table's new multi-select
 * checkboxes) instead of one deleteQuestion call per row. RLS still scopes
 * every delete to the caller's own rows same as the single-delete path —
 * passing someone else's id here just silently deletes nothing for that id.
 */
export async function bulkDeleteQuestions(questionIds: string[]): Promise<ActionResult & { deleted: number }> {
  if (!questionIds || questionIds.length === 0) {
    return { error: "No questions selected.", deleted: 0 };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("question_bank_items")
    .select("options, question_image_path")
    .in("id", questionIds);

  const { error, count } = await supabase
    .from("question_bank_items")
    .delete({ count: "exact" })
    .in("id", questionIds);
  if (error) {
    return { error: "Couldn't delete these questions. Please try again.", deleted: 0 };
  }

  if (existing && existing.length > 0) {
    const paths = existing
      .flatMap((row) => [row.question_image_path, ...((row.options as RawOption[] | null) ?? []).map((o) => o.imagePath)])
      .filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      await supabase.storage.from("question-images").remove(paths);
    }
  }

  return { deleted: count ?? existing?.length ?? 0 };
}

const bulkRowSchema = z.object({
  type: z.enum(["mcq", "essay", "code"]),
  text: z.string().trim().min(1),
  subjectId: z.string().uuid().optional(),
  topic: z.string().trim().min(1),
  gradeBand: z.enum(["1-5", "6-9", "10-11", "12-13", "campus"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  marks: z.number().int().min(1),
  language: z.enum(["en", "si", "ta", "other"]),
  paperYear: z.number().int().min(1900).max(2200).optional(),
  semester: z.string().trim().max(60).optional(),
  options: z.array(z.string().trim().min(1)).optional(),
  correctIndexes: z.array(z.number().int().min(0)).optional(),
  multiSelect: z.boolean().optional(),
  sampleAnswer: z.string().optional(),
});

export type BulkImportQuestionInput = z.infer<typeof bulkRowSchema>;
export type BulkImportRowError = { row: number; message: string };
export type BulkImportDuplicate = { row: number; text: string; existingId: string; existingText: string };

function normalizeQuestionText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Bulk question import — mirrors the house "paste + local parser" pattern
 * already used for bulk phone enrollment (bulkEnrollStudentsByPhone,
 * batches-actions.ts) rather than a real CSV-file-upload flow. Rows are
 * already parsed and locally validated client-side (parseBulkImportText,
 * src/lib/bulk-import-questions.ts) — this re-validates defensively (never
 * trust a client-only check) and does one insert for the whole batch, one
 * bad row does not block the rest. Text-only: bulk-imported questions carry
 * no images (unlike createQuestion) — add those afterward via edit if needed.
 *
 * Duplicate detection (skipped when `forceRowNumbers` names a row): rows
 * whose text exactly matches an existing question (case/whitespace
 * insensitive) in this same owner's bank are held back and reported in
 * `duplicates` instead of being inserted — the caller shows them to the
 * teacher to choose "skip" or "import anyway", then re-calls this with
 * those specific row numbers in `forceRowNumbers` to insert them for real.
 */
export async function bulkImportQuestions(
  batchId: string | undefined,
  rows: BulkImportQuestionInput[],
  forceRowNumbers?: number[],
): Promise<{ error?: string; imported: number; rowErrors: BulkImportRowError[]; duplicates: BulkImportDuplicate[] }> {
  if (rows.length === 0) {
    return { error: "Nothing to import.", imported: 0, rowErrors: [], duplicates: [] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in.", imported: 0, rowErrors: [], duplicates: [] };
  }

  const target = await resolveBatchOwner(supabase, user.id, batchId);
  if ("error" in target) {
    return { error: target.error, imported: 0, rowErrors: [], duplicates: [] };
  }

  const { data: existingRows } = await supabase
    .from("question_bank_items")
    .select("id, question_text")
    .eq("owner_type", target.ownerType)
    .eq("owner_id", target.ownerId);
  const existingByNormalizedText = new Map(
    (existingRows ?? []).map((r) => [normalizeQuestionText(r.question_text), { id: r.id, text: r.question_text }]),
  );
  const forcedRowNumbers = new Set(forceRowNumbers ?? []);

  const rowErrors: BulkImportRowError[] = [];
  const duplicates: BulkImportDuplicate[] = [];
  const toInsert: QuestionBankItemInsert[] = [];

  rows.forEach((raw, index) => {
    const rowNumber = index + 1;
    const parsed = bulkRowSchema.safeParse(raw);
    if (!parsed.success) {
      rowErrors.push({ row: rowNumber, message: parsed.error.issues[0]?.message ?? "Invalid row." });
      return;
    }
    const row = parsed.data;

    if (row.type === "mcq") {
      const optionCount = row.options?.length ?? 0;
      if (optionCount < 2) {
        rowErrors.push({ row: rowNumber, message: "MCQ needs at least two options." });
        return;
      }
      if (!row.correctIndexes || row.correctIndexes.length === 0 || row.correctIndexes.some((i) => i >= optionCount)) {
        rowErrors.push({ row: rowNumber, message: "MCQ needs a valid correct answer." });
        return;
      }
    }

    if (!forcedRowNumbers.has(rowNumber)) {
      const existingMatch = existingByNormalizedText.get(normalizeQuestionText(row.text));
      if (existingMatch) {
        duplicates.push({ row: rowNumber, text: row.text, existingId: existingMatch.id, existingText: existingMatch.text });
        return;
      }
    }

    const questionId = crypto.randomUUID();
    const options =
      row.type === "mcq" ? (row.options ?? []).map((text, i) => ({ id: `${questionId}-o${i + 1}`, text })) : null;
    const correctOptionIds =
      row.type === "mcq" && options
        ? (row.correctIndexes ?? []).map((i) => options[i]?.id).filter((id): id is string => Boolean(id))
        : [];

    toInsert.push({
      id: questionId,
      owner_type: target.ownerType,
      owner_id: target.ownerId,
      question_text: row.text,
      topic: row.topic,
      subject_id: row.subjectId ?? null,
      grade_band: row.gradeBand,
      batch_id: target.batchId,
      type: row.type,
      difficulty: row.difficulty,
      marks: row.marks,
      language: row.language,
      paper_year: row.paperYear ?? null,
      semester: row.semester ?? null,
      options,
      correct_option_id: correctOptionIds[0] ?? null,
      correct_option_ids: correctOptionIds,
      multi_select: row.type === "mcq" ? Boolean(row.multiSelect) : false,
      code_format: false,
      sample_answer: row.type === "code" ? (row.sampleAnswer ?? null) : null,
    });
  });

  if (toInsert.length === 0) {
    return { imported: 0, rowErrors, duplicates };
  }

  const { error } = await supabase.from("question_bank_items").insert(toInsert);
  if (error) {
    return { error: "Couldn't save these questions. Please try again.", imported: 0, rowErrors, duplicates };
  }

  return { imported: toInsert.length, rowErrors, duplicates };
}
