import type { ReviewDisplay } from "./review";
import type { ClassBatch } from "./class-batch";

/**
 * Full detail shape for a public institute/class profile page. Mirrors
 * class_profiles (0005) + prices (0016, owner_type 'class') + reviews
 * (0015). `batches` are the individual teacher/batch cards drawn from
 * class_teachers (0006) joined with live_classes/prices — same shape the
 * institute dashboard's Classes & Batches tab consumes. Phone is
 * deliberately not part of this type, same rationale as teacher profiles.
 */
export type ClassProfileDetail = {
  id: string;
  name: string;
  description: string;
  location: string;
  classType: "physical" | "online" | "both";
  establishedYear: number;
  teacherCount: number;
  rating: number;
  reviewCount: number;
  hourlyRate?: number;
  monthlyRate?: number;
  adText: string;
  batches: ClassBatch[];
  reviews: ReviewDisplay[];
};
