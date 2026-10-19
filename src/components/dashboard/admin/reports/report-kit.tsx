"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDownRight, ArrowUpRight, ChartNoAxesColumn, Download, Minus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DailyCount, ReportRange } from "@/types/dashboard-admin";

/**
 * Shared building blocks for every Admin report tab: the date-range picker,
 * number tiles with a change-vs-previous-period arrow, chart cards, CSV
 * export, and the helpers that turn DailyCount rows into chart series.
 */

export const REPORT_RANGES: ReportRange[] = ["7d", "30d", "90d", "12m"];
export const RANGE_DAYS: Record<ReportRange, number> = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 };

/** Series colours, all from the theme tokens so they follow the palette. */
export const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-5)",
  "var(--color-chart-4)",
  "var(--color-destructive)",
];

export const axisTick = { fontSize: 11, fill: "var(--color-muted-foreground)" };
export const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  fontSize: 12,
  boxShadow: "0 8px 24px -12px rgba(14,33,29,0.25)",
};

// ------------------------------------------------------------ date maths

function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Inclusive day-key bounds of the selected range and the one before it. */
export function rangeBounds(todayKey: string, range: ReportRange) {
  const days = RANGE_DAYS[range];
  const start = addDays(todayKey, -(days - 1));
  return { start, end: todayKey, prevStart: addDays(start, -days), prevEnd: addDays(start, -1) };
}

export function sumBetween(rows: DailyCount[], start: string, end: string, keys?: string[]): number {
  let total = 0;
  for (const r of rows) {
    if (r.d < start || r.d > end) continue;
    if (keys && !keys.includes(r.k)) continue;
    total += r.n;
  }
  return total;
}

/** Current-range total and previous-range total, for a tile with a change arrow. */
export function compare(rows: DailyCount[], todayKey: string, range: ReportRange, keys?: string[]) {
  const b = rangeBounds(todayKey, range);
  return { current: sumBetween(rows, b.start, b.end, keys), previous: sumBetween(rows, b.prevStart, b.prevEnd, keys) };
}

/** Totals per category within the range, biggest first. */
export function totalsByKey(rows: DailyCount[], todayKey: string, range: ReportRange): { k: string; n: number }[] {
  const { start, end } = rangeBounds(todayKey, range);
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.d < start || r.d > end) continue;
    map.set(r.k, (map.get(r.k) ?? 0) + r.n);
  }
  return [...map.entries()].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
}

type Bucket = { key: string; label: string; [series: string]: string | number };

/**
 * Chart-ready series: one point per day (7 / 30 days), per week (90 days)
 * or per month (12 months), with one numeric field per series key. Empty
 * buckets are kept as zeros so the time axis stays continuous.
 */
export function useSeries() {
  const locale = useLocale();
  const dayFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit", timeZone: "UTC" });

  return function series(
    rows: DailyCount[],
    todayKey: string,
    range: ReportRange,
    keys: string[],
    mapKey: (k: string) => string | null = (k) => k,
  ): Bucket[] {
    const { start, end } = rangeBounds(todayKey, range);
    const mode = range === "12m" ? "month" : range === "90d" ? "week" : "day";
    const buckets = new Map<string, Bucket>();
    const bucketKeyFor = (d: string) => {
      if (mode === "month") return d.slice(0, 7);
      if (mode === "week") {
        const offset = Math.floor((Date.parse(d) - Date.parse(start)) / 86_400_000 / 7) * 7;
        return addDays(start, offset);
      }
      return d;
    };
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const key = bucketKeyFor(d);
      if (buckets.has(key)) continue;
      const date = new Date(`${mode === "month" ? `${key}-01` : key}T00:00:00Z`);
      const bucket: Bucket = { key, label: mode === "month" ? monthFmt.format(date) : dayFmt.format(date) };
      for (const k of keys) bucket[k] = 0;
      buckets.set(key, bucket);
    }
    for (const r of rows) {
      if (r.d < start || r.d > end) continue;
      const seriesKey = mapKey(r.k);
      if (!seriesKey || !keys.includes(seriesKey)) continue;
      const bucket = buckets.get(bucketKeyFor(r.d));
      if (bucket) bucket[seriesKey] = (bucket[seriesKey] as number) + r.n;
    }
    return [...buckets.values()];
  };
}

// --------------------------------------------------------------- formatting

export function useFormatters() {
  const locale = useLocale();
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return {
    number: (n: number) => number.format(n),
    money: (n: number) => `Rs. ${number.format(Math.round(n))}`,
    percent: (n: number | null) => (n === null ? "—" : `${Math.round(n)}%`),
  };
}

// ----------------------------------------------------------- range state

const RANGE_STORAGE_KEY = "cp_admin_report_range";

/** The chosen range is remembered in this browser, so every tab opens on it. */
export function useReportRange(initial: ReportRange = "30d") {
  const [range, setRangeState] = useState<ReportRange>(initial);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(RANGE_STORAGE_KEY) as ReportRange | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a saved preference after hydration
      if (saved && REPORT_RANGES.includes(saved)) setRangeState(saved);
    } catch {
      // Storage unavailable — keep the default.
    }
  }, []);
  function setRange(next: ReportRange) {
    setRangeState(next);
    try {
      window.localStorage.setItem(RANGE_STORAGE_KEY, next);
    } catch {
      // Storage unavailable — the choice just isn't remembered.
    }
  }
  return [range, setRange] as const;
}

