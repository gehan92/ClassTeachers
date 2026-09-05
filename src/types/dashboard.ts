export type DashboardTabDef = {
  key: string;
  label: string;
  count?: number;
  /** Small accent dot next to the label — unread "new content" notifications
   * exist for this tab (new note/exam/assignment/live class). Independent of
   * `count`, which on Exams/Assignments already means something else (items
   * still due), not "unseen." */
  hasNew?: boolean;
  /** Gives this tab a permanent accent (cta-colored) treatment instead of the
   * plain nav-item look, regardless of active/inactive state — for a
   * featured action sitting outside its usual group (e.g. "Post an Ad"),
   * not a status indicator like `hasNew`/`count`. */
  highlight?: boolean;
};

export type DashboardNavGroup = {
  /** Omit to render this group's items with no section header — used for a standalone "Overview" entry at the top of the sidebar. */
  label?: string;
  /** Stable, untranslated id for this group — looked up in dashboard-shell.tsx's GROUP_ICONS map and used as the collapse-state key. Required whenever `label` is set (the label alone can't key anything since it's translated text that differs per locale); leave both unset for the top standalone-items group. */
  key?: string;
  items: DashboardTabDef[];
};

// Teacher and Campus Lecturer share the same dashboard — "same tools,
// campus level" per the product spec — so both route to /teacher.
export type DemoRole = "student" | "teacher" | "class" | "lecturer" | "admin";
