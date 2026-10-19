"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Filter,
  GraduationCap,
  Inbox,
  Library,
  ShieldAlert,
  Star,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CHART_COLORS,
  ChartCard,
  KpiGrid,
  KpiTile,
  Legend,
  RankedBars,
  ReportHeader,
  SectionHeading,
  axisTick,
  cardClass,
  compare,
  rangeBounds,
  tooltipStyle,
  useFormatters,
  useReportRange,
  useSeries,
} from "./reports/report-kit";
import type { AdminReports, DailyCount, ReportRange } from "@/types/dashboard-admin";

const MODERATION_KEYS = ["contentRemoved", "reviewRemoved", "suspended", "rejected"] as const;

function averageScore(rows: DailyCount[], todayKey: string, range: ReportRange): number | null {
  const { start, end } = rangeBounds(todayKey, range);
  const inRange = rows.filter((r) => r.d >= start && r.d <= end);
  return inRange.length ? inRange.reduce((sum, r) => sum + r.n, 0) / inRange.length : null;
}

/** Admin -> Activity: is the marketplace converting, and is real teaching happening? */
export function ActivityTab({ reports }: { reports: AdminReports }) {
  const t = useTranslations("adminDashboard.activity");
  const tr = useTranslations("adminDashboard.reports");
  const [range, setRange] = useReportRange();
  const series = useSeries();
  const fmt = useFormatters();
  const today = reports.todayKey;
  const d = reports.daily;

  // ----- join funnel
  const inquiries = compare(d.inquiries, today, range).current;
  const requests = compare(d.requests, today, range).current;
  const accepted = compare(d.requests, today, range, ["qna_open", "joined", "accepted"]).current;
  const inClass = compare(d.requests, today, range, ["joined", "accepted"]).current;
  const paid = compare(d.feeJoins, today, range, ["paid"]).current;
  const funnel = [
    { key: "inquiries", label: t("funnel.inquiries"), hint: t("funnel.inquiriesHint"), n: inquiries },
    { key: "requests", label: t("funnel.requests"), hint: t("funnel.requestsHint"), n: requests },
    { key: "accepted", label: t("funnel.accepted"), hint: t("funnel.acceptedHint"), n: accepted },
    { key: "inClass", label: t("funnel.inClass"), hint: t("funnel.inClassHint"), n: inClass },
    { key: "paid", label: t("funnel.paid"), hint: t("funnel.paidHint"), n: paid },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.n));

  // ----- learning
  const examsCreated = compare(d.examsCreated, today, range);
  const examsTaken = compare(d.examsTaken, today, range);
  const avgScore = averageScore(d.examScores, today, range);
  const prevAvg = (() => {
    const { prevStart, prevEnd } = rangeBounds(today, range);
    const rows = d.examScores.filter((r) => r.d >= prevStart && r.d <= prevEnd);
    return rows.length ? rows.reduce((s, r) => s + r.n, 0) / rows.length : null;
  })();
  const attendanceAll = compare(d.attendance, today, range).current;
  const attendancePresent = compare(d.attendance, today, range, ["present", "late"]).current;
  const attendanceRate = attendanceAll ? (attendancePresent / attendanceAll) * 100 : null;
  const liveClasses = compare(d.liveClasses, today, range);
  const content = compare(d.content, today, range);
  const wantedPosted = compare(d.wantedAds, today, range, ["posted"]);
  const wantedAnswered = compare(d.wantedAds, today, range, ["answered"]);

  const classSeries = series(d.batches, today, range, ["teacher", "class"]);
  const liveSeries = series(d.liveClasses, today, range, ["online", "physical"], (k) => (k === "physical" ? "physical" : "online"));
  const scoreSeries = (() => {
    const sums = series(d.examScores, today, range, ["sum"], () => "sum");
    const counts = series(d.examScores.map((r) => ({ ...r, n: 1 })), today, range, ["count"], () => "count");
    return sums.map((b, i) => ({
      label: b.label,
      avg: (counts[i].count as number) > 0 ? Math.round((b.sum as number) / (counts[i].count as number)) : null,
    }));
  })();
  const hasScores = scoreSeries.some((p) => p.avg !== null);

  // ----- trust
  const ratingRows = [5, 4, 3, 2, 1].map((star) => ({
    star: `${star}★`,
    n: compare(d.reviews, today, range, [String(star)]).current,
  }));
  const ratingTotal = ratingRows.reduce((s, r) => s + r.n, 0);
  const ratingAvg = ratingTotal ? ratingRows.reduce((s, r) => s + Number(r.star[0]) * r.n, 0) / ratingTotal : null;
  const moderationSeries = series(d.moderation, today, range, [...MODERATION_KEYS]);
  const moderationTotal = compare(d.moderation, today, range, [...MODERATION_KEYS]).current;

  return (
    <div>
      <ReportHeader title={t("title")} subtitle={t("subtitle")} range={range} onRangeChange={setRange} />

      <ChartCard title={t("funnel.title")} subtitle={t("funnel.subtitle")} icon={Filter} empty={funnel.every((f) => f.n === 0)}>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          {funnel.map((step, i) => {
            const prev = i > 0 ? funnel[i - 1].n : null;
            const conversion = prev ? Math.round((step.n / prev) * 100) : null;
            return (
              <li key={step.key} className="flex flex-col gap-2">
                <div className="flex min-h-5 items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{step.label}</span>
                  {conversion !== null && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
                      {t("funnel.conversion", { value: conversion })}
                    </span>
                  )}
                </div>
                <span className="font-display text-2xl text-primary tabular-nums">{fmt.number(step.n)}</span>
                <span className="flex h-16 items-end overflow-hidden rounded-md bg-muted/60">
                  <span
                    className="block w-full rounded-md"
                    style={{ height: `${Math.max(4, (step.n / funnelMax) * 100)}%`, background: CHART_COLORS[Math.min(i, CHART_COLORS.length - 1)] }}
                  />
                </span>
                <span className="text-[11px] leading-snug text-muted-foreground">{step.hint}</span>
              </li>
            );
          })}
        </ol>
      </ChartCard>

      <SectionHeading hint={t("learningHint")}>{t("learningHeading")}</SectionHeading>
      <KpiGrid>
        <KpiTile label={t("kpi.examsCreated")} value={fmt.number(examsCreated.current)} current={examsCreated.current} previous={examsCreated.previous} icon={ClipboardList} />
        <KpiTile label={t("kpi.examsTaken")} value={fmt.number(examsTaken.current)} current={examsTaken.current} previous={examsTaken.previous} icon={GraduationCap} tone="success" />
        <KpiTile
          label={t("kpi.avgScore")}
          value={fmt.percent(avgScore)}
          current={avgScore ?? undefined}
          previous={avgScore !== null && prevAvg !== null ? prevAvg : undefined}
          icon={Star}
          tone="cta"
        />
        <KpiTile label={t("kpi.attendance")} value={fmt.percent(attendanceRate)} hint={t("kpi.attendanceHint", { count: attendanceAll })} icon={CalendarCheck} tone="success" />
        <KpiTile label={t("kpi.liveClasses")} value={fmt.number(liveClasses.current)} current={liveClasses.current} previous={liveClasses.previous} icon={Video} />
        <KpiTile label={t("kpi.content")} value={fmt.number(content.current)} current={content.current} previous={content.previous} hint={t("kpi.contentHint")} icon={BookOpen} tone="muted" />
      </KpiGrid>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title={t("charts.scores")} subtitle={t("charts.scoresHint")} icon={Star} empty={!hasScores}>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={scoreSeries} margin={{ top: 8, left: -24, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} unit="%" />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, t("kpi.avgScore")]} />
              <Line type="monotone" dataKey="avg" stroke="var(--color-chart-2)" strokeWidth={2} connectNulls dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("charts.liveClasses")} subtitle={t("charts.liveClassesHint")} icon={Video} empty={liveClasses.current === 0}>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={liveSeries} margin={{ top: 8, left: -24, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
              <Bar dataKey="online" name={t("charts.online")} stackId="m" fill="var(--color-chart-1)" maxBarSize={28} />
              <Bar dataKey="physical" name={t("charts.inPerson")} stackId="m" fill="var(--color-chart-3)" maxBarSize={28} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <Legend
            items={[
              { label: t("charts.online"), color: "var(--color-chart-1)" },
              { label: t("charts.inPerson"), color: "var(--color-chart-3)" },
            ]}
          />
        </ChartCard>
      </div>

      <SectionHeading hint={t("marketHint")}>{t("marketHeading")}</SectionHeading>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard className="xl:col-span-2" title={t("charts.classes")} subtitle={t("charts.classesHint")} icon={GraduationCap} empty={compare(d.batches, today, range).current === 0}>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={classSeries} margin={{ top: 8, left: -24, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
              <Bar dataKey="teacher" name={tr("ownerKinds.teacher")} stackId="o" fill="var(--color-chart-1)" maxBarSize={28} />
              <Bar dataKey="class" name={tr("ownerKinds.institute")} stackId="o" fill="var(--color-chart-2)" maxBarSize={28} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <Legend
            items={[
              { label: tr("ownerKinds.teacher"), color: "var(--color-chart-1)" },
              { label: tr("ownerKinds.institute"), color: "var(--color-chart-2)" },
            ]}
          />
        </ChartCard>

        <div className={cn(cardClass, "flex flex-col gap-4 p-5")}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Inbox className="size-4 text-primary" />
            {t("requests.title")}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="block text-xs text-muted-foreground">{t("requests.posted")}</span>
              <span className="font-display text-2xl text-primary tabular-nums">{fmt.number(wantedPosted.current)}</span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">{t("requests.answered")}</span>
              <span className="font-display text-2xl text-primary tabular-nums">{fmt.number(wantedAnswered.current)}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("requests.open", { count: reports.totals.openWantedAds })}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title={t("charts.subjects")} subtitle={t("charts.subjectsHint")} icon={BookOpen}>
          <RankedBars rows={reports.subjects.map((s) => ({ label: s.k, n: s.n }))} emptyLabel={t("charts.subjectsEmpty")} />
        </ChartCard>
        <ChartCard title={t("charts.questionBank")} subtitle={t("charts.questionBankHint", { count: reports.totals.questions })} icon={Library}>
          <RankedBars rows={reports.questionsBySubject.map((s) => ({ label: s.k, n: s.n }))} color="var(--color-chart-3)" />
        </ChartCard>
      </div>

      <SectionHeading hint={t("trustHint")}>{t("trustHeading")}</SectionHeading>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          title={t("charts.ratings")}
          subtitle={ratingAvg !== null ? t("charts.ratingsAvg", { value: ratingAvg.toFixed(1), count: ratingTotal }) : undefined}
          icon={Star}
          empty={ratingTotal === 0}
        >
          <RankedBars rows={ratingRows.map((r) => ({ label: r.star, n: r.n }))} color="var(--color-chart-2)" />
        </ChartCard>
        <ChartCard className="xl:col-span-2" title={t("charts.moderation")} subtitle={t("charts.moderationHint")} icon={ShieldAlert} empty={moderationTotal === 0} emptyLabel={t("charts.moderationEmpty")}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={moderationSeries} margin={{ top: 8, left: -24, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
              {MODERATION_KEYS.map((k, i) => (
                <Bar key={k} dataKey={k} name={t(`moderation.${k}`)} stackId="m" fill={[CHART_COLORS[5], CHART_COLORS[1], CHART_COLORS[0], CHART_COLORS[4]][i]} maxBarSize={28} />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <Legend items={MODERATION_KEYS.map((k, i) => ({ label: t(`moderation.${k}`), color: [CHART_COLORS[5], CHART_COLORS[1], CHART_COLORS[0], CHART_COLORS[4]][i] }))} />
        </ChartCard>
      </div>
    </div>
  );
}
