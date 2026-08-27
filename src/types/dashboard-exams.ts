import type { GradeBand } from "./grade-band";

/**
 * Shared exam-system domain — used by both the teacher dashboard (question
 * bank management, exam building, grading) and the student dashboard
 * (sitting exams, viewing results). One shape for both sides so an exam
 * created by a teacher can be rendered as-is on the student side, no
 * translation layer. No Supabase project connected yet (Phase 1) — these
 * mirror the eventual exam_questions/exams/exam_submissions tables.
 */

export type McqOption = {
  id: string;
  text: string;
  /** Signed URL — set when this option carries a graph/diagram image. */
  imageUrl?: string;
};

/** One reusable question in a teacher's question bank. */
export type QuestionBankItem = {
  id: string;
  text: string;
  /** Lesson/unit label, e.g. "Mechanics — Kinematics". */
  topic: string;
  gradeBand: GradeBand;
  /** Optional — ties the question to one specific class/batch instead of the teacher's whole subject. */
  batchId?: string;
  type: "mcq" | "essay" | "code";
  difficulty: "easy" | "medium" | "hard";
  marks: number;
  language: "en" | "si" | "ta";
  /** MCQ only — any number of options (2+), one or more correct. */
  options?: McqOption[];
  /** MCQ only — ids of the correct entries in `options`. */
  correctOptionIds?: string[];
  /** MCQ only — the teacher's explicit choice of answer mode: false renders
   * radio buttons and requires exactly one correct option, true renders
   * checkboxes ("select all that apply") and allows several. Persisted
   * rather than inferred from correctOptionIds.length so a multi-answer
   * question mid-edit with only one option ticked still renders correctly
   * to students. */
  multiSelect?: boolean;
  /** Renders the question stem (and MCQ options) as a dark, monospace,
   * terminal-styled block instead of plain text — for IT/programming
   * questions with code in them. */
  codeFormat?: boolean;
  /** "code" type only — the teacher's own reference/expected answer, shown
   * only in the teacher's question bank and grading views, never sent to
   * the student. */
  sampleAnswer?: string;
  /** Signed URL — set when the question stem itself is a graph/diagram. */
  imageUrl?: string;
};

/** A teacher-built exam: a batch, a duration/timer, and a set of picked questions. */
export type ExamDef = {
  id: string;
  title: string;
  batchId: string;
  gradeBand: GradeBand;
  durationMin: number;
  scheduledAt: string;
  questionIds: string[];
  examType: "mcq" | "essay" | "mixed";
  status: "upcoming" | "open" | "closed";
};

/** One student's attempt at one exam. */
export type ExamSubmission = {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  state: "not_started" | "in_progress" | "submitted" | "graded";
  startedAt?: string;
  submittedAt?: string;
  /** MCQ answers — questionId -> selected optionId. */
  answers?: Record<string, string>;
  /** Essay submission — filenames of the student's uploaded sheets. */
  essayFiles?: string[];
  /** Auto-computed from `answers` against each question's `correctOptionId`. */
  autoScore?: number;
  maxScore?: number;
  /** Manually entered by the teacher when grading an essay portion. */
  teacherScore?: number;
  feedback?: string;
};
