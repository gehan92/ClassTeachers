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
  gradeChip: string;
  /** Structured filter fields for the /teachers search page — display strings above stay as the source of truth for card copy, these are just for matching. */
  location: string;
  online: boolean;
  gradeBand: GradeBand;
  avatarInitials: string;
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
