"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, CircleCheckBig, Gift, Landmark, PieChart as PieIcon, Receipt, Repeat, Trophy, Wallet } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CHART_COLORS,
  ChartCard,
  ExportButton,
  KpiGrid,
  KpiTile,
  Legend,
  ReportHeader,
  SectionHeading,
  axisTick,
  compare,
  downloadCsv,
  rangeBounds,
  tooltipStyle,
  totalsByKey,
  useFormatters,
  useReportRange,
  useSeries,
} from "./reports/report-kit";
import type { AdminPayment, AdminReports } from "@/types/dashboard-admin";

const PURPOSES = ["teacher_connection", "institute_unlock", "class_join"] as const;
const STATUS_COLORS: Record<string, string> = {
  completed: "var(--color-success)",
  pending: "var(--color-chart-2)",
  failed: "var(--color-destructive)",
  cancelled: "var(--color-chart-4)",
};

/** Admin -> Earnings: what ClassPortals earned, from which fee, and from whose students. */
export function EarningsTab({
  reports,
  payments,
  mrr,
  subscriberCount,
}: {
  reports: AdminReports;
  payments: AdminPayment[];
  mrr: number;
  subscriberCount: number;
}) {
  const t = useTranslations("adminDashboard.earnings");
  const tr = useTranslations("adminDashboard.reports");
  const [range, setRange] = useReportRange();
  const series = useSeries();
  const fmt = useFormatters();
  const today = reports.todayKey;

  const purposeLabel = (p: string) => tr(`purposes.${p}`);
  const earned = compare(reports.daily.earnings, today, range);
  const completed = compare(reports.daily.payments, today, range, ["completed"]);
  const allPayments = compare(reports.daily.payments, today, range);
  const failed = compare(reports.daily.payments, today, range, ["failed"]);
  const waived = compare(reports.daily.feeJoins, today, range, ["waived"]);
  const schoolFees = compare(reports.daily.feeCollections, today, range);
  const successRate = allPayments.current > 0 ? (completed.current / allPayments.current) * 100 : null;
  const average = completed.current > 0 ? earned.current / completed.current : 0;

  const earningSeries = series(reports.daily.earnings, today, range, [...PURPOSES]);
  const statusTotals = totalsByKey(reports.daily.payments, today, range);
  const statusDonut = statusTotals.map((s) => ({ name: tr(`paymentStatus.${s.k}`), value: s.n, fill: STATUS_COLORS[s.k] ?? "var(--color-chart-5)" }));

  const earners = useMemo(
    () =>
      totalsByKey(reports.daily.earnersByOwner, today, range)
        .slice(0, 20)
        .map((row) => ({ ...row, ...(reports.ownerNames[row.k] ?? { name: "—", kind: "teacher" as const }) })),
    [reports, today, range],
  );
  const earnerTotal = earners.reduce((sum, e) => sum + e.n, 0);

  function exportPayments() {
    const { start, end } = rangeBounds(today, range);
    downloadCsv(
      "classportals-payments",
      [t("csv.date"), t("csv.order"), t("csv.student"), t("csv.fee"), t("csv.paidTo"), t("csv.amount"), t("csv.currency"), t("csv.status"), t("csv.paidAt")],
      payments
        .filter((p) => {
          const d = p.createdAtIso.slice(0, 10);
          return d >= start && d <= end;
        })
        .map((p) => [p.createdAt, p.orderId, p.studentName, purposeLabel(p.purpose), p.targetLabel, p.amount, p.currency, p.status, p.paidAt ?? ""]),
    );
  }

  function exportEarners() {
    downloadCsv(
      "classportals-top-earners",
      [t("csv.rank"), t("csv.name"), t("csv.kind"), t("csv.amount")],
      earners.map((e, i) => [i + 1, e.name, e.kind, e.n]),
    );
  }

  return (
    <div>
      <ReportHeader title={t("title")} subtitle={t("subtitle")} range={range} onRangeChange={setRange}>
        <ExportButton onClick={exportPayments} disabled={payments.length === 0} />
      </ReportHeader>

      <KpiGrid>
        <KpiTile label={t("kpi.earned")} value={fmt.money(earned.current)} current={earned.current} previous={earned.previous} icon={Wallet} tone="success" />
        <KpiTile label={t("kpi.payments")} value={fmt.number(completed.current)} current={completed.current} previous={completed.previous} icon={Receipt} />
        <KpiTile
          label={t("kpi.successRate")}
          value={fmt.percent(successRate)}
          hint={failed.current > 0 ? t("kpi.failedHint", { count: failed.current }) : t("kpi.noFailures")}
          icon={CircleCheckBig}
          tone={failed.current > 0 ? "destructive" : "success"}
        />
        <KpiTile label={t("kpi.average")} value={completed.current ? fmt.money(average) : "—"} icon={Landmark} tone="cta" />
        <KpiTile label={t("kpi.waived")} value={fmt.number(waived.current)} current={waived.current} previous={waived.previous} hint={t("kpi.waivedHint")} icon={Gift} tone="muted" />
        <KpiTile label={t("kpi.mrr")} value={fmt.money(mrr)} hint={t("kpi.mrrHint", { count: subscriberCount })} icon={Repeat} />
      </KpiGrid>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title={t("charts.bySource")}
          subtitle={t("charts.bySourceHint")}
          icon={Wallet}
          empty={earned.current === 0}
          emptyLabel={t("charts.empty")}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={earningSeries} margin={{ top: 8, left: -8, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => fmt.number(Number(v))} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} formatter={(v, name) => [fmt.money(Number(v)), name]} />
              {PURPOSES.map((p, i) => (
                <Bar key={p} dataKey={p} name={purposeLabel(p)} stackId="p" fill={CHART_COLORS[i + 1]} maxBarSize={28} radius={i === PURPOSES.length - 1 ? [4, 4, 0, 0] : 0} />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <Legend items={PURPOSES.map((p, i) => ({ label: purposeLabel(p), color: CHART_COLORS[i + 1] }))} />
        </ChartCard>

        <ChartCard title={t("charts.status")} subtitle={t("charts.statusHint")} icon={PieIcon} empty={allPayments.current === 0} emptyLabel={t("charts.empty")}>
          <div className="relative">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusDonut} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} strokeWidth={0}>
                  {statusDonut.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl text-primary">{fmt.percent(successRate)}</span>
              <span className="text-[11px] text-muted-foreground">{t("charts.succeeded")}</span>
            </div>
          </div>
          <Legend items={statusDonut.map((d) => ({ label: `${d.name} · ${d.value}`, color: d.fill }))} />
        </ChartCard>
      </div>

      <SectionHeading hint={t("earnersHint")}>{t("earnersHeading")}</SectionHeading>
      <ChartCard
        title={t("charts.topEarners")}
        icon={Trophy}
        empty={earners.length === 0}
        emptyLabel={t("charts.empty")}
        action={<ExportButton onClick={exportEarners} disabled={earners.length === 0} />}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>{t("table.name")}</TableHead>
                <TableHead>{t("table.kind")}</TableHead>
                <TableHead className="text-right">{t("table.earned")}</TableHead>
                <TableHead className="hidden w-48 sm:table-cell">{t("table.share")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {earners.map((e, i) => (
                <TableRow key={e.k}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium text-foreground">{e.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {e.kind === "institute" && <Building2 className="size-3.5" />}
                      {tr(`ownerKinds.${e.kind}`)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{fmt.money(e.n)}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-success" style={{ width: `${earnerTotal ? (e.n / earnerTotal) * 100 : 0}%` }} />
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ChartCard>

      <SectionHeading hint={t("schoolHint")}>{t("schoolHeading")}</SectionHeading>
      <KpiGrid className="xl:grid-cols-3">
        <KpiTile
          label={t("kpi.schoolFees")}
          value={fmt.money(schoolFees.current)}
          current={schoolFees.current}
          previous={schoolFees.previous}
          hint={t("kpi.schoolFeesHint")}
          icon={Building2}
          tone="muted"
        />
      </KpiGrid>
    </div>
  );
}
