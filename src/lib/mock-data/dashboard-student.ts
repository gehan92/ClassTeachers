import type {
  Enrollment,
  StudentLiveClass,
  StudentNote,
  StudentReview,
} from "@/types/dashboard-student";

/**
 * Placeholder data for the signed-in student "Sithara Gunasekara" (Phase 1,
 * no Supabase project connected yet). Reuses listing ids t-1/c-1 from
 * src/lib/mock-data/listings.ts for continuity with the public profiles.
 * Also reuses "stu-7" from dashboard-teacher.ts's enrolledStudents/
 * teacherBatches — she really is on Mr. Kumara's tb-1 roster, so exam and
 * attendance data line up between the two dashboards' seed data.
 */

/** The one signed-in demo student — id used everywhere a submission/attendance row needs to be attributable to "me". */
export const CURRENT_STUDENT = { id: "stu-7", name: "Sithara Gunasekara" };

export const studentEnrollments: Enrollment[] = [
  {
    id: "enr-1",
    targetType: "teacher",
    targetName: "Mr. Priyantha Kumara",
    targetHref: "/teacher/t-1",
    subject: "Combined Maths",
    scheduleSummary: "Mon & Wed · 6:00 PM – 7:30 PM",
    priceDisplay: "Rs. 1,500 / hr",
    batchId: "tb-1",
  },
  {
    id: "enr-2",
    targetType: "class",
    targetName: "Horizon Learning Institute",
    targetHref: "/class/c-1",
    subject: "O/L All subjects",
    scheduleSummary: "Sat 9:00 AM – 12:00 PM",
    priceDisplay: "From Rs. 1,200 / hr",
  },
  {
    id: "enr-3",
    targetType: "teacher",
    targetName: "Mrs. Samanthi Fernando",
    targetHref: "/teacher/t-2",
    subject: "Science",
    scheduleSummary: "Tue & Thu · 4:00 PM – 5:30 PM · Online",
    priceDisplay: "Rs. 6,000 / mo",
  },
];

export const studentLiveClasses: StudentLiveClass[] = [
  {
    id: "live-1",
    title: "Combined Maths — Mechanics Revision",
    teacherName: "Mr. Priyantha Kumara",
    scheduledLabel: "Today · 6:00 PM",
    mode: "online",
    joinLink: "https://meet.google.com/xxx-yyyy-zzz",
    state: "live",
  },
  {
    id: "live-2",
    title: "Science — Periodic Table Deep Dive",
    teacherName: "Mrs. Samanthi Fernando",
    scheduledLabel: "Today · 8:00 PM",
    mode: "online",
    joinLink: "https://meet.google.com/aaa-bbbb-ccc",
    state: "starting_soon",
  },
  {
    id: "live-3",
    title: "O/L All Subjects — Weekly Paper Class",
    teacherName: "Horizon Learning Institute",
    scheduledLabel: "Saturday · 9:00 AM",
    mode: "physical",
    state: "not_open",
  },
];

export const studentNotes: StudentNote[] = [
  {
    id: "note-1",
    title: "Vectors & Statics — Full Unit Pack",
    subject: "Combined Maths",
    teacherName: "Mr. Priyantha Kumara",
    pages: 24,
  },
  {
    id: "note-2",
    title: "Complex Numbers — Worked Examples",
    subject: "Combined Maths",
    teacherName: "Mr. Priyantha Kumara",
    pages: 16,
  },
  {
    id: "note-3",
    title: "Periodic Table & Bonding",
    subject: "Science",
    teacherName: "Mrs. Samanthi Fernando",
    pages: 12,
  },
  {
    id: "note-4",
    title: "Cell Structure & Function",
    subject: "Science",
    teacherName: "Mrs. Samanthi Fernando",
    pages: 18,
  },
  {
    id: "note-5",
    title: "O/L Maths — Model Paper Solutions",
    subject: "Maths",
    teacherName: "Horizon Learning Institute",
    pages: 9,
  },
  {
    id: "note-6",
    title: "English — Essay Writing Toolkit",
    subject: "English",
    teacherName: "Horizon Learning Institute",
    pages: 7,
  },
  {
    id: "note-7",
    title: "Mechanics — Past Paper Breakdown 2023",
    subject: "Combined Maths",
    teacherName: "Mr. Priyantha Kumara",
    pages: 21,
  },
  {
    id: "note-8",
    title: "Science — Practical Report Templates",
    subject: "Science",
    teacherName: "Mrs. Samanthi Fernando",
    pages: 6,
  },
];

/**
 * Exam-taking uses the shared examDefs/examSubmissions from
 * ./dashboard-exams.ts instead of a bespoke array here — filter examDefs
 * by batchId against studentEnrollments' batchId to get "my exams", and
 * examSubmissions by studentId === CURRENT_STUDENT.id for attempt state.
 */

export const studentReviews: StudentReview[] = [
  {
    id: "rev-1",
    targetName: "Mr. Priyantha Kumara",
    rating: 5,
    body: "Explains mechanics really clearly and always answers questions after class. Highly recommend.",
    date: "12 Jul 2026",
  },
  {
    id: "rev-2",
    targetName: "Horizon Learning Institute",
    rating: 4,
    body: "Well organised weekly papers, though the Saturday class sometimes starts a few minutes late.",
    date: "2 Jun 2026",
  },
];
