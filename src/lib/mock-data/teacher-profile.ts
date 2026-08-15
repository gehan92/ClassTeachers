import type { TeacherProfileDetail } from "@/types/teacher-profile";

/**
 * Placeholder data for Phase 1 (no Supabase project connected yet). Shaped
 * exactly like the real query result — see src/types/teacher-profile.ts.
 * Reuses the same fictional teachers seeded in ./listings' featuredListings
 * (t-1, t-2) for continuity across the homepage and profile pages.
 */
export const teacherProfiles: TeacherProfileDetail[] = [
  {
    id: "t-1",
    name: "Mr. P*** K***",
    masked: true,
    headline: "A/L Combined Maths & Physics · Individual Teacher · Galle",
    bio: "Over a decade of experience preparing A/L students for Combined Maths and Physics, with a focus on past-paper drilling and exam technique. Classes run in small batches so every student gets individual attention on weak areas. Notes are updated every term to match the latest syllabus revisions.",
    location: "Galle",
    classType: "both",
    experienceYears: 11,
    degree: "BSc (Hons) Mathematics, University of Colombo",
    subjects: ["Combined Maths", "Physics"],
    gradeLevels: "Grade 12–13 (A/L)",
    rating: 4.9,
    reviewCount: 128,
    avatarInitials: "P***",
    hourlyRate: 1500,
    monthlyRate: 5500,
    adText: "New intake for the 2027 A/L batch opens this month — limited seats for the online stream.",
    notes: [
      { title: "Combined Maths — Mechanics: Full Unit Pack", pages: 42 },
      { title: "Physics — Electricity & Magnetism Revision Notes", pages: 36 },
      { title: "2025 A/L Combined Maths Model Paper + Answers", pages: 18 },
    ],
    schedule: [
      { day: "Mon", title: "Combined Maths — Mechanics", time: "5:00 PM – 7:00 PM" },
      { day: "Wed", title: "Physics — Waves & Optics", time: "5:00 PM – 7:00 PM" },
      { day: "Sat", title: "Combined Maths — Past Paper Clinic", time: "9:00 AM – 12:00 PM" },
    ],
    reviews: [
      {
        id: "r-1",
        author: "Nimesha J.",
        date: "2026-06-02",
        rating: 5,
        body: "Explains mechanics in a way that finally made sense to me. The past paper sessions on Saturdays were the biggest help before the exam.",
        reply: "Thank you Nimesha, glad the Saturday clinic paid off — all the best for your results!",
      },
      {
        id: "r-2",
        author: "Kasun W.",
        date: "2026-04-18",
        rating: 5,
        body: "Very structured classes and the notes are excellent. Worth every rupee for the monthly plan.",
      },
      {
        id: "r-3",
        author: "Ishara D.",
        date: "2026-02-27",
        rating: 4,
        body: "Good teacher, sometimes classes run a bit long but the content covered is thorough.",
      },
    ],
  },
  {
    id: "t-2",
    name: "Mrs. S*** F***",
    masked: true,
    headline: "Grade 6–9 Science & ICT · Individual Teacher · Matara · Online",
    bio: "I teach Science and ICT for Grade 6–9 students entirely online, with recorded backups of every session so students never miss a topic. My approach mixes concept-building with hands-on lab demonstrations over video, and I keep parents updated on progress every month.",
    location: "Matara",
    classType: "online",
    experienceYears: 7,
    degree: "BSc Information Technology, SLIIT",
    subjects: ["Science", "ICT"],
    gradeLevels: "Grade 6–9",
    rating: 4.8,
    reviewCount: 76,
    avatarInitials: "S***",
    hourlyRate: undefined,
    monthlyRate: 6000,
    adText: "Free trial class available for new students joining the Grade 8 Science batch.",
    notes: [
      { title: "Grade 8 Science — Cells & Living Systems", pages: 24 },
      { title: "ICT — Intro to Spreadsheets Workbook", pages: 16 },
    ],
    schedule: [
      { day: "Tue", title: "Grade 8 Science — Living Systems", time: "4:00 PM – 5:00 PM" },
      { day: "Thu", title: "ICT — Spreadsheets & Data", time: "4:00 PM – 5:00 PM" },
    ],
    reviews: [
      {
        id: "r-4",
        author: "Chathura P.",
        date: "2026-05-10",
        rating: 5,
        body: "My daughter looks forward to these classes every week. The recorded sessions are a lifesaver when we miss one live.",
        reply: "So glad to hear that, thank you for the kind words!",
      },
      {
        id: "r-5",
        author: "Ruwani S.",
        date: "2026-03-22",
        rating: 4,
        body: "Clear explanations and good monthly progress updates. Would like a few more practice sheets though.",
      },
    ],
  },
];

export function getTeacherProfile(id: string): TeacherProfileDetail | undefined {
  return teacherProfiles.find((teacher) => teacher.id === id);
}
