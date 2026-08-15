import type {
  TeacherNote,
  TeacherBatch,
  TeacherLiveClass,
  EnrolledStudent,
} from "@/types/dashboard-teacher";
import type { ReviewDisplay } from "@/types/review";

/**
 * Placeholder data for Phase 1 (no Supabase project connected yet). Reuses
 * "Mr. P*** K***" / t-1 from listings & teacher-profile mock data for
 * continuity — the dashboard is that same teacher's own logged-in view, so
 * names here are unmasked (own data, not a public masked listing).
 */

export const teacherNotes: TeacherNote[] = [
  { title: "Combined Maths — Mechanics: Full Unit Pack", subject: "Combined Maths", pages: 42, views: 318 },
  { title: "Physics — Electricity & Magnetism Revision Notes", subject: "Physics", pages: 36, views: 244 },
  { title: "2025 A/L Combined Maths Model Paper + Answers", subject: "Combined Maths", pages: 18, views: 501 },
];

/**
 * This teacher's own classes/batches — distinct from an institute's
 * ClassBatch. Powers the Classes tab and is what exams/roster entries
 * below point at via batchId. See ./dashboard-exams.ts for the actual
 * question bank and exam definitions (shared with the student dashboard).
 */
export const teacherBatches: TeacherBatch[] = [
  {
    id: "tb-1",
    title: "A/L Combined Maths — Mon/Wed",
    gradeBand: "12-13",
    scheduleLabel: "Mon & Wed · 5:00 PM – 7:00 PM",
    studentIds: ["stu-1", "stu-3", "stu-6", "stu-7"],
  },
  {
    id: "tb-2",
    title: "A/L Physics — Wed",
    gradeBand: "12-13",
    scheduleLabel: "Wed · 5:00 PM – 7:00 PM",
    studentIds: ["stu-2", "stu-5"],
  },
  {
    id: "tb-3",
    title: "Past Paper Clinic — Sat",
    gradeBand: "12-13",
    scheduleLabel: "Sat · 9:00 AM – 12:00 PM",
    studentIds: ["stu-4"],
  },
];

export const teacherLiveClasses: TeacherLiveClass[] = [
  {
    title: "Combined Maths — Mechanics",
    day: "Monday",
    time: "5:00 PM – 7:00 PM",
    mode: "online",
    joinLink: "https://meet.classportals.lk/pk-mechanics-mon",
  },
  {
    title: "Physics — Waves & Optics",
    day: "Wednesday",
    time: "5:00 PM – 7:00 PM",
    mode: "online",
    joinLink: "https://meet.classportals.lk/pk-physics-wed",
  },
  {
    title: "Combined Maths — Past Paper Clinic",
    day: "Saturday",
    time: "9:00 AM – 12:00 PM",
    mode: "physical",
    location: "Piyal Kumara Study Centre, Galle",
  },
];

export const enrolledStudents: EnrolledStudent[] = [
  { id: "stu-1", name: "Nimali Perera", batchId: "tb-1", batch: "A/L Combined Maths — Mon/Wed", joinedAt: "Feb 2026", phone: "077 123 4567" },
  { id: "stu-2", name: "Kasun Silva", batchId: "tb-2", batch: "A/L Physics — Wed", joinedAt: "Jan 2026", phone: "071 234 5678" },
  { id: "stu-3", name: "Tharushi Fernando", batchId: "tb-1", batch: "A/L Combined Maths — Mon/Wed", joinedAt: "Mar 2026", phone: "076 345 6789" },
  { id: "stu-4", name: "Dinuka Jayasinghe", batchId: "tb-3", batch: "Past Paper Clinic — Sat", joinedAt: "Apr 2026", phone: "070 456 7890" },
  { id: "stu-5", name: "Sanduni Rathnayake", batchId: "tb-2", batch: "A/L Physics — Wed", joinedAt: "Jan 2026", phone: "075 567 8901" },
  { id: "stu-6", name: "Ravindu Bandara", batchId: "tb-1", batch: "A/L Combined Maths — Mon/Wed", joinedAt: "May 2026", phone: "072 678 9012" },
  { id: "stu-7", name: "Sithara Gunasekara", batchId: "tb-1", batch: "A/L Combined Maths — Mon/Wed", joinedAt: "Feb 2026", phone: "078 789 0123" },
];

export const teacherReviews: ReviewDisplay[] = [
  {
    id: "tr-1",
    author: "Nimali Perera",
    date: "3 Aug 2026",
    rating: 5,
    body: "Best Combined Maths classes I've attended. The past paper clinic on Saturdays made all the difference for exam technique.",
    reply: "Thank you Nimali, glad the Saturday sessions are helping — keep up the steady practice!",
    tag: "A/L Combined Maths",
  },
  {
    id: "tr-2",
    author: "Kasun Silva",
    date: "27 Jul 2026",
    rating: 5,
    body: "Very clear explanations for Electricity & Magnetism. Notes are well organised and updated for the new syllabus.",
    reply: "Thanks Kasun — happy to hear the updated notes are working well for you.",
    tag: "A/L Physics",
  },
  {
    id: "tr-3",
    author: "Tharushi Fernando",
    date: "19 Jul 2026",
    rating: 4,
    body: "Good pace overall, though I'd love a few more worked examples on Mechanics before the unit test.",
    tag: "A/L Combined Maths",
  },
  {
    id: "tr-4",
    author: "Dinuka Jayasinghe",
    date: "5 Jul 2026",
    rating: 5,
    body: "The Saturday past paper clinic is excellent — direct, honest feedback on every attempt.",
    reply: "Appreciate that, Dinuka — see you this Saturday.",
    tag: "Past Paper Clinic",
  },
  {
    id: "tr-5",
    author: "Sanduni Rathnayake",
    date: "22 Jun 2026",
    rating: 5,
    body: "Waves & Optics finally makes sense. Thank you for always answering questions after class.",
    tag: "A/L Physics",
  },
];
