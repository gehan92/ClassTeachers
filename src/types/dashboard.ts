export type DashboardTabDef = {
  key: string;
  label: string;
  count?: number;
};

export type DashboardNavGroup = {
  label: string;
  items: DashboardTabDef[];
};

// Teacher and Campus Lecturer share the same dashboard — "same tools,
// campus level" per the product spec — so both route to /teacher.
export type DemoRole = "student" | "teacher" | "class" | "lecturer" | "admin";
