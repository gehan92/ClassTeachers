"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

const optionSchema = z.object({ id: z.string(), text: z.string().trim().min(1) });

const mcqNeedsOptions = {
  check: (data: { type: string; options?: unknown[]; correctOptionId?: string }) =>
    data.type !== "mcq" || (data.options && data.options.length >= 2 && data.correctOptionId),
  message: "MCQ questions need at least two options and a correct answer.",
} as const;

const questionFieldsSchema = z.object({
  text: z.string().trim().min(1),
  topic: z.string().trim().min(1),
  gradeBand: z.enum(["1-5", "6-9", "10-11", "12-13", "campus"]),
  batchId: z.string().uuid().optional(),
  type: z.enum(["mcq", "essay"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  marks: z.coerce.number().int().min(1),
  language: z.enum(["en", "si", "ta"]),
  options: z.array(optionSchema).optional(),
  correctOptionId: z.string().optional(),
});

const createQuestionSchema = questionFieldsSchema
  .extend({ ownerType: z.enum(["teacher", "class"]) })
  .refine(mcqNeedsOptions.check, { message: mcqNeedsOptions.message });

export async function createQuestion(input: {
  ownerType: "teacher" | "class";
  text: string;
  topic: string;
  gradeBand: string;
  batchId?: string;
  type: "mcq" | "essay";
  difficulty: "easy" | "medium" | "hard";
  marks: string;
  language: string;
  options?: { id: string; text: string }[];
  correctOptionId?: string;
}): Promise<ActionResult> {
  const parsed = createQuestionSchema.safeParse({
    ownerType: input.ownerType,
    text: input.text,
    topic: input.topic,
    gradeBand: input.gradeBand,
    batchId: input.batchId || undefined,
    type: input.type,
    difficulty: input.difficulty,
    marks: input.marks || "1",
    language: input.language || "en",
    options: input.type === "mcq" ? input.options : undefined,
    correctOptionId: input.type === "mcq" ? input.correctOptionId : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the question fields." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  let ownerId = user.id;
  if (parsed.data.ownerType === "class") {
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

  const { error } = await supabase.from("question_bank_items").insert({
    owner_type: parsed.data.ownerType,
    owner_id: ownerId,
    question_text: parsed.data.text,
    topic: parsed.data.topic,
    grade_band: parsed.data.gradeBand,
    batch_id: parsed.data.batchId ?? null,
    type: parsed.data.type,
    difficulty: parsed.data.difficulty,
    marks: parsed.data.marks,
    language: parsed.data.language,
    options: parsed.data.type === "mcq" ? parsed.data.options : null,
    correct_option_id: parsed.data.type === "mcq" ? parsed.data.correctOptionId : null,
  });
  if (error) {
    return { error: "Couldn't save this question. Please try again." };
  }
  return {};
}

const updateQuestionSchema = questionFieldsSchema.refine(mcqNeedsOptions.check, {
  message: mcqNeedsOptions.message,
});

export async function updateQuestion(
  questionId: string,
  input: {
    text: string;
    topic: string;
    gradeBand: string;
    batchId?: string;
    type: "mcq" | "essay";
    difficulty: "easy" | "medium" | "hard";
    marks: string;
    language: string;
    options?: { id: string; text: string }[];
    correctOptionId?: string;
  },
): Promise<ActionResult> {
  if (!questionId) {
    return { error: "Invalid question." };
  }
  const parsed = updateQuestionSchema.safeParse({
    text: input.text,
    topic: input.topic,
    gradeBand: input.gradeBand,
    batchId: input.batchId || undefined,
    type: input.type,
    difficulty: input.difficulty,
    marks: input.marks || "1",
    language: input.language || "en",
    options: input.type === "mcq" ? input.options : undefined,
    correctOptionId: input.type === "mcq" ? input.correctOptionId : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the question fields." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

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
      options: parsed.data.type === "mcq" ? parsed.data.options : null,
      correct_option_id: parsed.data.type === "mcq" ? parsed.data.correctOptionId : null,
    })
    .eq("id", questionId)
    .eq("owner_type", "teacher")
    .eq("owner_id", user.id);
  if (error) {
    return { error: "Couldn't update this question. Please try again." };
  }
  return {};
}

export async function deleteQuestion(questionId: string): Promise<ActionResult> {
  if (!questionId) {
    return { error: "Invalid question." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("question_bank_items").delete().eq("id", questionId);
  if (error) {
    return { error: "Couldn't delete this question. Please try again." };
  }
  return {};
}
