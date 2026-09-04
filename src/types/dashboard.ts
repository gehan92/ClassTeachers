export type DashboardTabDef = {
  key: string;
  label: string;
  count?: number;
  /** Small accent dot next to the label — unread "new content" notifications
   * exist for this tab (new note/exam/assignment/live class). Independent of
   * `count`, which on Exams/Assignments already means something else (items
   * still due), not "unseen." */
  hasNew?: boolean;
};

export type DashboardNavGroup = {
  /** Omit to render this group's items with no section header — used for a standalone "Overview" entry at the top of the sidebar. */
  label?: string;
  items: DashboardTabDef[];
};

// Teacher and Campus Lecturer share the same dashboard — "same tools,
// campus level" per the product spec — so both route to /teacher.
export type DemoRole = "student" | "teacher" | "class" | "lecturer" | "admin";
