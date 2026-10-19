"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Area, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Compass,
  Eye,
  FileSearch,
  Globe,
  Languages,
  Loader2,
  Megaphone,
  MonitorSmartphone,
  MousePointerClick,
  Radar,
  SearchX,
  UserRound,
  Users,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadTrafficReport } from "@/lib/dashboard/admin-insights-actions";
import { cn } from "@/lib/utils";
import {
  CHART_COLORS,
  ChartCard,
  ExportButton,
  KpiGrid,
  KpiTile,
  Legend,
  RANGE_DAYS,
  RankedBars,
  ReportHeader,
  SectionHeading,
  axisTick,
  cardClass,
  downloadCsv,
  tooltipStyle,
  useFormatters,
  useReportRange,
  useSeries,
} from "./reports/report-kit";
import type { DailyCount, ReportRange, TrafficReport } from "@/types/dashboard-admin";

/** Friendly names for the pages people open most; anything else shows its path. */
function usePageLabel() {
  const t = useTranslations("adminDashboard.traffic.pages");
  return (path: string): string => {
    const [base, query] = path.split("?");
    const tab = query?.startsWith("tab=") ? query.slice(4) : null;
    const known: Record<string, string> = {
      "/": t("home"),
      "/teachers": t("search"),
      "/institutes": t("institutes"),
      "/lecturers": t("lecturers"),
      "/courses": t("courses"),
      "/requests": t("requests"),
      "/requests/:id": t("request"),
      "/ad/:id": t("ad"),
      "/teacher/:id": t("teacherProfile"),
      "/class/:id": t("instituteProfile"),
      "/notes/:id": t("note"),
      "/pricing": t("pricing"),
      "/advertise": t("advertise"),
      "/roles": t("roles"),
      "/help": t("help"),
      "/login": t("login"),
      "/signup": t("signup"),
      "/student": t("studentDashboard"),
      "/teacher": t("teacherDashboard"),
      "/institute": t("instituteDashboard"),
    };
    const label = known[base] ?? base;
    return tab ? `${label} · ${tab}` : label;
  };
}

