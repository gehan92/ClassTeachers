/**
 * Attendance for a class/batch session (a live class occurrence or an exam
 * sitting). Records are created automatically when a student joins a live
 * class or starts/submits an exam for that batch — see the teacher
 * dashboard's Attendance tab for the report view.
 */
export type AttendanceRecord = {
  id: string;
  batchId: string;
  /** e.g. "Mon 10 Aug — Live Class" or "Waves & Optics Quiz — Sitting". */
  sessionLabel: string;
  date: string;
  studentId: string;
  studentName: string;
  status: "present" | "absent" | "late";
};
