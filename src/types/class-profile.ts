import type { ReviewDisplay } from "./review";
import type { ClassBatch } from "./class-batch";

/**
 * Full detail shape for a public institute/class profile page. Mirrors
 * class_profiles (0005) + prices (owner_type 'class') + reviews (0015) +
 * batches (0020, owner_type 'class'). Phone comes from get_class_contact()
 * (0031) instead of being embedded here, same gating rationale as teacher
 * profiles' get_teacher_contact.
 */
export type ClassProfileDetail = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  classType: "physical" | "online" | "both";
  establishedText: string | null;
  photoUrl: string | null;
  /** Admin-reviewed document verification (0087) — same badge concept as a teacher listing's. */
  verified: boolean;
  teacherCount: number;
  rating: number;
  reviewCount: number;
  hourlyRate?: number;
  monthlyRate?: number;
  adHeadline?: string;
  adText?: string;
  batches: ClassBatch[];
  reviews: ReviewDisplay[];
  phone: string | null;
};
