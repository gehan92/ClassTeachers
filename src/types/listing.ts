import type { GradeBand } from "./grade-band";

/**
 * Shape of a homepage/search-result card. Deliberately mirrors what the
 * eventual Supabase query (teacher_profiles / class_profiles joined with
 * subjects, prices, and review aggregates) will return, so swapping the
 * mock data in src/lib/mock-data.ts for a real `supabase.from(...)` query
 * is a one-line change per call site, not a component rewrite.
 */
export type Listing = {
  id: string;
  kind: "teacher" | "class";
  /** Full name/institute name. Masking for guests happens at render time via `masked`. */
  name: string;
  masked: boolean;
  roleLabel: string;
  /** Ad title/excerpt — only populated for ad-driven teacher listings (0040); undefined for classes, which have no ad system yet. */
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
};
