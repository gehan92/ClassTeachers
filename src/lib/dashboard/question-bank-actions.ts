"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

const optionSchema = z.object({ id: z.string(), text: z.string().trim().min(1) });

const createQuestionSchema = z
  .object({
    ownerType: z.enum(["teacher", "class"]),
    text: z.string().trim().min(1),
    topic: z.string().trim().min(1),
    gradeBand: z.enum(["1-5", "6-9", "10-11", "12-13", "campus"]),
    batchId: z.string().uuid().optional(),
    type: z.enum(["mcq", "essay"]),
    difficulty: z.enum(["easy", "medium", "hard"]),
    marks: z.coerce.number().int().min(1),
    options: z.array(optionSchema).optional(),
    correctOptionId: z.string().optional(),
  })
  .refine((data) => data.type !== "mcq" || (data.options && data.options.length >= 2 && data.correctOptionId), {
    message: "MCQ questions need at least two options and a correct answer.",
  });

export async function createQuestion(input: {
  ownerType: "teacher" | "class";
  text: string;
  topic: string;
  gradeBand: string;
  batchId?: string;
  type: "mcq" | "essay";
  difficulty: "easy" | "medium" | "hard";
  marks: string;
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
    options: parsed.data.type === "mcq" ? parsed.data.options : null,
    correct_option_id: parsed.data.type === "mcq" ? parsed.data.correctOptionId : null,
  });
  if (error) {
    return { error: "Couldn't save this question. Please try again." };
  }
  return {};
}
