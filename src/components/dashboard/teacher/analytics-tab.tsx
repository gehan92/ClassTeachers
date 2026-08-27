"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/stat-card";

export type AnalyticsExamResultRow = {
  examId: string;
  examTitle: string;
  /** ISO scheduled_at — null for an exam with no scheduled date, excluded from the time-range filter and the trend line. */
  examDateIso: string | null;
  batchId: string | null;
  studentId: string;
  studentName: string;
  status: "pending" | "graded";
  /** Grade as a % of the exam's total marks (sum of its question_bank_items.marks) — null when the submission isn't graded yet, or the exam's total marks can't be resolved (e.g. a question was later deleted). Clamped to 0-100 defensively since `grade` is a free-typed number a teacher could mistype above the max. */
  scorePercent: number | null;
};

export type AnalyticsAttendanceRow = {
  batchId: string | null;
  dateIso: string;
  studentId: string;
  studentName: string;
  status: "present" | "absent" | "late";
};

export type AnalyticsBatchOption = { id: string; title: string };

const TIME_RANGES = ["all", "30d", "90d", "year"] as const;
type TimeRange = (typeof TIME_RANGES)[number];

// Sri Lankan school/tuition convention — not teacher-configurable in this
// first version.
const PASS_THRESHOLD = 40;

function withinRange(dateIso: string | null, range: TimeRange): boolean {
  if (range === "all") return true;
  if (!dateIso) return false;
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 365;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(dateIso).getTime() >= cutoff;
}

