import type { GradeBand } from "@/types/grade-band";

/**
 * Institute Blueprint step 5 — open/non-syllabus courses (Spoken English, an
 * elders' class) have no grade band at all, but every grade-band <Select>
 * across the app used a fixed 5-value list with no way to express "none".
 * Radix's Select rejects an empty-string item value, so this sentinel
 * stands in for null in component state and gets translated back to ""
 * (→ null server-side) right before the server action call.
 */
export const OPEN_GRADE_VALUE = "open" as const;

export const GRADE_BAND_SELECT_VALUES: (GradeBand | typeof OPEN_GRADE_VALUE)[] = [
  "1-5",
  "6-9",
  "10-11",
  "12-13",
  "campus",
  OPEN_GRADE_VALUE,
];
