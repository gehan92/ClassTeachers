import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { AdminReports, DailyCount, PlatformUserRole, RoleActivity } from "@/types/dashboard-admin";

/**
 * Everything Admin -> Overview / Growth / Earnings / Activity charts need,
 * built from data the platform already stores (no tracking required).
 *
 * Called only from the admin page AFTER its own role check, with the
 * service-role client. Each table is read with only the 1-3 columns a chart
 * needs, limited to the last ~13 months, and aggregated here into small
 * per-day rows (DailyCount) — so what reaches the browser stays tiny no
 * matter how big the tables get.
 */

type Admin = SupabaseClient<Database>;

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 400;
const PAGE = 1000;
/** Safety cap per table so one runaway table can't stall the dashboard. */
const MAX_ROWS = 50_000;

const colomboDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Colombo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** ISO timestamp -> Sri Lanka calendar day, "YYYY-MM-DD". */
export function dayKey(iso: string | Date): string {
  return colomboDay.format(typeof iso === "string" ? new Date(iso) : iso);
}

/**
 * PostgREST returns at most 1,000 rows per request, so a plain select would
 * silently stop counting at 1,000. This pages through with .range().
 */
async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error || !data) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

/** Groups rows into DailyCount cells, summing `value` (default 1 per row). */
function bucket<T>(
  rows: T[],
  date: (row: T) => string | null | undefined,
  key: (row: T) => string | null | undefined,
  value: (row: T) => number = () => 1,
): DailyCount[] {
  const map = new Map<string, DailyCount>();
  for (const row of rows) {
    const iso = date(row);
    const k = key(row);
    if (!iso || !k) continue;
    const d = dayKey(iso);
    const id = `${d}|${k}`;
    const cell = map.get(id);
    if (cell) cell.n += value(row);
    else map.set(id, { d, k, n: value(row) });
  }
  return [...map.values()];
}

async function headCount(
  query: PromiseLike<{ count: number | null }>,
): Promise<number> {
  const { count } = await query;
  return count ?? 0;
}

const ROLE_BY_DB: Record<string, PlatformUserRole> = {
  student: "student",
  teacher: "teacher",
  campus_lecturer: "campus_lecturer",
  class: "institute",
};

const MODERATION_GROUP: Record<string, string> = {
  content_removed: "contentRemoved",
  content_hidden: "contentRemoved",
  site_ad_removed: "contentRemoved",
  review_removed: "reviewRemoved",
  user_suspension_change: "suspended",
};

function subjectName(translations: unknown): string {
  const t = (translations as Record<string, string> | null) ?? {};
  return t.en ?? Object.values(t)[0] ?? "—";
}

