"use server";

import { createClient } from "@/lib/supabase/server";
import type { BulkImportQuestionInput } from "@/lib/dashboard/question-bank-actions";

// Gemini's inline (base64) request body caps out around 20MB total — base64
// inflates raw bytes by ~1.33x, so 10MB raw leaves headroom for the prompt
// text and JSON envelope on top of the encoded file.
const MAX_PDF_BYTES = 10 * 1024 * 1024;
// gemini-3.8-flash (the newest model, what most new API keys default to)
// tested consistently overloaded (503 "high demand") at the time this was
// wired up — verified directly against Gemini's own /v1beta/models listing
// and a real past-paper PDF. flash-lite is the same model family (native
// PDF understanding, same request/response shape) with far more headroom.
// Revisit if gemini-3.8-flash's availability improves later.
const GEMINI_MODEL = "gemini-3.1-flash-lite";

export type ExtractedQuestionRow = BulkImportQuestionInput & { answerSource?: "key" | "ai" };
type ExtractResult = { error?: string; questions: ExtractedQuestionRow[] };

/**
 * Parses Gemini's JSON-array response. Verified in testing that the model
 * can produce one malformed property somewhere in the MIDDLE of an
 * otherwise-complete response (not just get cut off at the end when it hits
 * the token ceiling) — re-running the identical request against the
 * identical PDF sometimes succeeds outright and sometimes doesn't, so this
 * is model output variance, not something the prompt alone can guarantee
 * away. Falls back to scanning for every individually-valid top-level
 * {...} object and skipping just the broken one(s), instead of discarding
 * the whole extraction (or everything after one bad entry) over it.
 */
