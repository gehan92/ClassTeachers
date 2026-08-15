/**
 * Display shapes for the Student Dashboard. Placeholder data for Phase 1
 * (no Supabase project connected yet) — see src/lib/mock-data/dashboard-student.ts.
 */

/** A teacher or class the student has actually joined — see 01-Project-Overview.md §9. */
export type Enrollment = {
  id: string;
  targetType: "teacher" | "class";
  targetName: string;
  targetHref: string;
  subject: string;
  scheduleSummary: string;
  priceDisplay: string;
  /** Links to a TeacherBatch/ClassBatch id — when set, exams/attendance for that batch appear on this dashboard. Not every enrollment maps to a modeled batch yet. */
  batchId?: string;
};

/** Live class row on the student's own dashboard — mirrors the 3-state join progression (03-Full-Scenarios §3). */
export type StudentLiveClass = {
  id: string;
  title: string;
  teacherName: string;
  scheduledLabel: string;
  mode: "online" | "physical";
  joinLink?: string;
  state: "not_open" | "starting_soon" | "live";
};

/** An unlocked note — student has joined the teacher, so no LockPill here (that's the guest view only). */
export type StudentNote = {
  id: string;
  title: string;
  subject: string;
  teacherName: string;
  pages: number;
};

/**
 * Exam-taking uses the shared ExamDef/ExamSubmission types from
 * ./dashboard-exams.ts instead of a bespoke student-only shape — see
 * src/components/dashboard/student/exams-tab.tsx.
 */

/** A review the student has already left for a joined teacher/class. */
export type StudentReview = {
  id: string;
  targetName: string;
  rating: number;
  body: string;
  date: string;
};
