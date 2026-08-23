"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

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
  gradeBand: z.enum(["1-5", "6-9", "10-11", "12-13", "campus"]),
  batchId: z.string().uuid().optional(),
  type: z.enum(["mcq", "essay"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  marks: z.coerce.number().int().min(1),
  language: z.enum(["en", "si", "ta"]),
});

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
  const ownerType = formData.get("ownerType");
  const parsed = questionFieldsSchema.safeParse({
    text: formData.get("text"),
    topic: formData.get("topic"),
    gradeBand: formData.get("gradeBand"),
    batchId: formData.get("batchId") || undefined,
    type: formData.get("type"),
    difficulty: formData.get("difficulty"),
    marks: formData.get("marks") || "1",
    language: formData.get("language") || "en",
  });
  if (!parsed.success || (ownerType !== "teacher" && ownerType !== "class")) {
    return { error: parsed.success ? "Invalid owner." : (parsed.error.issues[0]?.message ?? "Please check the question fields.") };
  }

  const optionRows = parsed.data.type === "mcq" ? readOptionRows(formData) : [];
  const correctIndex = Number(formData.get("correctIndex") ?? "0");
  if (parsed.data.type === "mcq" && (optionRows.length < 2 || !optionRows[correctIndex])) {
    return { error: "MCQ questions need at least two options and a correct answer." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  let ownerId = user.id;
  if (ownerType === "class") {
    const { data: classProfile } = await supabase
      .from("class_profiles")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!classProfile) {
      return { error: "Save your institute details first." };
    }
    ownerId = classProfile.id;
  }

  const questionId = crypto.randomUUID();
  const uploadedPaths: string[] = [];

  let questionImagePath: string | null = null;
  const questionImage = formData.get("questionImage");
  if (questionImage instanceof File && questionImage.size > 0) {
    const result = await uploadQuestionImage(supabase, ownerId, questionId, "stem", questionImage);
    if (result.error) return { error: result.error };
    questionImagePath = result.path!;
    uploadedPaths.push(result.path!);
  }

  const options: RawOption[] = [];
  for (const [i, row] of optionRows.entries()) {
    const id = `${questionId}-o${i + 1}`;
    let imagePath: string | undefined;
    if (row.image) {
      const result = await uploadQuestionImage(supabase, ownerId, questionId, `option-${i}`, row.image);
      if (result.error) {
        await supabase.storage.from("question-images").remove(uploadedPaths);
        return { error: result.error };
      }
      imagePath = result.path!;
      uploadedPaths.push(result.path!);
    }
    options.push({ id, text: row.text, ...(imagePath ? { imagePath } : {}) });
  }
  const correctOptionId = parsed.data.type === "mcq" ? options[correctIndex]?.id : undefined;

  const { error } = await supabase.from("question_bank_items").insert({
    id: questionId,
    owner_type: ownerType,
    owner_id: ownerId,
    question_text: parsed.data.text,
    topic: parsed.data.topic,
    grade_band: parsed.data.gradeBand,
    batch_id: parsed.data.batchId ?? null,
    type: parsed.data.type,
    difficulty: parsed.data.difficulty,
    marks: parsed.data.marks,
    language: parsed.data.language,
    question_image_path: questionImagePath,
    options: parsed.data.type === "mcq" ? options : null,
    correct_option_id: correctOptionId ?? null,
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
    gradeBand: formData.get("gradeBand"),
    batchId: formData.get("batchId") || undefined,
    type: formData.get("type"),
    difficulty: formData.get("difficulty"),
    marks: formData.get("marks") || "1",
    language: formData.get("language") || "en",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the question fields." };
  }

  const optionRows = parsed.data.type === "mcq" ? readOptionRows(formData) : [];
  const correctIndex = Number(formData.get("correctIndex") ?? "0");
  if (parsed.data.type === "mcq" && (optionRows.length < 2 || !optionRows[correctIndex])) {
    return { error: "MCQ questions need at least two options and a correct answer." };
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
    .select("owner_id, options, question_image_path")
    .eq("id", questionId)
    .eq("owner_type", "teacher")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!existing) {
    return { error: "Question not found." };
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

  const correctOptionId = parsed.data.type === "mcq" ? options[correctIndex]?.id : undefined;

  const { error } = await supabase
    .from("question_bank_items")
    .update({
      question_text: parsed.data.text,
      topic: parsed.data.topic,
      grade_band: parsed.data.gradeBand,
      batch_id: parsed.data.batchId ?? null,
      type: parsed.data.type,
      difficulty: parsed.data.difficulty,
      marks: parsed.data.marks,
      language: parsed.data.language,
      question_image_path: questionImagePath,
      options: parsed.data.type === "mcq" ? options : null,
      correct_option_id: correctOptionId ?? null,
    })
    .eq("id", questionId)
    .eq("owner_type", "teacher")
    .eq("owner_id", user.id);
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
