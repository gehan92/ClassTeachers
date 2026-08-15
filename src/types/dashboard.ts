export type DashboardTabDef = {
  key: string;
  label: string;
  count?: number;
};

export type DashboardNavGroup = {
  label: string;
  items: DashboardTabDef[];
};
