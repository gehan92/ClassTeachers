import type { AttendanceRecord } from "@/types/attendance";

/**
 * Seed attendance (Phase 1, no Supabase project connected yet). Records are
 * auto-created when a student joins a live class or sits an exam — see
 * TeacherLiveClass/ExamSubmission usage in the teacher/student dashboards.
 * "stu-7" (Sithara Gunasekara, the signed-in demo student) is deliberately
 * left out of the tb-1 Mon 10 Aug session so the "Join" button on the
 * student dashboard has a visible effect the first time it's clicked.
 */
export const attendanceRecords: AttendanceRecord[] = [
  {
    id: "att-1",
    batchId: "tb-1",
    sessionLabel: "Combined Maths — Mechanics (Live Class)",
    date: "10 Aug 2026",
    studentId: "stu-1",
    studentName: "Nimali Perera",
    status: "present",
  },
  {
    id: "att-2",
    batchId: "tb-1",
    sessionLabel: "Combined Maths — Mechanics (Live Class)",
    date: "10 Aug 2026",
    studentId: "stu-3",
    studentName: "Tharushi Fernando",
    status: "present",
  },
  {
    id: "att-3",
    batchId: "tb-1",
    sessionLabel: "Combined Maths — Mechanics (Live Class)",
    date: "10 Aug 2026",
    studentId: "stu-6",
    studentName: "Ravindu Bandara",
    status: "absent",
  },
  {
    id: "att-4",
    batchId: "tb-2",
    sessionLabel: "Waves & Optics Quiz (Exam Sitting)",
    date: "28 Jul 2026",
    studentId: "stu-2",
    studentName: "Kasun Silva",
    status: "present",
  },
  {
    id: "att-5",
    batchId: "tb-2",
    sessionLabel: "Waves & Optics Quiz (Exam Sitting)",
    date: "28 Jul 2026",
    studentId: "stu-5",
    studentName: "Sanduni Rathnayake",
    status: "present",
  },
];
