import type { GradeBand } from "./grade-band";

/**
 * Display shapes for the teacher dashboard tabs. No Supabase project is
 * wired up yet (Phase 1) — these mirror the eventual query results closely
 * enough to swap in real data later without reshaping the UI.
 *
 * Exam/question-bank types live in ./dashboard-exams.ts instead — shared
 * with the student dashboard so an exam a teacher builds renders as-is on
 * the student side.
 */

export type TeacherNote = {
  title: string;
  subject: string;
  pages: number;
  views: number;
};

/**
 * A standalone teacher's own class/batch (distinct from ClassBatch, which
 * models a teacher's block *within* an institute). What ExamDef.batchId
 * and EnrolledStudent.batchId point at for a solo teacher like this
 * dashboard's demo account.
 */
export type TeacherBatch = {
  id: string;
  title: string;
  gradeBand: GradeBand;
  scheduleLabel: string;
  studentIds: string[];
};

export type TeacherLiveClass = {
  title: string;
  day: string;
  time: string;
  mode: "online" | "physical";
  location?: string;
  joinLink?: string;
};

export type EnrolledStudent = {
  id: string;
  name: string;
  batchId: string;
  /** Display label kept alongside batchId — avoids a lookup in every table row. */
  batch: string;
  joinedAt: string;
  phone: string;
};
