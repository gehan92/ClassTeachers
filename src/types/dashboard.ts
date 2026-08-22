import type { LucideIcon } from "lucide-react";

export type DashboardTabDef = {
  key: string;
  label: string;
  count?: number;
  icon?: LucideIcon;
};

export type DashboardNavGroup = {
  /** Omit to render this group's items with no section header — used for a standalone "Overview" entry at the top of the sidebar. */
  label?: string;
  items: DashboardTabDef[];
};

// Teacher and Campus Lecturer share the same dashboard — "same tools,
// campus level" per the product spec — so both route to /teacher.
export type DemoRole = "student" | "teacher" | "class" | "lecturer" | "admin";