function parseQuestionArray(rawText: string): unknown[] | null {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/```$/, "");
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    // fall through to per-object recovery below
  }

  const recovered: unknown[] = [];
  let depth = 0;
  let objectStart = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) objectStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objectStart !== -1) {
        try {
          recovered.push(JSON.parse(cleaned.slice(objectStart, i + 1)));
        } catch {
          // this one entry was malformed — skip it, keep scanning for the rest
        }
        objectStart = -1;
      }
    }
  }
  return recovered.length > 0 ? recovered : null;
}

const EXTRACTION_PROMPT = `You are helping a teacher digitize a past exam paper into a question bank.
Read the ENTIRE attached PDF carefully, start to finish, and return ONLY a JSON array (no prose, no markdown fences) of every question you can identify, in this exact shape:

[
  {
    "type": "mcq" | "essay" | "code",
    "text": "the question exactly as written",
    "options": ["option A text", "option B text", ...],
    "correctIndexes": [0],
    "answerSource": "key" | "ai",
    "marks": 2,
    "topic": "short lesson/chapter label if a section heading makes it clear, else omit"
  }
]

Rules:
- "options"/"correctIndexes"/"answerSource" apply to mcq questions only — omit all three entirely for essay/code questions.
- Strip the paper's own question number and option labels — do NOT include a leading "1.", "40)", "(2)", "Q3:" etc. on "text", and do NOT include a leading "(1)", "(2)", "A)" etc. on any "options" entry. The app assigns its own numbering and option labels (A/B/C/D) when it displays these later, so a number baked into the text itself would show up doubled. Everything else about the wording stays exactly as written.
- Determining the correct answer for each mcq question, in this order:
  1. First check the WHOLE document for an official answer key or marking scheme (often on a separate page, sometimes near the end, sometimes labeled "Answers"). If the correct answer is there, use it and set "answerSource": "key".
  2. If the document has no answer key, or it doesn't cover a particular question, work out the single most likely correct answer yourself using your own subject knowledge, and set "answerSource": "ai" so the teacher knows to double-check it.
  3. Only omit "correctIndexes"/"answerSource" entirely if you genuinely cannot determine any plausible answer even by reasoning — this should be rare.
- Preserve the original wording exactly, in its original language, aside from the stripped numbering above — do not paraphrase, correct, or translate it into a different language, even if a different language was requested elsewhere for classification purposes only.
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

  const requestBody = JSON.stringify({
    contents: [
      {
        parts: [
          { inline_data: { mime_type: "application/pdf", data: base64Pdf } },
          { text: EXTRACTION_PROMPT },
        ],
      },
    ],
    // A full past paper in Sinhala/Tamil script needs noticeably more output
    // tokens per character than English — 8000 was cutting real papers off
    // mid-array. 32768 gives real headroom while parseQuestionArray below
    // still salvages whatever completed if a paper is long enough to hit
    // even this ceiling.
    generationConfig: { maxOutputTokens: 32768, responseMimeType: "application/json" },
  });
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  // Gemini returns 503 when its servers are momentarily overloaded — this
  // clears on its own within seconds, so a couple of short retries avoids
  // making the teacher manually click Extract again for a transient blip.
  const maxAttempts = 3;
  let response: Response;
  try {
    let attempt = 1;
    while (true) {
      response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: requestBody,
      });
      if (response.status !== 503 || attempt >= maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      attempt += 1;
    }
  } catch {
    return { error: "Couldn't reach the extraction service. Please try again.", questions: [] };
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error(`Gemini extraction failed (${response.status}):`, errorBody);
    let detail = "";
    try {
      const parsedError = JSON.parse(errorBody) as { error?: { message?: string } };
      detail = parsedError.error?.message ?? "";
    } catch {
      // non-JSON error body, ignore
    }
    if (response.status === 503) {
      return { error: "Gemini is busy right now — please try again in a minute.", questions: [] };
    }
    return {
      error: detail
        ? `The PDF couldn't be read right now (${response.status}: ${detail}).`
        : `The PDF couldn't be read right now (error ${response.status}). Please try again in a moment.`,
      questions: [],
    };
  }

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };

  if (payload.promptFeedback?.blockReason) {
    console.error("Gemini blocked the prompt:", payload.promptFeedback.blockReason);
    return {
      error: `Gemini declined to process this PDF (${payload.promptFeedback.blockReason}). Try a different file, or add questions manually.`,
      questions: [],
    };
  }

  const candidate = payload.candidates?.[0];
  const textBlock = candidate?.content?.parts?.find((p) => typeof p.text === "string")?.text ?? "";

  if (!textBlock) {
    console.error(
      `Gemini returned no text. finishReason=${candidate?.finishReason ?? "unknown"}`,
      JSON.stringify(payload).slice(0, 2000)
    );
    if (candidate?.finishReason === "RECITATION") {
      return {
        error:
          "Gemini declined to reproduce this document (recitation/copyright check triggered by a real past paper). Try a different scan, or add these questions manually.",
        questions: [],
      };
    }
    if (candidate?.finishReason === "MAX_TOKENS") {
      return {
        error: "This PDF has too many questions for one pass. Try splitting it into smaller files.",
        questions: [],
      };
    }
    return {
      error: "Couldn't extract text from this PDF. Try a clearer scan, or add questions manually.",
      questions: [],
    };
  }

  const parsed = parseQuestionArray(textBlock);
  if (!parsed) {
    console.error("Gemini returned non-JSON text (truncated):", textBlock.slice(0, 2000));
    return {
      error: "Couldn't understand this PDF's structure. Try a clearer scan, or add questions manually.",
      questions: [],
    };
  }

  const questions: ExtractedQuestionRow[] = [];
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
    // The model is asked to always attempt an answer (from an answer key, or
    // its own reasoning when the paper doesn't have one) — default a valid
    // correctIndexes to "ai" if it forgot to tag its source, so the teacher
    // still sees a "please verify" signal rather than an unmarked answer.
    const answerSource =
      type === "mcq" && (correctIndexes?.length ?? 0) > 0
        ? r.answerSource === "key" || r.answerSource === "ai"
          ? r.answerSource
          : "ai"
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
      answerSource,
      multiSelect: type === "mcq" && (correctIndexes?.length ?? 0) > 1,
    });
  }

  if (questions.length === 0) {
    return {
      error: "Couldn't find any questions in this PDF. Try a clearer scan, or add questions manually.",
      questions: [],
    };
  }

  // The array parsed (possibly via salvage), but the response was still cut
  // off mid-stream — tell the teacher explicitly rather than letting them
  // assume this covers the whole paper.
  if (candidate?.finishReason === "MAX_TOKENS") {
    return {
      error: `Only reached ${questions.length} question(s) before the output limit — this paper may have more. Review what's below, then re-run on the remaining pages if needed.`,
      questions,
    };
  }

  return { questions };
}
