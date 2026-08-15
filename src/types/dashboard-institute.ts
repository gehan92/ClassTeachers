/**
 * Display shapes for the institute (class) owner's dashboard. No Supabase
 * wiring yet — these mirror the eventual query results (class_teachers,
 * live_classes, reviews) but are backed by mock data for now.
 */

/** One row in the Overview tab's "Teachers at a glance" summary table. */
export type TeachersAtGlance = {
  name: string;
  subject: string;
  studentCount: number;
  rating: number;
  status: "active" | "pending";
  /** Shown instead of the default "Active" label when status is "pending". */
  statusNote?: string;
};

/**
 * One row in the Teachers tab's management table. This is the institute
 * owner's own view of their linked teachers, so names are never masked
 * (contrast with the public class profile, which masks teacher names).
 */
export type LinkedTeacher = {
  id: string;
  name: string;
  masked: false;
  subject: string;
  rateDisplay: string;
  studentCount: number;
  visibleOnInstitutePage: boolean;
  status: "active" | "invited";
  teacherHref: string;
};
