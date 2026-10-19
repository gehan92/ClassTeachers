"use client";

import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, CircleCheckBig, MapPin, PieChart as PieIcon, UserPlus, Users } from "lucide-react";
import {
  CHART_COLORS,
  ChartCard,
  ExportButton,
  KpiGrid,
  KpiTile,
  Legend,
  ProgressRow,
  RankedBars,
  ReportHeader,
  SectionHeading,
  axisTick,
  compare,
  downloadCsv,
  tooltipStyle,
  useFormatters,
  useReportRange,
  useSeries,
} from "./reports/report-kit";
import type { AdminReports, PlatformUser, PlatformUserRole } from "@/types/dashboard-admin";

const ROLE_KEYS: PlatformUserRole[] = ["student", "teacher", "campus_lecturer", "institute"];

/** Admin -> Growth: who is on the platform, who's new, and who actually comes back. */
export function GrowthTab({ reports, users }: { reports: AdminReports; users: PlatformUser[] }) {
  const t = useTranslations("adminDashboard.growth");
  const tr = useTranslations("adminDashboard.reports");
  const [range, setRange] = useReportRange();
  const series = useSeries();
  const fmt = useFormatters();
  const today = reports.todayKey;

  const roleLabel = (role: PlatformUserRole) => tr(`roles.${role}`);
  const signups = compare(reports.daily.signups, today, range);
  const onboardedTotal = reports.activity.reduce((sum, a) => sum + a.onboarded, 0);
  const signupSeries = series(reports.daily.signups, today, range, ROLE_KEYS);

  const donut = reports.activity
    .map((a, i) => ({ name: roleLabel(a.role), value: a.total, fill: CHART_COLORS[i] }))
    .filter((d) => d.value > 0);

  const activeData = reports.activity.map((a) => ({
    role: roleLabel(a.role),
    active: a.active30,
    inactive: Math.max(a.total - a.active30, 0),
  }));

  function exportUsers() {
    downloadCsv(
      "classportals-users",
      [t("csv.name"), t("csv.role"), t("csv.status"), t("csv.joined"), t("csv.lastActive"), t("csv.verified")],
      users.map((u) => [
        u.name,
        roleLabel(u.role),
        u.status,
        u.joinedAt,
        u.lastActive ?? "",
        u.institutionVerified === undefined ? "" : u.institutionVerified ? "yes" : "no",
      ]),
    );
  }

  return (
    <div>
      <ReportHeader title={t("title")} subtitle={t("subtitle")} range={range} onRangeChange={setRange}>
        <ExportButton onClick={exportUsers} disabled={users.length === 0} />
      </ReportHeader>

      <KpiGrid className="xl:grid-cols-5">
        <KpiTile label={t("kpi.total")} value={fmt.number(reports.totals.users)} icon={Users} />
        <KpiTile label={t("kpi.new")} value={fmt.number(signups.current)} current={signups.current} previous={signups.previous} icon={UserPlus} tone="success" />
        <KpiTile label={t("kpi.activeToday")} value={fmt.number(reports.activeToday)} icon={Activity} tone="cta" hint={t("kpi.signInHint")} />
        <KpiTile
          label={t("kpi.active30")}
          value={fmt.number(reports.active30)}
          hint={fmt.percent(reports.totals.users ? (reports.active30 / reports.totals.users) * 100 : null) + " " + t("kpi.ofAll")}
          icon={Activity}
        />
        <KpiTile
          label={t("kpi.onboarded")}
          value={fmt.percent(reports.totals.users ? (onboardedTotal / reports.totals.users) * 100 : null)}
          hint={t("kpi.onboardedHint", { count: onboardedTotal })}
          icon={CircleCheckBig}
          tone="success"
        />
      </KpiGrid>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title={t("charts.byRole")} icon={PieIcon} empty={donut.length === 0}>
          <div className="relative">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} strokeWidth={0}>
                  {donut.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl text-primary tabular-nums">{fmt.number(reports.totals.users)}</span>
              <span className="text-[11px] text-muted-foreground">{t("charts.accounts")}</span>
            </div>
          </div>
          <Legend items={donut.map((d) => ({ label: `${d.name} · ${d.value}`, color: d.fill }))} />
        </ChartCard>

        <ChartCard className="xl:col-span-2" title={t("charts.signups")} subtitle={t("charts.signupsHint")} icon={UserPlus} empty={signups.current === 0}>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={signupSeries} margin={{ top: 8, left: -24, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
              {ROLE_KEYS.map((role, i) => (
                <Bar key={role} dataKey={role} name={roleLabel(role)} stackId="r" fill={CHART_COLORS[i]} maxBarSize={28} radius={i === ROLE_KEYS.length - 1 ? [4, 4, 0, 0] : 0} />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <Legend items={ROLE_KEYS.map((role, i) => ({ label: roleLabel(role), color: CHART_COLORS[i] }))} />
        </ChartCard>
      </div>

      <SectionHeading hint={t("engagementHint")}>{t("engagementHeading")}</SectionHeading>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard className="xl:col-span-2" title={t("charts.activeVsInactive")} subtitle={t("charts.activeVsInactiveHint")} icon={Activity} empty={reports.totals.users === 0}>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={activeData} layout="vertical" margin={{ top: 4, left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
              <XAxis type="number" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="role" tick={axisTick} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
              <Bar dataKey="active" name={t("charts.active")} stackId="a" fill="var(--color-success)" maxBarSize={22} />
              <Bar dataKey="inactive" name={t("charts.inactive")} stackId="a" fill="var(--color-border)" radius={[0, 4, 4, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
          <Legend
            items={[
              { label: t("charts.active"), color: "var(--color-success)" },
              { label: t("charts.inactive"), color: "var(--color-border)" },
            ]}
          />
        </ChartCard>

        <ChartCard title={t("charts.onboarding")} subtitle={t("charts.onboardingHint")} icon={CircleCheckBig}>
          <div className="flex flex-col gap-4">
            {reports.activity.map((a) => (
              <ProgressRow key={a.role} label={roleLabel(a.role)} value={a.onboarded} total={a.total} />
            ))}
          </div>
        </ChartCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title={t("charts.locations")} subtitle={t("charts.locationsHint")} icon={MapPin}>
          <RankedBars rows={reports.locations.map((l) => ({ label: l.k, n: l.n }))} emptyLabel={t("charts.locationsEmpty")} />
        </ChartCard>
        <ChartCard title={t("charts.weekActivity")} subtitle={t("charts.weekActivityHint")} icon={Activity}>
          <div className="flex flex-col gap-4">
            {reports.activity.map((a) => (
              <ProgressRow key={a.role} label={roleLabel(a.role)} value={a.active7} total={a.total} color="var(--color-chart-2)" />
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