export function AnalyticsTab({
  examResults,
  attendance,
  batches,
  isCampusLecturer = false,
}: {
  examResults: AnalyticsExamResultRow[];
  attendance: AnalyticsAttendanceRow[];
  batches: AnalyticsBatchOption[];
  isCampusLecturer?: boolean;
}) {
  const t = useTranslations("teacherDashboard.analytics");
  const [batchFilter, setBatchFilter] = useState("all");
  const [examFilter, setExamFilter] = useState("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [sortKey, setSortKey] = useState<"name" | "exams" | "avg" | "attendance">("avg");
  const [sortDesc, setSortDesc] = useState(true);

  const examOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of examResults) {
      if (batchFilter !== "all" && r.batchId !== batchFilter) continue;
      if (!seen.has(r.examId)) seen.set(r.examId, r.examTitle);
    }
    return [...seen.entries()];
  }, [examResults, batchFilter]);

  const filteredResults = useMemo(
    () =>
      examResults.filter((r) => {
        if (batchFilter !== "all" && r.batchId !== batchFilter) return false;
        if (examFilter !== "all" && r.examId !== examFilter) return false;
        if (!withinRange(r.examDateIso, timeRange)) return false;
        return true;
      }),
    [examResults, batchFilter, examFilter, timeRange],
  );

  const filteredAttendance = useMemo(
    () =>
      attendance.filter((a) => {
        if (batchFilter !== "all" && a.batchId !== batchFilter) return false;
        if (!withinRange(a.dateIso, timeRange)) return false;
        return true;
      }),
    [attendance, batchFilter, timeRange],
  );

  const graded = useMemo(
    () => filteredResults.filter((r) => r.status === "graded" && r.scorePercent !== null),
    [filteredResults],
  );

  const avgPercent = graded.length
    ? Math.round(graded.reduce((sum, r) => sum + r.scorePercent!, 0) / graded.length)
    : null;
  const passCount = graded.filter((r) => r.scorePercent! >= PASS_THRESHOLD).length;
  const passRate = graded.length ? Math.round((passCount / graded.length) * 100) : null;
  const presentCount = filteredAttendance.filter((a) => a.status === "present").length;
  const attendanceRate = filteredAttendance.length
    ? Math.round((presentCount / filteredAttendance.length) * 100)
    : null;
  const studentCount = new Set(filteredResults.map((r) => r.studentId)).size;

  const examChartData = useMemo(() => {
    const byExam = new Map<string, { title: string; total: number; count: number; dateIso: string | null }>();
    for (const r of graded) {
      const entry = byExam.get(r.examId) ?? { title: r.examTitle, total: 0, count: 0, dateIso: r.examDateIso };
      entry.total += r.scorePercent!;
      entry.count += 1;
      byExam.set(r.examId, entry);
    }
    return [...byExam.values()]
      .map((e) => ({ title: e.title, avg: Math.round(e.total / e.count), dateIso: e.dateIso }))
      .sort((a, b) => (a.dateIso ?? "").localeCompare(b.dateIso ?? ""));
  }, [graded]);

  const pieData = [
    { name: t("passLabel"), value: passCount, fill: "var(--color-success)" },
    { name: t("failLabel"), value: graded.length - passCount, fill: "var(--color-destructive)" },
  ];

  const studentRows = useMemo(() => {
    const byStudent = new Map<string, { name: string; total: number; count: number; lastIso: string | null }>();
    for (const r of graded) {
      const entry = byStudent.get(r.studentId) ?? { name: r.studentName, total: 0, count: 0, lastIso: null };
      entry.total += r.scorePercent!;
      entry.count += 1;
      if (r.examDateIso && (!entry.lastIso || r.examDateIso > entry.lastIso)) entry.lastIso = r.examDateIso;
      byStudent.set(r.studentId, entry);
    }
    const attByStudent = new Map<string, { present: number; total: number }>();
    for (const a of filteredAttendance) {
      const entry = attByStudent.get(a.studentId) ?? { present: 0, total: 0 };
      entry.total += 1;
      if (a.status === "present") entry.present += 1;
      attByStudent.set(a.studentId, entry);
    }
    const rows = [...byStudent.entries()].map(([studentId, e]) => {
      const att = attByStudent.get(studentId);
      return {
        studentId,
        name: e.name,
        examsTaken: e.count,
        avgPercent: Math.round(e.total / e.count),
        attendancePercent: att ? Math.round((att.present / att.total) * 100) : null,
        lastActivity: e.lastIso,
      };
    });
    const dir = sortDesc ? -1 : 1;
    return rows.sort((a, b) => {
      if (sortKey === "name") return dir * b.name.localeCompare(a.name);
      if (sortKey === "exams") return dir * (b.examsTaken - a.examsTaken);
      if (sortKey === "attendance") return dir * ((b.attendancePercent ?? -1) - (a.attendancePercent ?? -1));
      return dir * (b.avgPercent - a.avgPercent);
    });
  }, [graded, filteredAttendance, sortKey, sortDesc]);

  function toggleSort(key: typeof sortKey) {
    if (key === sortKey) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-primary">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isCampusLecturer ? t("subtitleCampus") : t("subtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Select
          value={batchFilter}
          onValueChange={(value) => {
            setBatchFilter(value ?? "all");
            setExamFilter("all");
          }}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isCampusLecturer ? t("filters.allCoursesOption") : t("filters.allClassesOption")}</SelectItem>
            {batches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={examFilter} onValueChange={(value) => setExamFilter(value ?? "all")}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allExamsOption")}</SelectItem>
            {examOptions.map(([id, title]) => (
              <SelectItem key={id} value={id}>
                {title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={timeRange} onValueChange={(value) => setTimeRange((value as TimeRange) ?? "all")}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGES.map((range) => (
              <SelectItem key={range} value={range}>
                {t(`filters.range.${range}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("stats.avgScore")} value={avgPercent !== null ? `${avgPercent}%` : "—"} />
        <StatCard label={t("stats.passRate")} value={passRate !== null ? `${passRate}%` : "—"} />
        <StatCard label={t("stats.attendanceRate")} value={attendanceRate !== null ? `${attendanceRate}%` : "—"} />
        <StatCard label={t("stats.students")} value={studentCount} />
      </div>

      {graded.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-8 text-center text-sm text-muted-foreground">
          {t("emptyState")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">{t("charts.byExamHeading")}</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={examChartData} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis
                    dataKey="title"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(value) => [`${value}%`, t("stats.avgScore")]} />
                  <Bar dataKey="avg" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg border border-border bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">{t("charts.passFailHeading")}</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">{t("charts.trendHeading")}</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={examChartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="title" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(value) => [`${value}%`, t("stats.avgScore")]} />
                <Line type="monotone" dataKey="avg" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">{t("table.heading")}</h3>
        {studentRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                    {t("table.student")}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("exams")}>
                    {t("table.examsTaken")}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("avg")}>
                    {t("table.avgScore")}
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("attendance")}>
                    {t("table.attendance")}
                  </TableHead>
                  <TableHead>{t("table.lastActivity")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentRows.map((row) => (
                  <TableRow key={row.studentId}>
                    <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.examsTaken}</TableCell>
                    <TableCell className={row.avgPercent >= PASS_THRESHOLD ? "text-success" : "text-destructive"}>
                      {row.avgPercent}%
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.attendancePercent !== null ? `${row.attendancePercent}%` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.lastActivity ? new Date(row.lastActivity).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
