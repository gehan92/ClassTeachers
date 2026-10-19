"use client";

import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgeCheck,
  BookOpenCheck,
  ChevronRight,
  ClipboardList,
  Eye,
  Flag,
  GraduationCap,
  Megaphone,
  MousePointerClick,
  Receipt,
  ShieldAlert,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { TabLink } from "@/components/dashboard/tab-link";
import { cn } from "@/lib/utils";
import {
  CHART_COLORS,
  ChartCard,
  KpiGrid,
  KpiTile,
  Legend,
  ReportHeader,
  SectionHeading,
  axisTick,
  cardClass,
  compare,
  tooltipStyle,
  useFormatters,
  useReportRange,
  useSeries,
} from "./reports/report-kit";
import type { AdminReports, DailyCount, TrafficReport } from "@/types/dashboard-admin";

export type OverviewAttention = {
  pendingApprovals: number;
  openReports: number;
  flaggedReviews: number;
  failedPayments: number;
  verificationWaiting: number;
  expiringAds: number;
  nextExpiringAd: { sponsor: string; expiresDisplay: string } | null;
};

const ROLE_KEYS = ["student", "teacher", "campus_lecturer", "institute"] as const;

export function OverviewTab({
  adminName,
  reports,
  traffic,
  attention,
  mrr,
}: {
  adminName: string;
  reports: AdminReports;
  /** Last 12 months of visits, or null before tracking is set up. */
  traffic: TrafficReport | null;
  attention: OverviewAttention;
  mrr: number;
}) {
  const t = useTranslations("adminDashboard.overview");
  const tr = useTranslations("adminDashboard.reports");
  const [range, setRange] = useReportRange();
  const series = useSeries();
  const fmt = useFormatters();
  const today = reports.todayKey;

  const signups = compare(reports.daily.signups, today, range);
  const earnings = compare(reports.daily.earnings, today, range);
  const requests = compare(reports.daily.requests, today, range);
  const joined = compare(reports.daily.requests, today, range, ["joined", "accepted"]);
  const examsTaken = compare(reports.daily.examsTaken, today, range);
  const visitRows: DailyCount[] = (traffic?.daily ?? []).map((d) => ({ d: d.d, k: "visits", n: d.visits }));
  const visitorRows: DailyCount[] = (traffic?.daily ?? []).map((d) => ({ d: d.d, k: "visitors", n: d.visitors }));
  const visits = compare(visitRows, today, range);

  const roleLabel: Record<(typeof ROLE_KEYS)[number], string> = {
    student: tr("roles.student"),
    teacher: tr("roles.teacher"),
    campus_lecturer: tr("roles.campus_lecturer"),
    institute: tr("roles.institute"),
  };

  const signupSeries = series(reports.daily.signups, today, range, [...ROLE_KEYS]);
  const earningSeries = series(reports.daily.earnings, today, range, ["total"], () => "total");
  const trafficSeries = series([...visitRows, ...visitorRows], today, range, ["visits", "visitors"]);

  const attentionItems = [
    {
      key: "approvals",
      tab: "approvals",
      icon: UserCheck,
      count: attention.pendingApprovals,
      title: t("attention.approvals.title", { count: attention.pendingApprovals }),
      body: attention.pendingApprovals > 0 ? t("attention.approvals.body") : t("attention.approvals.empty"),
      tone: "cta" as const,
    },
    {
      key: "reports",
      tab: "reports",
      icon: ShieldAlert,
      count: attention.openReports,
      title: t("attention.reports.title", { count: attention.openReports }),
      body: attention.openReports > 0 ? t("attention.reports.body") : t("attention.reports.empty"),
      tone: "destructive" as const,
    },
    {
      key: "verification",
      tab: "users",
      icon: BadgeCheck,
      count: attention.verificationWaiting,
      title: t("attention.verification.title", { count: attention.verificationWaiting }),
      body: attention.verificationWaiting > 0 ? t("attention.verification.body") : t("attention.verification.empty"),
      tone: "primary" as const,
    },
    {
      key: "flagged",
      tab: "flagged",
      icon: Flag,
      count: attention.flaggedReviews,
      title: t("attention.flagged.title", { count: attention.flaggedReviews }),
      body: attention.flaggedReviews > 0 ? t("attention.flagged.body") : t("attention.flagged.empty"),
      tone: "destructive" as const,
    },
    {
      key: "payments",
      tab: "payments",
      icon: Receipt,
      count: attention.failedPayments,
      title: t("attention.payments.title", { count: attention.failedPayments }),
      body: attention.failedPayments > 0 ? t("attention.payments.body") : t("attention.payments.empty"),
      tone: "destructive" as const,
    },
    {
      key: "ads",
      tab: "siteAds",
      icon: Megaphone,
      count: attention.expiringAds,
      title: t("attention.ads.title", { count: attention.expiringAds }),
      body: attention.nextExpiringAd
        ? t("attention.ads.body", { sponsor: attention.nextExpiringAd.sponsor, expires: attention.nextExpiringAd.expiresDisplay })
        : t("attention.ads.empty"),
      tone: "cta" as const,
    },
  ];
  // Items that need action float to the top; the calm "all clear" ones follow.
  const sortedAttention = [...attentionItems].sort((a, b) => Number(b.count > 0) - Number(a.count > 0));
  const needsActionCount = attentionItems.filter((item) => item.count > 0).length;

  const glance = [
    { label: t("glance.classes"), value: reports.totals.batches, icon: GraduationCap },
    { label: t("glance.studentsInClasses"), value: reports.totals.studentsInClasses, icon: Users },
    { label: t("glance.exams"), value: reports.totals.exams, icon: ClipboardList },
    { label: t("glance.questions"), value: reports.totals.questions, icon: BookOpenCheck },
    { label: t("glance.activeAds"), value: reports.totals.activeAds, icon: Megaphone },
    { label: t("glance.adViews"), value: reports.totals.adViewsTotal, icon: Eye },
  ];

  return (
    <div>
      <div className="mb-6">
        <DashboardHero
          title={t("greeting", { name: adminName.split(" ")[0] })}
          subtitle={needsActionCount > 0 ? t("subtitleAttention", { count: needsActionCount }) : t("subtitleClear")}
          actions={[
            { label: t("hero.reviewApprovals"), href: { pathname: "/admin", query: { tab: "approvals" } } },
            { label: t("hero.viewReports"), href: { pathname: "/admin", query: { tab: "growth" } }, variant: "cta" },
          ]}
          stats={[
            { label: t("stats.users"), value: fmt.number(reports.totals.users), href: { pathname: "/admin", query: { tab: "users" } } },
            { label: t("stats.activeWeek"), value: fmt.number(reports.active7), href: { pathname: "/admin", query: { tab: "growth" } } },
            { label: t("stats.studentsInClasses"), value: fmt.number(reports.totals.studentsInClasses), href: { pathname: "/admin", query: { tab: "activity" } } },
            { label: t("stats.mrr"), value: fmt.money(mrr), href: { pathname: "/admin", query: { tab: "earnings" } } },
          ]}
        />
      </div>

      <ReportHeader title={t("periodTitle")} subtitle={t("periodSubtitle")} range={range} onRangeChange={setRange} />

      <KpiGrid>
        <KpiTile label={t("kpi.signups")} value={fmt.number(signups.current)} current={signups.current} previous={signups.previous} icon={UserPlus} />
        <KpiTile label={t("kpi.earnings")} value={fmt.money(earnings.current)} current={earnings.current} previous={earnings.previous} icon={Wallet} tone="success" />
        <KpiTile label={t("kpi.requests")} value={fmt.number(requests.current)} current={requests.current} previous={requests.previous} icon={MousePointerClick} tone="cta" />
        <KpiTile label={t("kpi.joined")} value={fmt.number(joined.current)} current={joined.current} previous={joined.previous} icon={GraduationCap} tone="success" />
        <KpiTile label={t("kpi.examsTaken")} value={fmt.number(examsTaken.current)} current={examsTaken.current} previous={examsTaken.previous} icon={ClipboardList} />
        <KpiTile
          label={t("kpi.visits")}
          value={traffic ? fmt.number(visits.current) : "—"}
          current={traffic ? visits.current : undefined}
          previous={traffic ? visits.previous : undefined}
          hint={traffic ? undefined : t("kpi.visitsNotTracked")}
          icon={Eye}
          tone="muted"
        />
      </KpiGrid>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title={t("charts.signups")} subtitle={t("charts.signupsHint")} icon={UserPlus} empty={signups.current === 0}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={signupSeries} margin={{ top: 8, left: -24, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
              {ROLE_KEYS.map((role, i) => (
                <Bar key={role} dataKey={role} name={roleLabel[role]} stackId="roles" fill={CHART_COLORS[i]} radius={i === ROLE_KEYS.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={28} />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <Legend items={ROLE_KEYS.map((role, i) => ({ label: roleLabel[role], color: CHART_COLORS[i] }))} />
        </ChartCard>

        <ChartCard
          title={t("charts.earnings")}
          subtitle={t("charts.earningsHint")}
          icon={TrendingUp}
          empty={earnings.current === 0}
          emptyLabel={t("charts.earningsEmpty")}
        >
          <ResponsiveContainer width="100%" height={262}>
            <AreaChart data={earningSeries} margin={{ top: 8, left: -12, right: 4 }}>
              <defs>
                <linearGradient id="overview-earnings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => fmt.number(Number(v))} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmt.money(Number(v)), tr("earned")]} />
              <Area type="monotone" dataKey="total" stroke="var(--color-success)" strokeWidth={2} fill="url(#overview-earnings)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard
        className="mt-4"
        title={t("charts.traffic")}
        subtitle={t("charts.trafficHint")}
        icon={Eye}
        empty={!traffic || visits.current === 0}
        emptyLabel={traffic ? t("charts.trafficEmpty") : t("charts.trafficNotTracked")}
        action={
          <TabLink tab="traffic" className="text-xs font-medium text-primary hover:underline">
            {t("charts.trafficOpen")}
          </TabLink>
        }
      >
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trafficSeries} margin={{ top: 8, left: -24, right: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="visits" name={tr("visits")} stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="visitors" name={tr("visitors")} stroke="var(--color-chart-2)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <Legend
          items={[
            { label: tr("visits"), color: "var(--color-chart-1)" },
            { label: tr("visitorsDaily"), color: "var(--color-chart-2)" },
          ]}
        />
      </ChartCard>

      <SectionHeading hint={t("attentionHint")}>{t("attentionHeading")}</SectionHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sortedAttention.map((item) => {
          const Icon = item.icon;
          const active = item.count > 0;
          return (
            <TabLink
              key={item.key}
              tab={item.tab}
              className={cn(
                cardClass,
                "group flex items-start gap-3 p-4 transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                !active && "shadow-none",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full",
                  !active
                    ? "bg-muted text-muted-foreground"
                    : item.tone === "destructive"
                      ? "bg-destructive/10 text-destructive"
                      : item.tone === "cta"
                        ? "bg-cta/15 text-accent-deep"
                        : "bg-primary/10 text-primary",
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-semibold", active ? "text-foreground" : "text-muted-foreground")}>
                  {item.title}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{item.body}</span>
              </span>
              <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </TabLink>
          );
        })}
      </div>

      <SectionHeading>{t("glanceHeading")}</SectionHeading>
      <div className={cn(cardClass, "grid grid-cols-2 divide-border sm:grid-cols-3 lg:grid-cols-6 lg:divide-x")}>
        {glance.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex flex-col gap-1 p-4">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="size-3.5" />
                {item.label}
              </span>
              <span className="font-display text-xl text-primary tabular-nums">{fmt.number(item.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