export async function loadAdminReports(admin: Admin, authUsers: User[]): Promise<AdminReports> {
  const since = new Date(Date.now() - HISTORY_DAYS * DAY_MS).toISOString();

  const [
    profiles,
    payments,
    enrollments,
    inquiries,
    batches,
    exams,
    submissions,
    liveClasses,
    attendance,
    notes,
    assignments,
    questions,
    reviews,
    wantedAds,
    wantedResponses,
    feePayments,
    auditRows,
    teacherProfiles,
    classProfiles,
    subjects,
    adRows,
    totalsNotes,
    totalsExams,
    totalsQuestions,
    totalsAssignments,
    totalsLive,
    totalsReviews,
    totalsBatches,
    openWantedAds,
  ] = await Promise.all([
    fetchAll((from, to) =>
      admin.from("profiles").select("id, role, full_name, created_at, location, profile_completed_at").order("created_at").range(from, to),
    ),
    fetchAll((from, to) =>
      admin
        .from("platform_payments")
        .select("purpose, amount, status, paid_at, created_at, enrollment_id, institute_id")
        .gte("created_at", since)
        .order("created_at")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      admin
        .from("enrollments")
        .select("id, owner_type, owner_id, batch_id, status, joined_at, platform_fee_paid, platform_fee_waived")
        .order("joined_at")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      admin.from("inquiries").select("created_at").gte("created_at", since).order("created_at").range(from, to),
    ),
    fetchAll((from, to) =>
      admin.from("batches").select("id, owner_type, subject_id, created_at").order("created_at").range(from, to),
    ),
    fetchAll((from, to) =>
      admin.from("exams").select("id, created_at, question_ids").gte("created_at", since).order("created_at").range(from, to),
    ),
    fetchAll((from, to) =>
      admin
        .from("exam_submissions")
        .select("exam_id, status, grade, mcq_score, mcq_max_score, submitted_at")
        .gte("submitted_at", since)
        .order("submitted_at")
        .range(from, to),
    ),
    fetchAll((from, to) =>
      admin.from("live_classes").select("mode, scheduled_at").gte("scheduled_at", since).order("scheduled_at").range(from, to),
    ),
    fetchAll((from, to) =>
      admin.from("attendance_records").select("status, marked_at").gte("marked_at", since).order("marked_at").range(from, to),
    ),
    fetchAll((from, to) =>
      admin.from("notes").select("created_at").gte("created_at", since).order("created_at").range(from, to),
    ),
    fetchAll((from, to) =>
      admin.from("assignments").select("created_at").gte("created_at", since).order("created_at").range(from, to),
    ),
    fetchAll((from, to) =>
      admin.from("question_bank_items").select("id, marks, subject_id, created_at").order("created_at").range(from, to),
    ),
    fetchAll((from, to) =>
      admin.from("reviews").select("rating, created_at").gte("created_at", since).order("created_at").range(from, to),
    ),
    fetchAll((from, to) =>
      admin.from("wanted_ads").select("created_at").gte("created_at", since).order("created_at").range(from, to),
    ),
    fetchAll((from, to) =>
      admin.from("wanted_ad_responses").select("created_at").gte("created_at", since).order("created_at").range(from, to),
    ),
    fetchAll((from, to) =>
      admin.from("fee_payments").select("amount, paid_at").gte("paid_at", since).order("paid_at").range(from, to),
    ),
    fetchAll((from, to) =>
      admin
        .from("audit_log")
        .select("action, target_id, metadata, created_at")
        .gte("created_at", since)
        .order("created_at")
        .range(from, to),
    ),
    fetchAll((from, to) => admin.from("teacher_profiles").select("id, status, created_at").range(from, to)),
    fetchAll((from, to) => admin.from("class_profiles").select("id, name, status, created_at").range(from, to)),
    fetchAll((from, to) => admin.from("subjects").select("id, translations").range(from, to)),
    fetchAll((from, to) =>
      admin.from("advertisements").select("status, view_count").neq("owner_type", "site").range(from, to),
    ),
    headCount(admin.from("notes").select("id", { count: "exact", head: true })),
    headCount(admin.from("exams").select("id", { count: "exact", head: true })),
    headCount(admin.from("question_bank_items").select("id", { count: "exact", head: true })),
    headCount(admin.from("assignments").select("id", { count: "exact", head: true })),
    headCount(admin.from("live_classes").select("id", { count: "exact", head: true })),
    headCount(admin.from("reviews").select("id", { count: "exact", head: true })),
    headCount(admin.from("batches").select("id", { count: "exact", head: true })),
    headCount(admin.from("wanted_ads").select("id", { count: "exact", head: true }).eq("status", "active")),
  ]);

  // ------------------------------------------------------------ people
  const platformProfiles = profiles.filter((p) => ROLE_BY_DB[p.role]);
  const lastSignInById = new Map(authUsers.map((u) => [u.id, u.last_sign_in_at ?? null]));
  const now = Date.now();
  const signedInWithin = (id: string, days: number) => {
    const at = lastSignInById.get(id);
    return Boolean(at && now - new Date(at).getTime() <= days * DAY_MS);
  };
  const todayKey = dayKey(new Date());

  const roles: PlatformUserRole[] = ["student", "teacher", "campus_lecturer", "institute"];
  const activity: RoleActivity[] = roles.map((role) => {
    const inRole = platformProfiles.filter((p) => ROLE_BY_DB[p.role] === role);
    return {
      role,
      total: inRole.length,
      active7: inRole.filter((p) => signedInWithin(p.id, 7)).length,
      active30: inRole.filter((p) => signedInWithin(p.id, 30)).length,
      onboarded: inRole.filter((p) => p.profile_completed_at).length,
    };
  });

  const locationCounts = new Map<string, { label: string; n: number }>();
  for (const p of platformProfiles) {
    const raw = (p.location ?? "").split(",")[0].trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    const entry = locationCounts.get(key) ?? { label: raw.charAt(0).toUpperCase() + raw.slice(1), n: 0 };
    entry.n += 1;
    locationCounts.set(key, entry);
  }

  // ----------------------------------------------------------- earnings
  const enrollmentById = new Map(enrollments.map((e) => [e.id, e]));
  const classNameById = new Map(classProfiles.map((c) => [c.id, c.name]));
  const profileNameById = new Map(profiles.map((p) => [p.id, p.full_name]));
  const ownerNames: AdminReports["ownerNames"] = {};
  const ownerKeyForPayment = (p: (typeof payments)[number]): string | null => {
    if (p.institute_id) {
      ownerNames[`class:${p.institute_id}`] ??= { name: classNameById.get(p.institute_id) ?? "—", kind: "institute" };
      return `class:${p.institute_id}`;
    }
    const enrollment = p.enrollment_id ? enrollmentById.get(p.enrollment_id) : undefined;
    if (!enrollment) return null;
    const key = `${enrollment.owner_type}:${enrollment.owner_id}`;
    ownerNames[key] ??=
      enrollment.owner_type === "class"
        ? { name: classNameById.get(enrollment.owner_id) ?? "—", kind: "institute" }
        : { name: profileNameById.get(enrollment.owner_id) ?? "—", kind: "teacher" };
    return key;
  };
  const completed = payments.filter((p) => p.status === "completed");
  const paidDate = (p: (typeof payments)[number]) => p.paid_at ?? p.created_at;

  // ------------------------------------------------------------ learning
  const marksById = new Map(questions.map((q) => [q.id, Number(q.marks) || 0]));
  const totalMarksByExam = new Map(
    exams.map((e) => [e.id, (e.question_ids ?? []).reduce((sum: number, id: string) => sum + (marksById.get(id) ?? 0), 0)]),
  );
  const scoreRows: { d: string; pct: number }[] = [];
  for (const s of submissions) {
    if (s.status !== "graded" || !s.submitted_at) continue;
    const total = totalMarksByExam.get(s.exam_id) ?? 0;
    let pct: number | null = null;
    if (s.grade !== null && total > 0) pct = (Number(s.grade) / total) * 100;
    else if (s.mcq_max_score && Number(s.mcq_max_score) > 0) pct = (Number(s.mcq_score ?? 0) / Number(s.mcq_max_score)) * 100;
    if (pct === null || Number.isNaN(pct)) continue;
    scoreRows.push({ d: s.submitted_at, pct: Math.max(0, Math.min(100, pct)) });
  }

  const subjectNameById = new Map(subjects.map((s) => [s.id, subjectName(s.translations)]));
  const batchSubjectById = new Map(batches.map((b) => [b.id, b.subject_id]));
  const inClass = enrollments.filter((e) => e.status === "joined" || e.status === "accepted");
  const studentsBySubject = new Map<string, number>();
  for (const e of inClass) {
    const subjectId = e.batch_id ? batchSubjectById.get(e.batch_id) : null;
    const name = subjectId ? subjectNameById.get(subjectId) : null;
    if (!name) continue;
    studentsBySubject.set(name, (studentsBySubject.get(name) ?? 0) + 1);
  }
  const questionsBySubject = new Map<string, number>();
  for (const q of questions) {
    const name = q.subject_id ? (subjectNameById.get(q.subject_id) ?? "—") : null;
    const key = name ?? "Untagged";
    questionsBySubject.set(key, (questionsBySubject.get(key) ?? 0) + 1);
  }

  // ----------------------------------------------------------- approvals
  const decisions = auditRows.filter((r) => r.action === "listing_approval_decision");
  const submittedAtById = new Map<string, string>([
    ...teacherProfiles.map((t) => [t.id, t.created_at] as [string, string]),
    ...classProfiles.map((c) => [c.id, c.created_at] as [string, string]),
  ]);
  const decisionDays = decisions
    .map((r) => {
      const submitted = r.target_id ? submittedAtById.get(r.target_id) : undefined;
      return submitted ? (new Date(r.created_at).getTime() - new Date(submitted).getTime()) / DAY_MS : null;
    })
    .filter((d): d is number => d !== null && d >= 0);
  const listingStatuses = [...teacherProfiles, ...classProfiles].map((p) => p.status);

  const moderationRows = auditRows
    .map((r) => {
      let group = MODERATION_GROUP[r.action];
      const meta = (r.metadata as Record<string, unknown> | null) ?? {};
      if (r.action === "user_suspension_change" && meta.suspended !== true) group = "";
      if (r.action === "listing_approval_decision") group = meta.decision === "rejected" ? "rejected" : "approved";
      return { created_at: r.created_at, group };
    })
    .filter((r) => r.group);

  return {
    todayKey,
    totals: {
      users: platformProfiles.length,
      students: activity.find((a) => a.role === "student")?.total ?? 0,
      teachers: activity.find((a) => a.role === "teacher")?.total ?? 0,
      lecturers: activity.find((a) => a.role === "campus_lecturer")?.total ?? 0,
      institutes: activity.find((a) => a.role === "institute")?.total ?? 0,
      batches: totalsBatches,
      studentsInClasses: inClass.length,
      notes: totalsNotes,
      exams: totalsExams,
      questions: totalsQuestions,
      assignments: totalsAssignments,
      liveClasses: totalsLive,
      reviews: totalsReviews,
      activeAds: adRows.filter((a) => a.status === "active").length,
      adViewsTotal: adRows.reduce((sum, a) => sum + (a.view_count ?? 0), 0),
      openWantedAds: openWantedAds,
    },
    activity,
    activeToday: platformProfiles.filter((p) => {
      const at = lastSignInById.get(p.id);
      return Boolean(at && dayKey(at) === todayKey);
    }).length,
    active7: platformProfiles.filter((p) => signedInWithin(p.id, 7)).length,
    active30: platformProfiles.filter((p) => signedInWithin(p.id, 30)).length,
    locations: [...locationCounts.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, 10)
      .map((l) => ({ k: l.label, n: l.n })),
    daily: {
      signups: bucket(platformProfiles, (p) => p.created_at, (p) => ROLE_BY_DB[p.role]),
      earnings: bucket(completed, paidDate, (p) => p.purpose, (p) => Number(p.amount) || 0),
      payments: bucket(payments, (p) => p.created_at, (p) => p.status),
      requests: bucket(
        enrollments.filter((e) => e.joined_at >= since),
        (e) => e.joined_at,
        (e) => e.status,
      ),
      feeJoins: bucket(
        enrollments.filter((e) => e.joined_at >= since && (e.platform_fee_paid || e.platform_fee_waived)),
        (e) => e.joined_at,
        (e) => (e.platform_fee_paid ? "paid" : "waived"),
      ),
      inquiries: bucket(inquiries, (r) => r.created_at, () => "all"),
      batches: bucket(
        batches.filter((b) => b.created_at >= since),
        (b) => b.created_at,
        (b) => b.owner_type,
      ),
      examsCreated: bucket(exams, (e) => e.created_at, () => "all"),
      examsTaken: bucket(submissions, (s) => s.submitted_at, (s) => s.status),
      liveClasses: bucket(liveClasses, (l) => l.scheduled_at, (l) => l.mode ?? "online"),
      attendance: bucket(attendance, (a) => a.marked_at, (a) => a.status),
      content: [
        ...bucket(notes, (r) => r.created_at, () => "note"),
        ...bucket(assignments, (r) => r.created_at, () => "assignment"),
        ...bucket(
          questions.filter((q) => q.created_at >= since),
          (q) => q.created_at,
          () => "question",
        ),
      ],
      reviews: bucket(reviews, (r) => r.created_at, (r) => String(r.rating)),
      wantedAds: [
        ...bucket(wantedAds, (r) => r.created_at, () => "posted"),
        ...bucket(wantedResponses, (r) => r.created_at, () => "answered"),
      ],
      feeCollections: bucket(feePayments, (f) => f.paid_at, () => "all", (f) => Number(f.amount) || 0),
      moderation: bucket(moderationRows, (r) => r.created_at, (r) => r.group),
      earnersByOwner: bucket(completed, paidDate, ownerKeyForPayment, (p) => Number(p.amount) || 0),
      examScores: scoreRows.map((r) => ({ d: dayKey(r.d), k: "score", n: Math.round(r.pct) })),
    },
    ownerNames,
    subjects: [...studentsBySubject.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k, n]) => ({ k, n })),
    questionsBySubject: [...questionsBySubject.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k, n]) => ({ k, n })),
    approvalStats: {
      pending: listingStatuses.filter((s) => s === "pending").length,
      approved: listingStatuses.filter((s) => s === "approved").length,
      rejected: listingStatuses.filter((s) => s === "rejected").length,
      avgDecisionDays: decisionDays.length
        ? Math.round((decisionDays.reduce((a, b) => a + b, 0) / decisionDays.length) * 10) / 10
        : null,
    },
  };
}
