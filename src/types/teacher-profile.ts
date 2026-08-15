import type { ReviewDisplay } from "./review";

/**
 * Full detail shape for a public teacher profile page. Mirrors
 * teacher_profiles (0004) + prices (0016, owner_type 'teacher') +
 * notes (0008, owner_type 'teacher') + live_classes (0012, owner_type
 * 'teacher') + reviews (0015). `name`/`masked` follow the same masking
 * convention as `Listing` — masking is baked into the mock string, not
 * computed at render time. Phone is deliberately NOT part of this type:
 * per 0004's get_teacher_contact(), it's never fetched for the public
 * profile and is always rendered as a locked placeholder instead.
 */
export type TeacherProfileDetail = {
  id: string;
  name: string;
  masked: boolean;
  headline: string;
  bio: string;
  location: string;
  classType: "physical" | "online" | "both";
  experienceYears: number;
  degree: string;
  subjects: string[];
  gradeLevels: string;
  rating: number;
  reviewCount: number;
  avatarInitials: string;
  hourlyRate?: number;
  monthlyRate?: number;
  adText: string;
  notes: { title: string; pages: number }[];
  schedule: { day: string; title: string; time: string }[];
  reviews: ReviewDisplay[];
};
