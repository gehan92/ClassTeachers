import type { ReviewDisplay } from "./review";

/**
 * Full detail shape for a public teacher profile page, built from
 * get_public_teacher_profile() (0026) + a direct batches select (0020,
 * publicly readable) + notes (0008, RLS-gated — only populated when the
 * current viewer is the owner, an enrolled student, or an admin) +
 * advertisements (0017, owner's own_profile placement ad, optional).
 * `name` always comes pre-masked from mask_display_name() — there is no
 * unmasked variant to fall back to on this page.
 */
export type TeacherProfileDetail = {
  id: string;
  name: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  classType: "physical" | "online" | "both";
  experienceYears: number | null;
  qualifications: string[];
  workExperience: string[];
  photoUrl: string | null;
  subjects: string[];
  languages: string[];
  gradeBand: string | null;
  rating: number;
  reviewCount: number;
  avatarInitials: string;
  hourlyRate?: number;
  monthlyRate?: number;
  adHeadline?: string;
  adText?: string;
  notesCount: number;
  notes: { id: string; title: string; pageCount: number | null }[];
  schedule: {
    id: string;
    title: string;
    mode: "online" | "physical";
    location: string | null;
    scheduleNote: string | null;
    gradeBand: string | null;
    /** Active search_results ad for this batch, if any — lets a viewer click through to its price/details (0041 removed pricing from this page). */
    adId: string | null;
  }[];
  reviews: ReviewDisplay[];
  phone: string | null;
  /** 'messaging_only' means `phone` is deliberately null even for an enrolled viewer — the teacher opted out of sharing it (0042). Distinguishes that from "not enrolled yet" so the UI can show the right reason. */
  contactMode: "phone" | "messaging_only";
};
