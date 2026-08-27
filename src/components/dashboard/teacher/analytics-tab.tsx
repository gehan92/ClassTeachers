"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LabelList,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  TrendingUp,
  Award,
  CalendarCheck,
  Users,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  ChartNoAxesColumn,
  UserRoundSearch,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/features/status-badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { cn } from "@/lib/utils";
import { avatarGradientClass } from "@/lib/avatar-color";

export type AnalyticsExamResultRow = {
  examId: string;
  examTitle: string;
  /** ISO scheduled_at — null for an exam with no scheduled date, excluded from the time-range filter and every chart that's ordered by date. */
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

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

const chartCardClass =
  "rounded-lg border border-border bg-white p-5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]";

function ChartHeading({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Icon className="size-4 text-primary" />
      <h3 className="text-sm font-semibold text-foreground">{children}</h3>
    </div>
  );
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
  const [studentFilter, setStudentFilter] = useState("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [sortKey, setSortKey] = useState<"name" | "exams" | "avg" | "attendance">("avg");
  const [sortDesc, setSortDesc] = useState(true);

  const batchTitleById = useMemo(() => new Map(batches.map((b) => [b.id, b.title])), [batches]);

  // Class/exam/time filters only — deliberately NOT student-scoped. This is
  // the "everyone" baseline every class-average and class-comparison number
  // is computed from; filteredResults below narrows it further for the
  // student-facing views (stat cards, pie, table).
  const scopedResults = useMemo(
    () =>
      examResults.filter((r) => {
        if (batchFilter !== "all" && r.batchId !== batchFilter) return false;
        if (examFilter !== "all" && r.examId !== examFilter) return false;
        if (!withinRange(r.examDateIso, timeRange)) return false;
        return true;
      }),
    [examResults, batchFilter, examFilter, timeRange],
  );

  const examOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of scopedResults) if (!seen.has(r.examId)) seen.set(r.examId, r.examTitle);
    return [...seen.entries()];
  }, [scopedResults]);

  const studentOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of scopedResults) if (!seen.has(r.studentId)) seen.set(r.studentId, r.studentName);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [scopedResults]);

  const filteredResults = useMemo(
    () => (studentFilter === "all" ? scopedResults : scopedResults.filter((r) => r.studentId === studentFilter)),
    [scopedResults, studentFilter],
  );

  const filteredAttendance = useMemo(
    () =>
      attendance.filter((a) => {
        if (batchFilter !== "all" && a.batchId !== batchFilter) return false;
        if (!withinRange(a.dateIso, timeRange)) return false;
        if (studentFilter !== "all" && a.studentId !== studentFilter) return false;
        return true;
      }),
    [attendance, batchFilter, timeRange, studentFilter],
  );

  const scopedGraded = useMemo(
    () => scopedResults.filter((r) => r.status === "graded" && r.scorePercent !== null),
    [scopedResults],
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
  const selectedStudentName = studentFilter !== "all" ? studentOptions.find(([id]) => id === studentFilter)?.[1] : undefined;

  // Average % per exam — scoped to whatever's currently filtered, so this
  // becomes "this student's own score per exam" automatically once a
  // student is picked (the literal student-wise progress chart), and stays
  // "class average per exam" otherwise.
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

  // Average % per class/batch — always computed from the full (not
  // student-scoped) set, since "how do my classes compare" is a
  // class-owner question independent of any one student.
  const classChartData = useMemo(() => {
    const byBatch = new Map<string, { title: string; total: number; count: number }>();
    for (const r of scopedGraded) {
      const key = r.batchId ?? "__none";
      const title = r.batchId ? (batchTitleById.get(r.batchId) ?? t("filters.allClassesOption")) : t("noClassLabel");
      const entry = byBatch.get(key) ?? { title, total: 0, count: 0 };
      entry.total += r.scorePercent!;
      entry.count += 1;
      byBatch.set(key, entry);
    }
    return [...byBatch.values()].map((e) => ({ title: e.title, avg: Math.round(e.total / e.count) }));
  }, [scopedGraded, batchTitleById, t]);

  // Only built when a student is selected — merges that student's own
  // per-exam score with the class average for the same exam (from
  // scopedGraded, i.e. every student, not just this one), so the chart can
  // plot "this student vs. everyone else" on the same axis.
  const studentVsClassData = useMemo(() => {
    if (studentFilter === "all") return [];
    const classAvgByExam = new Map<string, { title: string; total: number; count: number; dateIso: string | null }>();
    for (const r of scopedGraded) {
      const entry = classAvgByExam.get(r.examId) ?? { title: r.examTitle, total: 0, count: 0, dateIso: r.examDateIso };
      entry.total += r.scorePercent!;
      entry.count += 1;
      classAvgByExam.set(r.examId, entry);
    }
    const studentByExam = new Map(
      graded.map((r) => [r.examId, r.scorePercent!] as const),
    );
    return [...classAvgByExam.entries()]
      .filter(([examId]) => studentByExam.has(examId))
      .map(([examId, e]) => ({
        title: e.title,
        dateIso: e.dateIso,
        student: studentByExam.get(examId)!,
        classAvg: Math.round(e.total / e.count),
      }))
      .sort((a, b) => (a.dateIso ?? "").localeCompare(b.dateIso ?? ""));
  }, [studentFilter, scopedGraded, graded]);

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

  const axisTick = { fontSize: 11, fill: "var(--color-muted-foreground)" };
  const tooltipStyle = { borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12 };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-primary">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isCampusLecturer ? t("subtitleCampus") : t("subtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          value={batchFilter}
          onValueChange={(value) => {
            setBatchFilter(value ?? "all");
            setExamFilter("all");
            setStudentFilter("all");
          }}
        >
          <SelectTrigger className="w-full sm:w-52">
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

        <Select
          value={examFilter}
          onValueChange={(value) => {
            setExamFilter(value ?? "all");
            setStudentFilter("all");
          }}
        >
          <SelectTrigger className="w-full sm:w-52">
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

        <Select value={studentFilter} onValueChange={(value) => setStudentFilter(value ?? "all")}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allStudentsOption")}</SelectItem>
            {studentOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={timeRange} onValueChange={(value) => setTimeRange((value as TimeRange) ?? "all")}>
          <SelectTrigger className="w-full sm:w-44">
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
        <StatCard
          label={t("stats.avgScore")}
          value={avgPercent !== null ? `${avgPercent}%` : "—"}
          icon={TrendingUp}
          tone="primary"
        />
        <StatCard
          label={t("stats.passRate")}
          value={passRate !== null ? `${passRate}%` : "—"}
          icon={Award}
          tone="success"
        />
        <StatCard
          label={t("stats.attendanceRate")}
          value={attendanceRate !== null ? `${attendanceRate}%` : "—"}
          icon={CalendarCheck}
          tone="cta"
        />
        {studentFilter === "all" ? (
          <StatCard label={t("stats.students")} value={studentCount} icon={Users} tone="primary" />
        ) : (
          <StatCard label={t("table.examsTaken")} value={graded.length} icon={UserRoundSearch} tone="primary" />
        )}
      </div>

      {graded.length === 0 ? (
        <div className={`${chartCardClass} flex flex-col items-center gap-2 py-14 text-center`}>
          <ChartNoAxesColumn className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className={chartCardClass}>
              <ChartHeading icon={BarChart3}>
                {isCampusLecturer ? t("charts.byClassHeadingCampus") : t("charts.byClassHeading")}
              </ChartHeading>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={classChartData} margin={{ top: 16, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="title" tick={axisTick} interval={0} angle={-20} textAnchor="end" height={55} />
                  <YAxis domain={[0, 100]} tick={axisTick} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}%`, t("stats.avgScore")]} />
                  <Bar dataKey="avg" fill="var(--color-cta)" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    <LabelList
                      dataKey="avg"
                      position="top"
                      formatter={(value) => `${value}%`}
                      style={{ fill: "var(--color-accent-deep)", fontSize: 11, fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className={chartCardClass}>
              <ChartHeading icon={PieChartIcon}>{t("charts.passFailHeading")}</ChartHeading>
              <div className="relative">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      formatter={(value) => <span className="text-xs text-foreground/80">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 top-0 flex flex-col items-center justify-center pb-9">
                  <span className="font-display text-2xl text-primary">
                    {passRate !== null ? `${passRate}%` : "—"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{t("passLabel")}</span>
                </div>
              </div>
            </div>
          </div>

          <div className={chartCardClass}>
            <ChartHeading icon={BarChart3}>{t("charts.byExamHeading")}</ChartHeading>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={examChartData} margin={{ top: 16, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="title" tick={axisTick} interval={0} angle={-20} textAnchor="end" height={55} />
                <YAxis domain={[0, 100]} tick={axisTick} unit="%" />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}%`, t("stats.avgScore")]} />
                <Bar dataKey="avg" fill="var(--color-primary)" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  <LabelList
                    dataKey="avg"
                    position="top"
                    formatter={(value) => `${value}%`}
                    style={{ fill: "var(--color-primary)", fontSize: 11, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {studentFilter !== "all" ? (
            <div className={chartCardClass}>
              <ChartHeading icon={UserRoundSearch}>
                {t("charts.studentProgressHeading", { name: selectedStudentName ?? "" })}
              </ChartHeading>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={studentVsClassData} margin={{ top: 16, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="title" tick={axisTick} interval={0} angle={-20} textAnchor="end" height={55} />
                  <YAxis domain={[0, 100]} tick={axisTick} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend
                    verticalAlign="top"
                    height={28}
                    iconType="circle"
                    formatter={(value) => <span className="text-xs text-foreground/80">{value}</span>}
                  />
                  <Line
                    type="monotone"
                    dataKey="student"
                    name={t("charts.studentScoreLabel")}
                    stroke="var(--color-primary)"
                    strokeWidth={2.75}
                    dot={{ r: 4, fill: "var(--color-primary)", strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="classAvg"
                    name={t("charts.classAvgLabel")}
                    stroke="var(--color-muted-foreground)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={{ r: 3, fill: "var(--color-muted-foreground)", strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className={chartCardClass}>
              <ChartHeading icon={Activity}>{t("charts.trendHeading")}</ChartHeading>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={examChartData} margin={{ top: 16, left: -20 }}>
                  <defs>
                    <linearGradient id="analyticsTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="title" tick={axisTick} interval={0} angle={-20} textAnchor="end" height={55} />
                  <YAxis domain={[0, 100]} tick={axisTick} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}%`, t("stats.avgScore")]} />
                  <Area
                    type="monotone"
                    dataKey="avg"
                    stroke="var(--color-primary)"
                    strokeWidth={2.5}
                    fill="url(#analyticsTrendFill)"
                    dot={{ r: 3.5, fill: "var(--color-primary)", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      <div className={chartCardClass}>
        <ChartHeading icon={Users}>{t("table.heading")}</ChartHeading>
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
                  <TableRow
                    key={row.studentId}
                    className={cn("cursor-pointer", row.studentId === studentFilter && "bg-secondary/40")}
                    onClick={() => setStudentFilter(row.studentId === studentFilter ? "all" : row.studentId)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar size="sm">
                          <AvatarFallback className={avatarGradientClass(row.name)}>
                            {initialsFor(row.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-foreground">{row.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.examsTaken}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className={row.avgPercent >= PASS_THRESHOLD ? "h-full bg-success" : "h-full bg-destructive"}
                            style={{ width: `${row.avgPercent}%` }}
                          />
                        </div>
                        <StatusBadge variant={row.avgPercent >= PASS_THRESHOLD ? "active" : "suspended"}>
                          {row.avgPercent}%
                        </StatusBadge>
                      </div>
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
