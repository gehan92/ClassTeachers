import type { TeachersAtGlance, LinkedTeacher } from "@/types/dashboard-institute";
import type { ClassBatch } from "@/types/class-batch";
import type { ReviewDisplay } from "@/types/review";

/**
 * Placeholder data for Phase 1 (no Supabase project connected yet) for the
 * institute dashboard at src/app/[locale]/(dashboard)/institute/page.tsx.
 * Reuses "Horizon Learning Institute" (c-1) and its teachers (t-1, t-2, t-4)
 * from ./class-profile and ./teacher-profile for continuity, with real
 * (unmasked) names since this is the institute owner's own view of their
 * own linked teachers.
 */

export const teachersAtGlance: TeachersAtGlance[] = [
  { name: "Priyantha Kumara", subject: "Combined Maths & Physics", studentCount: 128, rating: 4.9, status: "active" },
  { name: "Shalini Fernando", subject: "Science & ICT", studentCount: 76, rating: 4.8, status: "active" },
  { name: "Nadeesha Rodrigo", subject: "English", studentCount: 64, rating: 4.6, status: "active" },
  { name: "Ruwan Jayasinghe", subject: "Business Studies", studentCount: 58, rating: 4.7, status: "active" },
  { name: "Dinusha Perera", subject: "Sinhala", studentCount: 51, rating: 4.5, status: "active" },
  {
    name: "Chamara Silva",
    subject: "Geography",
    studentCount: 35,
    rating: 4.4,
    status: "pending",
    statusNote: "Batch starts Sep 1",
  },
];

export const linkedTeachers: LinkedTeacher[] = [
  {
    id: "t-1",
    name: "Priyantha Kumara",
    masked: false,
    subject: "Combined Maths & Physics",
    rateDisplay: "Rs. 1,500/hr",
    studentCount: 128,
    visibleOnInstitutePage: true,
    status: "active",
    teacherHref: "/teacher/t-1",
  },
  {
    id: "t-2",
    name: "Shalini Fernando",
    masked: false,
    subject: "Science & ICT",
    rateDisplay: "Rs. 6,000/mo",
    studentCount: 76,
    visibleOnInstitutePage: true,
    status: "active",
    teacherHref: "/teacher/t-2",
  },
  {
    id: "t-4",
    name: "Nadeesha Rodrigo",
    masked: false,
    subject: "English",
    rateDisplay: "Rs. 1,000/hr",
    studentCount: 64,
    visibleOnInstitutePage: true,
    status: "active",
    teacherHref: "/teacher/t-4",
  },
  {
    id: "t-5",
    name: "Ruwan Jayasinghe",
    masked: false,
    subject: "Business Studies",
    rateDisplay: "Rs. 1,200/hr",
    studentCount: 58,
    visibleOnInstitutePage: true,
    status: "active",
    teacherHref: "/teacher/t-5",
  },
  {
    id: "t-6",
    name: "Dinusha Perera",
    masked: false,
    subject: "Sinhala",
    rateDisplay: "Rs. 900/hr",
    studentCount: 51,
    visibleOnInstitutePage: false,
    status: "active",
    teacherHref: "/teacher/t-6",
  },
  {
    id: "t-7",
    name: "Chamara Silva",
    masked: false,
    subject: "Geography",
    rateDisplay: "Rs. 1,000/hr",
    studentCount: 35,
    visibleOnInstitutePage: true,
    status: "active",
    teacherHref: "/teacher/t-7",
  },
  {
    id: "t-8",
    name: "Sanduni Wickrama",
    masked: false,
    subject: "Sinhala Literature",
    rateDisplay: "—",
    studentCount: 0,
    visibleOnInstitutePage: false,
    status: "invited",
    teacherHref: "/teacher/t-8",
  },
];

export const instituteBatches: ClassBatch[] = [
  {
    id: "b-1",
    title: "A/L Combined Maths — Batch A",
    teacherName: "Priyantha Kumara",
    teacherHref: "/teacher/t-1",
    status: "started",
    scheduleChips: ["Mon", "Wed", "5:00 PM"],
    priceAmount: 1500,
    priceInterval: "hr",
    studentIds: ["stu-1", "stu-3", "stu-6", "stu-7"],
  },
  {
    id: "b-2",
    title: "O/L Science — Batch B",
    teacherName: "Shalini Fernando",
    teacherHref: "/teacher/t-2",
    status: "started",
    scheduleChips: ["Tue", "Thu", "4:00 PM"],
    priceAmount: 6000,
    priceInterval: "mo",
    studentIds: ["ins-stu-1", "ins-stu-2", "ins-stu-3"],
  },
  {
    id: "b-3",
    title: "O/L English — Batch A",
    teacherName: "Nadeesha Rodrigo",
    teacherHref: "/teacher/t-4",
    status: "started",
    scheduleChips: ["Sat", "9:00 AM"],
    priceAmount: 1000,
    priceInterval: "hr",
    studentIds: ["ins-stu-4", "ins-stu-5"],
  },
  {
    id: "b-4",
    title: "A/L Geography — Batch A",
    teacherName: "Chamara Silva",
    teacherHref: "/teacher/t-7",
    status: "upcoming",
    statusNote: "Not started · opens Sep 1",
    scheduleChips: ["Fri", "4:00 PM"],
    priceAmount: 1000,
    priceInterval: "hr",
    studentIds: [],
  },
];

export const instituteReviews: ReviewDisplay[] = [
  {
    id: "ir-1",
    author: "Sithara G. (parent)",
    date: "2026-07-22",
    rating: 5,
    body: "All my children's subjects are covered under one institute now, makes pickup and drop-off so much easier. Mr. Kumara's Maths batch especially has been excellent.",
    tag: "A/L Combined Maths — Batch A",
  },
  {
    id: "ir-2",
    author: "Dilani T.",
    date: "2026-06-14",
    rating: 5,
    body: "Well organised institute with good communication about schedule changes and exam dates.",
    reply: "Thank you Dilani, we're glad the new notice system has been helpful!",
    tag: "O/L Science — Batch B",
  },
  {
    id: "ir-3",
    author: "Ruwan S.",
    date: "2026-05-03",
    rating: 4,
    body: "Good teachers overall, the English batch could use a slightly bigger classroom during peak season.",
    tag: "O/L English — Batch A",
  },
  {
    id: "ir-4",
    author: "Anusha K.",
    date: "2026-03-11",
    rating: 5,
    body: "My son's grades improved a lot since joining the Combined Maths batch here. Clear structure and regular past-paper practice.",
    tag: "A/L Combined Maths — Batch A",
  },
  {
    id: "ir-5",
    author: "Chathura P. (parent)",
    date: "2026-02-19",
    rating: 4,
    body: "Solid institute overall. The Science batch teacher explains concepts clearly, though a few more practice sheets would help.",
    tag: "O/L Science — Batch B",
  },
];
