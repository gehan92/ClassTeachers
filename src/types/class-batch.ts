/**
 * Display shape for one teacher/batch block within an institute — used on
 * both the public class profile page and the institute dashboard's
 * Classes & Batches tab. Mirrors class_teachers (0006) joined with
 * live_classes (0012) and prices (0016) for that teacher-in-class.
 */
export type ClassBatch = {
  id: string;
  title: string;
  teacherName: string;
  teacherHref: string;
  status: "started" | "upcoming";
  statusNote?: string;
  scheduleChips: string[];
  priceAmount: number;
  priceInterval: "hr" | "mo";
  /** Enrolled student ids for this batch — powers roster/attendance views. */
  studentIds: string[];
};
