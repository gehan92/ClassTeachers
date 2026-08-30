import type { GradeBand } from "./grade-band";

/** Shape of a homepage/search-result card — see src/lib/public-directory.ts for the real query behind it. */
export type Listing = {
  id: string;
  kind: "teacher" | "class";
  /** Full name/institute name. Masking for guests happens at render time via `masked`. */
  name: string;
  masked: boolean;
  roleLabel: string;
  /** Ad title/excerpt — populated for ad-driven listings (teacher ads, 0040; institute class-wise ads, 0103); undefined for a whole-institute profile card, which has no single ad behind it. */
  headline?: string;
  excerpt?: string;
  gradeChip: string;
  /** Structured filter fields for the /teachers search page — display strings above stay as the source of truth for card copy, these are just for matching. */
  location: string;
  online: boolean;
  /** Null when the listing has no subjects linked yet to infer a level from (and isn't a campus lecturer). */
  gradeBand: GradeBand | null;
  /** Every grade level this listing actually covers — a single-item array for a teacher ad (one grade per ad), but potentially several for an institute spanning multiple grades across its teachers. Filtering should match against this, not the single `gradeBand` above. */
  gradeBands: GradeBand[];
  avatarInitials: string;
  photoUrl?: string;
  /** Admin-reviewed document verification (0075/0076, extended to every teacher/institute by 0087) — orthogonal to campusCredential below, which is purely about the campus-lecturer academic fields. */
  verified: boolean;
  rating: number;
  reviewCount: number;
  subjects: string[];
  price: {
    amount: number;
    currency: "LKR";
    interval: "hr" | "mo";
    fromPrice?: boolean;
  };
  href: string;
  /** Set for a `kind: "teacher"` listing whose account role is `campus_lecturer` — swaps the card's role label to the academic institution/title instead of the generic "Individual Teacher" one. Undefined for classes, which have no such distinction. Verification status lives on the top-level `verified` field above, not here — it applies the same way regardless of campus-lecturer status. */
  campusCredential?: {
    institution: string | null;
    academicTitle: string | null;
    courseCode: string | null;
  };
};