export function RangePicker({ value, onChange }: { value: ReportRange; onChange: (range: ReportRange) => void }) {
  const t = useTranslations("adminDashboard.reports.range");
  return (
    <div role="radiogroup" aria-label={t("label")} className="inline-flex rounded-lg border border-border bg-white p-0.5">
      {REPORT_RANGES.map((range) => (
        <button
          key={range}
          type="button"
          role="radio"
          aria-checked={value === range}
          onClick={() => onChange(range)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            value === range ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {t(range)}
        </button>
      ))}
    </div>
  );
}

/** Page heading row shared by every report tab: title + subtitle left, range picker (and extras) right. */
export function ReportHeader({
  title,
  subtitle,
  range,
  onRangeChange,
  children,
}: {
  title: string;
  subtitle: string;
  range?: ReportRange;
  onRangeChange?: (range: ReportRange) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl text-balance text-primary">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {range && onRangeChange && <RangePicker value={range} onChange={onRangeChange} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- tiles

export const cardClass =
  "rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(14,33,29,0.06),0_8px_24px_-14px_rgba(14,33,29,0.18)]";

const toneClasses = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  cta: "bg-cta/15 text-accent-deep",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
} as const;

export type Tone = keyof typeof toneClasses;

/**
 * A headline number. With `previous`, shows the change against the
 * previous period of the same length; `hint` is a short line underneath.
 */
export function KpiTile({
  label,
  value,
  current,
  previous,
  hint,
  icon: Icon,
  tone = "primary",
  invertDelta = false,
}: {
  label: string;
  value: string;
  current?: number;
  previous?: number;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  /** For numbers where going up is bad (failed payments, reports). */
  invertDelta?: boolean;
}) {
  const t = useTranslations("adminDashboard.reports");
  let delta: React.ReactNode = null;
  if (current !== undefined && previous !== undefined) {
    const diff = current - previous;
    const pct = previous > 0 ? Math.round((diff / previous) * 100) : null;
    const good = invertDelta ? diff < 0 : diff > 0;
    const DeltaIcon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
    delta = (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
          diff === 0 ? "bg-muted text-muted-foreground" : good ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
        )}
        title={t("vsPrevious", { value: previous })}
      >
        <DeltaIcon className="size-3" />
        {diff === 0 ? t("noChange") : pct !== null ? `${pct > 0 ? "+" : ""}${pct}%` : `+${diff}`}
      </span>
    );
  }
  return (
    <div className={cn(cardClass, "flex flex-col gap-2 p-4")}>
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">{label}</span>
        {Icon && (
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", toneClasses[tone])}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-display text-2xl text-primary tabular-nums">{value}</span>
        {delta}
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function KpiGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6", className)}>{children}</div>;
}

// ---------------------------------------------------------------- charts

export function ChartCard({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className,
  empty,
  emptyLabel,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Shows a calm empty state instead of a chart full of zeros. */
  empty?: boolean;
  emptyLabel?: string;
}) {
  const t = useTranslations("adminDashboard.reports");
  return (
    <section className={cn(cardClass, "flex min-w-0 flex-col p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {Icon && <Icon className="size-4 shrink-0 text-primary" />}
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
          <ChartNoAxesColumn className="size-7 text-muted-foreground/40" />
          <p className="max-w-xs text-sm text-muted-foreground">{emptyLabel ?? t("emptyRange")}</p>
        </div>
      ) : (
        <div className="min-w-0 flex-1">{children}</div>
      )}
    </section>
  );
}

export function SectionHeading({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mt-8 mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="font-display text-lg text-primary">{children}</h2>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

/** A ranked list with proportional bars — reads better than a chart for top-10 lists. */
export function RankedBars({
  rows,
  format = (n) => String(n),
  emptyLabel,
  color = "var(--color-primary)",
}: {
  rows: { label: string; n: number; sub?: string }[];
  format?: (n: number) => string;
  emptyLabel?: string;
  color?: string;
}) {
  const t = useTranslations("adminDashboard.reports");
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel ?? t("emptyRange")}</p>;
  }
  return (
    <ol className="flex flex-col gap-2.5">
      {rows.map((row, i) => (
        <li key={`${row.label}-${i}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
          <span className="truncate text-sm text-foreground" title={row.label}>
            {row.label}
            {row.sub && <span className="ml-1.5 text-xs text-muted-foreground">{row.sub}</span>}
          </span>
          <span className="text-sm font-semibold text-foreground tabular-nums">{format(row.n)}</span>
          <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full" style={{ width: `${(row.n / max) * 100}%`, background: color }} />
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Percentage bar with a label — onboarding completion, success rates. */
export function ProgressRow({ label, value, total, color = "var(--color-success)" }: { label: string; value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {value} / {total} · <span className="font-semibold text-foreground">{pct}%</span>
        </span>
      </div>
      <span className="h-2 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </span>
    </div>
  );
}

// ------------------------------------------------------------------- CSV

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  // Neutralise spreadsheet formulas (CSV injection) and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const body = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  // BOM so Excel opens Sinhala/Tamil names correctly.
  const blob = new Blob(["﻿", body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const t = useTranslations("adminDashboard.reports");
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Download className="size-3.5" />
      {t("exportCsv")}
    </Button>
  );
}

/** Small coloured legend for charts that don't use recharts' own. */
export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-full" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
