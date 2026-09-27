"use server";

import { createClient } from "@/lib/supabase/server";
import type { BulkImportQuestionInput } from "@/lib/dashboard/question-bank-actions";

// Gemini's inline (base64) request body caps out around 20MB total — base64
// inflates raw bytes by ~1.33x, so 10MB raw leaves headroom for the prompt
// text and JSON envelope on top of the encoded file.
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const GEMINI_MODEL = "gemini-2.5-flash";

type ExtractResult = { error?: string; questions: BulkImportQuestionInput[] };

const EXTRACTION_PROMPT = `You are helping a teacher digitize a past exam paper into a question bank.
Read the attached PDF carefully and return ONLY a JSON array (no prose, no markdown fences) of every question you can identify, in this exact shape:

[
  {
    "type": "mcq" | "essay" | "code",
    "text": "the question exactly as written",
    "options": ["option A text", "option B text", ...],
    "correctIndexes": [0],
    "marks": 2,
    "topic": "short lesson/chapter label if a section heading makes it clear, else omit"
  }
]

Rules:
- "options"/"correctIndexes" apply to mcq questions only — omit both fields entirely for essay/code questions.
- OMIT "correctIndexes" entirely if the paper does not show an answer key or you cannot determine the correct answer with real confidence. Never guess — a missing answer is fine, a wrong one is not.
- Preserve the original wording exactly — do not paraphrase or correct it.
- One entry per question. If a question has sub-parts (a), (b), (c) graded together, keep it as one entry with the sub-parts in the text; if they are clearly separate marks/questions, split them.
- Classify short-answer/structured/long-answer questions as "essay" and programming/code questions as "code".
- Include "marks" only when explicitly stated for that question.
- If the document is not an exam paper or you find no questions, return an empty array [].
- Return ONLY the JSON array, nothing else — no markdown code fence, no explanation.`;

/**
 * Sends an uploaded past-paper PDF straight to Gemini as an inline document
 * (native PDF support handles both digital text and scanned/image pages in
 * one pass, no separate OCR/text-extraction library needed) and asks it to
 * structure every question it finds into our schema. Returns the extracted
 * rows for the teacher to review/edit before anything is saved — this never
 * writes to question_bank_items itself, the actual insert happens through
 * the existing bulkImportQuestions action once the teacher confirms (and
 * fixes up) what came back.
 *
 * gradeBand/difficulty/language/subjectId/paperYear/semester are the
 * teacher's own classification choices (set once for the whole paper, same
 * "batch-level settings" pattern as the paste-based bulk import) — the AI
 * only extracts text/options/correctness/marks/topic, which is what it can
 * actually read off the page; it has no idea what this app's grade-band
 * taxonomy means.
 */
export async function extractQuestionsFromPdf(formData: FormData): Promise<ExtractResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      error: "PDF import isn't set up yet — it needs a Gemini API key added to the server's environment first.",
      questions: [],
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a PDF file.", questions: [] };
  }
  if (file.type !== "application/pdf") {
    return { error: "Please upload a PDF file.", questions: [] };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { error: "This PDF is too large (max 15MB).", questions: [] };
  }

  const gradeBandRaw = formData.get("gradeBand");
  const gradeBand =
    typeof gradeBandRaw === "string" && ["1-5", "6-9", "10-11", "12-13", "campus"].includes(gradeBandRaw)
      ? (gradeBandRaw as BulkImportQuestionInput["gradeBand"])
      : "12-13";
  const difficultyRaw = formData.get("difficulty");
  const difficulty =
    typeof difficultyRaw === "string" && ["easy", "medium", "hard"].includes(difficultyRaw)
      ? (difficultyRaw as BulkImportQuestionInput["difficulty"])
      : "medium";
  const languageRaw = formData.get("language");
  const language =
    typeof languageRaw === "string" && ["en", "si", "ta", "other"].includes(languageRaw)
      ? (languageRaw as BulkImportQuestionInput["language"])
      : "en";
  const subjectIdRaw = formData.get("subjectId");
  const subjectId = typeof subjectIdRaw === "string" && subjectIdRaw ? subjectIdRaw : undefined;
  const paperYearRaw = formData.get("paperYear");
  const paperYear =
    typeof paperYearRaw === "string" && paperYearRaw.trim() && Number.isFinite(Number(paperYearRaw))
      ? Number(paperYearRaw)
      : undefined;
  const semesterRaw = formData.get("semester");
  const semester = typeof semesterRaw === "string" && semesterRaw.trim() ? semesterRaw.trim() : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in.", questions: [] };
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64Pdf = Buffer.from(arrayBuffer).toString("base64");

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: "application/pdf", data: base64Pdf } },
                { text: EXTRACTION_PROMPT },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 8000, responseMimeType: "application/json" },
        }),
      }
    );
  } catch {
    return { error: "Couldn't reach the extraction service. Please try again.", questions: [] };
  }

  if (!response.ok) {
    return { error: "The PDF couldn't be read right now. Please try again in a moment.", questions: [] };
  }

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const textBlock = payload.candidates?.[0]?.content?.parts?.find((p) => typeof p.text === "string")?.text ?? "";

  let parsed: unknown;
  try {
    // Defensive: strip a markdown code fence if the model added one despite
    // being told not to.
    const cleaned = textBlock
      .trim()
      .replace(/^```(?:json)?\n?/, "")
      .replace(/```$/, "");
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      error: "Couldn't understand this PDF's structure. Try a clearer scan, or add questions manually.",
      questions: [],
    };
  }

  if (!Array.isArray(parsed)) {
    return { error: "Couldn't find any questions in this PDF.", questions: [] };
  }

  const questions: BulkImportQuestionInput[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const type = r.type === "mcq" || r.type === "essay" || r.type === "code" ? r.type : null;
    const text = typeof r.text === "string" ? r.text.trim() : "";
    if (!type || !text) continue;

    const options =
      type === "mcq" && Array.isArray(r.options)
        ? r.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0)
        : undefined;
    const correctIndexes =
      type === "mcq" && Array.isArray(r.correctIndexes)
        ? r.correctIndexes.filter((i): i is number => typeof i === "number" && Number.isInteger(i) && i >= 0)
        : undefined;
    const marks = typeof r.marks === "number" && Number.isFinite(r.marks) && r.marks >= 1 ? Math.round(r.marks) : 1;
    const topic = typeof r.topic === "string" && r.topic.trim() ? r.topic.trim() : "General";

    questions.push({
      type,
      text,
      topic,
      subjectId,
      gradeBand,
      difficulty,
      marks,
      language,
      paperYear,
      semester,
      options,
      correctIndexes,
      multiSelect: type === "mcq" && (correctIndexes?.length ?? 0) > 1,
    });
  }

  if (questions.length === 0) {
    return {
      error: "Couldn't find any questions in this PDF. Try a clearer scan, or add questions manually.",
      questions: [],
    };
  }

  return { questions };
}
