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
  type: "mcq" | "essay";
  difficulty: "easy" | "medium" | "hard";
  marks: number;
  /** MCQ only — exactly 4 options in practice, not enforced by the type. */
  options?: McqOption[];
  /** MCQ only — the id of the correct entry in `options`. */
  correctOptionId?: string;
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
