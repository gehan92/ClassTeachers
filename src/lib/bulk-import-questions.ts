import type { BulkImportQuestionInput } from "@/lib/dashboard/question-bank-actions";

// Deliberately narrower than the general GradeBand type (which also has
// "adult", used elsewhere for search filtering) — question_bank_items'
// grade_band check constraint only allows these 5, same as the manual
// create-question form's schema.
type QuestionGradeBand = BulkImportQuestionInput["gradeBand"];
const GRADE_BANDS: QuestionGradeBand[] = ["1-5", "6-9", "10-11", "12-13", "campus"];
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const TYPES = ["mcq", "essay", "code"] as const;

export type ParsedBulkRow =
  | { ok: true; lineNumber: number; row: BulkImportQuestionInput }
  | { ok: false; lineNumber: number; message: string };

/**
 * Parses a tab-separated paste (the shape an Excel/Sheets copy naturally
 * produces between columns) into question rows — same "textarea + local
 * parser" convention as bulk-enrolling students by pasted phone numbers
 * (extractPhone, institute/students-tab.tsx), not a real CSV file/library.
 * Column order: Type, Question, Subject, Topic, Grade, Difficulty, Marks,
 * Option A, Option B, Option C, Option D, Option E, Option F, Correct,
 * Sample answer (Code type only). A first row starting with "type" is
 * treated as a header and skipped, so pasting straight from a template
 * sheet (header included) just works.
 */
export function parseBulkImportText(text: string, subjectIdByName: Map<string, string>): ParsedBulkRow[] {
  // Numbered against the RAW split (blank lines included) rather than a
  // pre-filtered one, so a caller can later remove specific lines from the
  // original pasted text by this same 1-based index (see BulkImportPanel's
  // partial-success handling) without the two numbering schemes drifting
  // apart whenever the paste has a stray blank line.
  const rawLines = text.split(/\r?\n/);
  const results: ParsedBulkRow[] = [];
  let seenFirstContentLine = false;

  rawLines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    const lineNumber = index + 1;
    const cols = line.split("\t").map((c) => c.trim());
    const [typeRaw, textRaw, subjectRaw, topicRaw, gradeRaw, difficultyRaw, marksRaw, ...rest] = cols;

    if (!seenFirstContentLine) {
      seenFirstContentLine = true;
      if ((typeRaw ?? "").toLowerCase() === "type") {
        return; // header row, skip silently
      }
    }

    const type = (typeRaw ?? "").toLowerCase() as (typeof TYPES)[number];
    if (!TYPES.includes(type)) {
      results.push({ ok: false, lineNumber, message: `Type must be MCQ, Essay, or Code (got "${typeRaw ?? ""}").` });
      return;
    }
    if (!textRaw) {
      results.push({ ok: false, lineNumber, message: "Question text is required." });
      return;
    }
    if (!topicRaw) {
      results.push({ ok: false, lineNumber, message: "Topic is required." });
      return;
    }
    const gradeBand = (gradeRaw ?? "") as QuestionGradeBand;
    if (!GRADE_BANDS.includes(gradeBand)) {
      results.push({ ok: false, lineNumber, message: `Grade must be one of ${GRADE_BANDS.join(", ")} (got "${gradeRaw ?? ""}").` });
      return;
    }
    const difficulty = (difficultyRaw ?? "").toLowerCase() as (typeof DIFFICULTIES)[number];
    if (!DIFFICULTIES.includes(difficulty)) {
      results.push({ ok: false, lineNumber, message: `Difficulty must be easy, medium, or hard (got "${difficultyRaw ?? ""}").` });
      return;
    }
    const marks = Number(marksRaw);
    if (!Number.isFinite(marks) || marks < 1) {
      results.push({ ok: false, lineNumber, message: `Marks must be a positive number (got "${marksRaw ?? ""}").` });
      return;
    }

    const subjectId = subjectRaw ? subjectIdByName.get(subjectRaw.trim().toLowerCase()) : undefined;
    const optionCols = rest.slice(0, 6);
    const correctRaw = rest[6] ?? "";
    const sampleAnswerRaw = rest[7] ?? "";

    if (type === "mcq") {
      const options = optionCols.filter((o) => o.length > 0);
      if (options.length < 2) {
        results.push({ ok: false, lineNumber, message: "MCQ needs at least 2 options (Option A/B columns)." });
        return;
      }
      const correctLetters = correctRaw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      if (correctLetters.length === 0) {
        results.push({ ok: false, lineNumber, message: 'MCQ needs a correct answer (e.g. "A" or "A,C").' });
        return;
      }
      const correctIndexes = correctLetters.map((letter) => letter.charCodeAt(0) - 65);
      if (correctIndexes.some((i) => i < 0 || i >= options.length)) {
        results.push({ ok: false, lineNumber, message: `Correct answer letter is out of range for ${options.length} options.` });
        return;
      }
      results.push({
        ok: true,
        lineNumber,
        row: {
          type,
          text: textRaw,
          subjectId,
          topic: topicRaw,
          gradeBand,
          difficulty,
          marks,
          language: "en",
          options,
          correctIndexes,
          multiSelect: correctIndexes.length > 1,
        },
      });
      return;
    }

    if (type === "code") {
      results.push({
        ok: true,
        lineNumber,
        row: {
          type,
          text: textRaw,
          subjectId,
          topic: topicRaw,
          gradeBand,
          difficulty,
          marks,
          language: "en",
          sampleAnswer: sampleAnswerRaw || undefined,
        },
      });
      return;
    }

    // essay — no answer key field exists yet (see the exam-system gap
    // analysis' rubric item), just the question itself.
    results.push({
      ok: true,
      lineNumber,
      row: { type, text: textRaw, subjectId, topic: topicRaw, gradeBand, difficulty, marks, language: "en" },
    });
  });

  return results;
}
