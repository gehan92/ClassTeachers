import type { ClassProfileDetail } from "@/types/class-profile";

/**
 * Placeholder data for Phase 1 (no Supabase project connected yet). Shaped
 * exactly like the real query result — see src/types/class-profile.ts.
 * c-1 matches "Horizon Learning Institute" seeded in ./listings'
 * featuredListings for continuity across the homepage and profile pages.
 */
export const classProfiles: ClassProfileDetail[] = [
  {
    id: "c-1",
    name: "Horizon Learning Institute",
    description:
      "Horizon Learning Institute has been running O/L and A/L tuition classes in Matara since 2014. We bring together six subject specialists under one roof, with shared facilities, coordinated timetables, and a single point of contact for enrollment, notes, and exam schedules across every subject we offer.",
    location: "Matara",
    classType: "physical",
    establishedYear: 2014,
    teacherCount: 6,
    rating: 4.7,
    reviewCount: 211,
    hourlyRate: 1200,
    monthlyRate: 4500,
    adText: "Enrollment for the O/L 2027 group is now open across all subjects — early-bird pricing until end of month.",
    batches: [
      {
        id: "b-1",
        title: "O/L Combined Maths — Batch A",
        teacherName: "Mr. P*** K***",
        teacherHref: "/teacher/t-1",
        status: "started",
        scheduleChips: ["Mon", "Wed", "5:00 PM"],
        priceAmount: 1500,
        priceInterval: "hr",
        studentIds: [],
      },
      {
        id: "b-2",
        title: "O/L Science — Batch B",
        teacherName: "Mrs. S*** F***",
        teacherHref: "/teacher/t-2",
        status: "upcoming",
        statusNote: "Starts 1 Sep",
        scheduleChips: ["Tue", "Thu", "4:00 PM"],
        priceAmount: 6000,
        priceInterval: "mo",
        studentIds: [],
      },
      {
        id: "b-3",
        title: "O/L English — Batch A",
        teacherName: "Ms. N*** R***",
        teacherHref: "/teacher/t-4",
        status: "started",
        scheduleChips: ["Sat", "9:00 AM"],
        priceAmount: 1000,
        priceInterval: "hr",
        studentIds: [],
      },
    ],
    reviews: [
      {
        id: "r-6",
        author: "Dilani T.",
        date: "2026-06-14",
        rating: 5,
        body: "All my children's subjects are covered under one institute now, makes pickup and drop-off so much easier.",
        tag: "A/L Combined Maths — Batch A",
      },
      {
        id: "r-7",
        author: "Sampath R.",
        date: "2026-05-03",
        rating: 5,
        body: "Well organised institute with good communication about schedule changes and exam dates.",
        reply: "Thank you Sampath, we're glad the new notice system has been helpful!",
      },
      {
        id: "r-8",
        author: "Anusha G.",
        date: "2026-03-11",
        rating: 4,
        body: "Good teachers overall, the Science batch could use a slightly bigger classroom.",
        tag: "O/L Science — Batch B",
      },
    ],
  },
];

export function getClassProfile(id: string): ClassProfileDetail | undefined {
  return classProfiles.find((classProfile) => classProfile.id === id);
}
