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
