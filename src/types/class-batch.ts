/**
 * Display shape for one batch card on the public institute profile page.
 * Mirrors `batches` (0020) for owner_type = 'class'. `teacherName` comes
 * from `teacher_label` — free text, not a teacher_id FK (see 0020's comment:
 * linking batch creation to the real class_teachers relationship depends on
 * a teacher-invite flow that isn't built yet) — so there's no real per-batch
 * teacher profile link or per-batch price to show, only what's on the row.
 */
export type ClassBatch = {
  id: string;
  title: string;
  teacherName: string | null;
  status: "started" | "upcoming";
  mode: "online" | "physical";
  location: string | null;
  scheduleNote: string | null;
  /** Active search_results ads for this batch (0103/0104) — the ad copy an
   * institute wrote in the Advertisement tab, shown here too so a visitor
   * reading this profile sees the same pitch a search card would show. */
  ads: { id: string; title: string; content: string }[];
  /** Open-enrollment (0106) — any signed-in student joins this batch
   * instantly, no accept/decline step. capacity null means unlimited. */
  isOpenEnrollment: boolean;
  capacity: number | null;
  spotsTaken: number;
};