export function TrafficTab({ initialReport, initialRange }: { initialReport: TrafficReport | null; initialRange: ReportRange }) {
  const t = useTranslations("adminDashboard.traffic");
  const tr = useTranslations("adminDashboard.reports");
  const locale = useLocale();
  const [range, setRange] = useReportRange(initialRange);
  const [report, setReport] = useState<TrafficReport | null>(initialReport);
  const [loadedRange, setLoadedRange] = useState<ReportRange>(initialRange);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const requestId = useRef(0);
  const series = useSeries();
  const fmt = useFormatters();
  const pageLabel = usePageLabel();

  useEffect(() => {
    if (range === loadedRange) return;
    const id = ++requestId.current;
    startLoading(async () => {
      const result = await loadTrafficReport(RANGE_DAYS[range]);
      if (id !== requestId.current) return;
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setReport(result.report);
      setLoadedRange(range);
    });
  }, [range, loadedRange]);

  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date());
  const rows: DailyCount[] = (report?.daily ?? []).flatMap((d) => [
    { d: d.d, k: "visits", n: d.visits },
    { d: d.d, k: "visitors", n: d.visitors },
  ]);
  const daily = series(rows, todayKey, range, ["visits", "visitors"]);
  const totals = report?.totals ?? { visits: 0, visitors: 0, signedInUsers: 0, publicVisits: 0 };
  const firstVisit = report?.firstVisitAt
    ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(report.firstVisitAt))
    : null;
  const pagesPerVisitor = totals.visitors ? (totals.visits / totals.visitors).toFixed(1) : "—";

  const donut = (items: { k: string; n: number }[], label: (k: string) => string) =>
    items.map((item, i) => ({ name: label(item.k), value: item.n, fill: CHART_COLORS[i % CHART_COLORS.length] }));
  const known = (key: string, fallback: string) => (tr.has(key) ? tr(key) : fallback);
  const devices = donut(report?.devices ?? [], (k) => known(`devices.${k}`, k));
  const locales = donut(report?.locales ?? [], (k) => known(`locales.${k}`, k));
  const roleRows = (report?.roles ?? []).map((r) => ({ label: known(`visitorRoles.${r.k}`, r.k), n: r.n }));
  const featureRows = (report?.features ?? []).map((f) => ({
    label: t.has(`features.${f.k}`) ? t(`features.${f.k}`) : f.k,
    n: f.n,
    sub: t("usersCount", { count: f.users }),
  }));

  function exportPages() {
    downloadCsv("classportals-top-pages", [t("table.page"), t("table.path"), t("table.views"), t("table.visitors")], (report?.pages ?? []).map((p) => [pageLabel(p.path), p.path, p.n, p.visitors]));
  }
  function exportSearches() {
    downloadCsv("classportals-searches", [t("table.term"), t("table.searches"), t("table.noResults")], (report?.searches ?? []).map((s) => [s.term, s.n, s.noResults]));
  }

  // Before 0165 is run there's nowhere to record visits.
  if (!report) {
    return (
      <div>
        <ReportHeader title={t("title")} subtitle={t("subtitle")} />
        <div className={cn(cardClass, "flex flex-col items-center gap-3 px-6 py-14 text-center")}>
          <span className="flex size-12 items-center justify-center rounded-full bg-cta/15 text-accent-deep">
            <Radar className="size-6" />
          </span>
          <h2 className="font-display text-lg text-primary">{t("setup.title")}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{error ?? t("setup.body")}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ReportHeader
        title={t("title")}
        subtitle={firstVisit ? t("subtitleSince", { date: firstVisit }) : t("subtitle")}
        range={range}
        onRangeChange={setRange}
      >
        {isLoading && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <Loader2 className="size-3.5 animate-spin" />
            {tr("loading")}
          </span>
        )}
      </ReportHeader>

      {error && <p className="mb-4 text-sm font-medium text-destructive">{error}</p>}

      <div className={cn("transition-opacity", isLoading && "opacity-60")}>
        <KpiGrid className="xl:grid-cols-5">
          <KpiTile label={t("kpi.visits")} value={fmt.number(totals.visits)} icon={Eye} />
          <KpiTile label={t("kpi.visitors")} value={fmt.number(totals.visitors)} hint={t("kpi.visitorsHint")} icon={Users} tone="success" />
          <KpiTile label={t("kpi.pagesPerVisitor")} value={pagesPerVisitor} icon={Compass} tone="cta" />
          <KpiTile label={t("kpi.signedIn")} value={fmt.number(totals.signedInUsers)} hint={t("kpi.signedInHint")} icon={UserRound} />
          <KpiTile label={t("kpi.public")} value={fmt.number(totals.publicVisits)} hint={t("kpi.publicHint")} icon={Globe} tone="muted" />
        </KpiGrid>

        <ChartCard className="mt-4" title={t("charts.daily")} subtitle={t("charts.dailyHint")} icon={Eye} empty={totals.visits === 0} emptyLabel={t("charts.noVisits")}>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={daily} margin={{ top: 8, left: -24, right: 4 }}>
              <defs>
                <linearGradient id="traffic-visits" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="visits" name={tr("visits")} stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#traffic-visits)" />
              <Line type="monotone" dataKey="visitors" name={tr("visitorsDaily")} stroke="var(--color-chart-2)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <Legend
            items={[
              { label: tr("visits"), color: "var(--color-chart-1)" },
              { label: tr("visitorsDaily"), color: "var(--color-chart-2)" },
            ]}
          />
        </ChartCard>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <ChartCard
            className="xl:col-span-2"
            title={t("charts.topPages")}
            icon={FileSearch}
            empty={(report.pages ?? []).length === 0}
            emptyLabel={t("charts.noVisits")}
            action={<ExportButton onClick={exportPages} disabled={(report.pages ?? []).length === 0} />}
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.page")}</TableHead>
                    <TableHead className="text-right">{t("table.views")}</TableHead>
                    <TableHead className="text-right">{t("table.visitors")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.pages.map((p) => (
                    <TableRow key={p.path}>
                      <TableCell>
                        <span className="block font-medium text-foreground">{pageLabel(p.path)}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground">{p.path}</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{fmt.number(p.n)}</TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">{fmt.number(p.visitors)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ChartCard>

          <ChartCard title={t("charts.sources")} subtitle={t("charts.sourcesHint")} icon={Globe} empty={(report.referrers ?? []).length === 0} emptyLabel={t("charts.noVisits")}>
            <RankedBars rows={report.referrers.map((r) => ({ label: r.k === "direct" ? t("direct") : r.k, n: r.n }))} color="var(--color-chart-3)" />
          </ChartCard>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { title: t("charts.devices"), icon: MonitorSmartphone, data: devices },
            { title: t("charts.languages"), icon: Languages, data: locales },
          ].map((chart) => (
            <ChartCard key={chart.title} title={chart.title} icon={chart.icon} empty={chart.data.length === 0} emptyLabel={t("charts.noVisits")}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={chart.data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2} strokeWidth={0}>
                    {chart.data.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <Legend items={chart.data.map((d) => ({ label: `${d.name} · ${d.value}`, color: d.fill }))} />
            </ChartCard>
          ))}
          <ChartCard title={t("charts.who")} subtitle={t("charts.whoHint")} icon={Users} empty={roleRows.length === 0} emptyLabel={t("charts.noVisits")}>
            <RankedBars rows={roleRows} />
          </ChartCard>
        </div>

        <SectionHeading hint={t("featuresHint")}>{t("featuresHeading")}</SectionHeading>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard title={t("charts.features")} subtitle={t("charts.featuresHint")} icon={MousePointerClick} empty={featureRows.length === 0} emptyLabel={t("charts.noFeatures")}>
            <RankedBars rows={featureRows} color="var(--color-chart-2)" />
          </ChartCard>

          <ChartCard
            title={t("charts.searches")}
            subtitle={t("charts.searchesHint")}
            icon={SearchX}
            empty={(report.searches ?? []).length === 0}
            emptyLabel={t("charts.noSearches")}
            action={<ExportButton onClick={exportSearches} disabled={(report.searches ?? []).length === 0} />}
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.term")}</TableHead>
                    <TableHead className="text-right">{t("table.searches")}</TableHead>
                    <TableHead className="text-right">{t("table.noResults")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.searches.map((s) => (
                    <TableRow key={s.term}>
                      <TableCell className="font-medium text-foreground">{s.term || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt.number(s.n)}</TableCell>
                      <TableCell className="text-right">
                        {s.noResults > 0 ? (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive tabular-nums">
                            {fmt.number(s.noResults)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ChartCard>
        </div>

        <ChartCard className="mt-4" title={t("charts.ads")} subtitle={t("charts.adsHint")} icon={Megaphone} empty={(report.ads ?? []).length === 0} emptyLabel={t("charts.noAds")}>
          <RankedBars rows={report.ads.map((a) => ({ label: a.title, n: a.n, sub: t("visitorsCount", { count: a.visitors }) }))} color="var(--color-chart-2)" />
        </ChartCard>

        <p className="mt-4 text-xs text-muted-foreground">{t("privacyNote")}</p>
      </div>
    </div>
  );
}
