import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { NotificationRow } from "@/components/dashboard/notification-bell";
import {
  OverviewTab,
  type RecentActivityItem,
  type PendingTeacherApproval,
  type PendingStudentApproval,
} from "@/components/dashboard/institute/overview-tab";
import { TeachersTab, type InstituteTeacherRow, type TeacherSeekingAdBrowseRow } from "@/components/dashboard/institute/teachers-tab";
import { BatchesTab } from "@/components/dashboard/institute/batches-tab";
import { StudentsTab, type InstituteStudentRow, type InstituteJoinRequestRow } from "@/components/dashboard/institute/students-tab";
import { AdvertisementTab, type InstituteAdBatchRow } from "@/components/dashboard/institute/advertisement-tab";
import type { AdHistoryRow } from "@/components/dashboard/ad-history-list";
import { ReviewsTab } from "@/components/dashboard/institute/reviews-tab";
import { ProfileTab } from "@/components/dashboard/institute/profile-tab";
import { SettingsTab } from "@/components/dashboard/institute/settings-tab";
import { InquiriesTab, type InquiryRow, type InquiryMessageRow } from "@/components/dashboard/inquiries-tab";
import { WantedAdsBrowseTab, type WantedAdBrowseRow } from "@/components/dashboard/wanted-ads-browse-tab";
import { AnalyticsTab } from "@/components/dashboard/teacher/analytics-tab";
import type {
  AnalyticsExamResultRow,
  AnalyticsAttendanceRow,
  AnalyticsBatchOption,
} from "@/components/dashboard/teacher/analytics-tab";
import { CalendarTab, type InstituteCalendarSession } from "@/components/dashboard/institute/calendar-tab";
import { AnnouncementsTab, type InstituteAnnouncementRow } from "@/components/dashboard/institute/announcements-tab";
import {
  FinanceTab,
  type FeeChargeRow,
  type FeePaymentRow,
  type FeeBalanceRow,
  type FeePlanTemplate,
} from "@/components/dashboard/institute/finance-tab";
import {
  AttendanceTab,
  type InstituteAttendanceSession,
  type BatchAttendanceSummary,
} from "@/components/dashboard/institute/attendance-tab";
import { TimetableTab } from "@/components/dashboard/institute/timetable-tab";
import { ParentPortalTab, type ParentPortalStudentRow } from "@/components/dashboard/institute/parent-portal-tab";
import { LibraryTab, type LibraryResourceRow } from "@/components/dashboard/institute/library-tab";
import {
  ExtracurricularsTab,
  type ExtracurricularActivityRow,
  type ExtracurricularStudentOption,
} from "@/components/dashboard/institute/extracurriculars-tab";
import { ExamsLmsTab, type ExamOversightRow } from "@/components/dashboard/institute/exams-lms-tab";
import type { WeeklyTimetableSlot } from "@/components/dashboard/weekly-timetable";
import { ClassProfileView } from "@/components/features/class-profile-view";
import { InstituteOnboardingWizard } from "@/components/onboarding/institute-onboarding-wizard";
import { loadClassProfile } from "@/lib/load-class-profile";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRichTextNullable } from "@/lib/dashboard/sanitize-rich-text";
import { createDateFormatter } from "@/lib/format-date";
import type { TeachersAtGlance } from "@/types/dashboard-institute";
import type { InstituteBatchRow, InstituteBatchRosterEntry } from "@/components/dashboard/institute/batches-tab";
import type { ScheduleSlotDraft } from "@/components/dashboard/schedule-slot-editor";
import type { ReferralRow } from "@/components/dashboard/refer-earn-panel";

export default async function InstituteDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("instituteDashboard");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // proxy.ts already gates this route behind an authenticated session.
  const userId = user!.id;

  const [
    { data: profile },
    { data: classProfile },
    { data: referralCodeValue },
    { data: myReferralRows },
    { data: notificationRows },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, notification_prefs, role, profile_completed_at").eq("id", userId).single(),
    supabase.from("class_profiles").select("*").eq("owner_id", userId).maybeSingle(),
    // Refer & Earn panel (Settings tab) — lazily assigns a code the first
    // time it's asked for (referrals, 0089), nothing to backfill up front.
    supabase.rpc("ensure_referral_code"),
    supabase.rpc("list_my_referrals"),
    supabase.rpc("list_my_notifications"),
  ]);

  const notifications: NotificationRow[] = (notificationRows ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    data: (n.data as Record<string, unknown>) ?? {},
    tab: n.tab,
    readAt: n.read_at,
    createdAt: n.created_at,
  }));

  // Onboarding gate (0107) — checked before any of the heavier
  // batches/teachers/reviews queries further down run, so an incomplete
  // profile never fetches (let alone renders) real dashboard data. Both
  // `profile` and `classProfile` were already fetched above for other
  // reasons, so this needs no extra query.
  if (profile && !profile.profile_completed_at && profile.role !== "admin") {
    return (
      <InstituteOnboardingWizard
        initial={{
          name: classProfile?.name ?? "",
          location: classProfile?.location ?? "",
          description: classProfile?.description ?? "",
          established: classProfile?.established ?? "",
          phone: profile.phone ?? "",
          hourlyRate: "",
          monthlyRate: "",
        }}
      />
    );
  }

  const fullName = profile?.full_name ?? user!.email ?? "Institute";
  const userInitial = fullName.charAt(0).toUpperCase();
  const instituteId = classProfile?.id;

  // Fired now, awaited later (right before it's needed for the Settings
  // tab's "view live" preview) so it runs concurrently with everything else
  // below rather than adding a sequential round trip. loadClassProfile is
  // the exact same function the public /class/[id] page calls — reusing it
  // rather than reshaping data already fetched below guarantees the
  // preview can never drift from what's actually public (see its own
  // comment), at the cost of one small redundant class_profiles read.
  const liveClassProfilePromise = instituteId ? loadClassProfile(instituteId, locale) : Promise.resolve(null);

  // Every query below only needs instituteId (or nothing at all), not each
  // other's results — including the two that used to be their own separate
  // awaits further down (list_public_reviews, batches/batchEnrollmentRows)
  // — so they all run as one batch instead of a chain of sequential round
  // trips. Only the teacher-related queries below this genuinely have to
  // wait, since they need teacherIds out of classTeacherRows first.
  const [
    { data: classTeacherRows },
    { data: instituteEnrollmentRows },
    { data: reviewRows },
    { data: priceRow },
    { data: adRows },
    { data: inquiryRows },
    { data: wantedAdRows },
    { data: myReviewRows },
    { data: batchRows },
    { data: scheduleSlotRows },
    { data: classAdRows },
    { data: feeChargeRows },
    { data: feePaymentRows },
    { data: feePlanTemplateRows },
    { data: guardianRows },
    { data: libraryResourceRows },
    { data: extracurricularActivityRows },
    { data: extracurricularParticipantRows },
    { data: teacherSeekingAdRows },
  ] = await Promise.all([
    instituteId
      ? supabase.from("class_teachers").select("teacher_id, is_visible, status, requested_by").eq("class_id", instituteId)
      : Promise.resolve({
          data: [] as {
            teacher_id: string;
            is_visible: boolean;
            status: "pending" | "accepted" | "declined";
            requested_by: "institute" | "teacher";
          }[],
        }),
    // One richer fetch backs studentsCount, batchStudentCounts, AND the new
    // Students tab (roster + pending requests, step 4b) — used to be two
    // separate narrower queries (student_id only, batch_id only) before
    // that tab existed.
    instituteId
      ? supabase
          .from("enrollments")
          .select("id, student_id, batch_id, status, joined_at")
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
      : Promise.resolve({
          data: [] as { id: string; student_id: string; batch_id: string | null; status: "pending" | "accepted" | "declined"; joined_at: string }[],
        }),
    instituteId
      ? supabase.from("reviews").select("rating").eq("target_type", "class").eq("target_id", instituteId)
      : Promise.resolve({ data: [] as { rating: number }[] }),
    instituteId
      ? supabase
          .from("prices")
          .select("hourly_rate, monthly_rate")
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Multiple institute-wide promotions (0104) — was .maybeSingle() when
    // an institute could only ever have one.
    instituteId
      ? supabase
          .from("advertisements")
          .select("id, content, status, created_at")
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
          .eq("placement", "own_profile")
          .order("created_at", { ascending: false })
      : Promise.resolve({
          data: [] as { id: string; content: string; status: "active" | "expired" | "removed" | "deleted"; created_at: string }[],
        }),
    instituteId
      ? supabase
          .from("inquiries")
          .select("id, sender_name, sender_contact, message, status, created_at")
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
          .order("created_at", { ascending: false })
      : Promise.resolve({
          data: [] as {
            id: string;
            sender_name: string;
            sender_contact: string;
            message: string;
            status: "new" | "read";
            created_at: string;
          }[],
        }),
    supabase.rpc("list_wanted_ads_for_responder"),
    // Same RPC the public /class/[id] page uses — masked reviewer names,
    // consistent with what this institute's own public profile shows.
    instituteId
      ? supabase.rpc("list_public_reviews", { p_target_type: "class", p_target_id: instituteId })
      : Promise.resolve({
          data: [] as { id: string; author: string | null; rating: number; body: string | null; reply: string | null; created_at: string }[],
        }),
    instituteId
      ? supabase
          .from("batches")
          .select(
            "id, title, mode, location, schedule_note, teacher_label, taught_by_teacher_id, subject_id, grade_band, hourly_rate, monthly_rate, is_open_enrollment, capacity, join_code",
          )
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
          .order("created_at", { ascending: false })
      : Promise.resolve({
          data: [] as {
            id: string;
            title: string;
            mode: "online" | "physical" | "travels_to_student";
            location: string | null;
            schedule_note: string | null;
            teacher_label: string | null;
            taught_by_teacher_id: string | null;
            subject_id: string | null;
            grade_band: string | null;
            hourly_rate: number | null;
            monthly_rate: number | null;
            is_open_enrollment: boolean;
            capacity: number | null;
            join_code: string | null;
          }[],
        }),
    instituteId
      ? supabase
          .from("batch_schedule_slots")
          .select("batch_id, day_of_week, start_time, end_time")
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
      : Promise.resolve({
          data: [] as { batch_id: string; day_of_week: number; start_time: string; end_time: string }[],
        }),
    // Class-wise ads (0103) — one row per batch that already has a
    // search_results ad; batches with none just render "no ad yet" below.
    instituteId
      ? supabase
          .from("advertisements")
          .select("id, batch_id, title, content, status, created_at, view_count")
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
          .eq("placement", "search_results")
      : Promise.resolve({
          data: [] as {
            id: string;
            batch_id: string | null;
            title: string;
            content: string | null;
            status: "active" | "expired" | "removed" | "deleted";
            created_at: string;
            view_count: number;
          }[],
        }),
    instituteId
      ? supabase
          .from("fee_charges")
          .select("id, student_id, batch_id, description, amount, charged_at")
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
          .order("charged_at", { ascending: false })
      : Promise.resolve({
          data: [] as { id: string; student_id: string; batch_id: string | null; description: string; amount: number; charged_at: string }[],
        }),
    instituteId
      ? supabase
          .from("fee_payments")
          .select("id, student_id, charge_id, amount, method, note, paid_at")
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
          .order("paid_at", { ascending: false })
      : Promise.resolve({
          data: [] as {
            id: string;
            student_id: string;
            charge_id: string | null;
            amount: number;
            method: "cash" | "bank_transfer" | "card" | "other";
            note: string | null;
            paid_at: string;
          }[],
        }),
    instituteId
      ? supabase
          .from("fee_plan_templates")
          .select("id, name, description, amount")
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
          .order("created_at", { ascending: true })
      : Promise.resolve({
          data: [] as { id: string; name: string; description: string | null; amount: number }[],
        }),
    instituteId
      ? supabase
          .from("student_guardians")
          .select("student_id, guardian_name, guardian_phone, guardian_email, note")
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
      : Promise.resolve({
          data: [] as { student_id: string; guardian_name: string | null; guardian_phone: string | null; guardian_email: string | null; note: string | null }[],
        }),
    instituteId
      ? supabase
          .from("library_resources")
          .select("id, title, description, category, file_path, view_count")
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
          .order("created_at", { ascending: false })
      : Promise.resolve({
          data: [] as { id: string; title: string; description: string | null; category: string | null; file_path: string; view_count: number }[],
        }),
    instituteId
      ? supabase
          .from("extracurricular_activities")
          .select("id, name, description, schedule_note")
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; name: string; description: string | null; schedule_note: string | null }[] }),
    instituteId
      ? supabase
          .from("extracurricular_participants")
          .select("id, activity_id, student_id, certificate_issued")
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
      : Promise.resolve({ data: [] as { id: string; activity_id: string; student_id: string; certificate_issued: boolean }[] }),
    // Institute-Seeking Ad (Gehan's mockup, section 2.2) — doesn't depend on
    // instituteId (it reads auth.uid() internally, same as
    // list_wanted_ads_for_responder above), so it's called unconditionally.
    supabase.rpc("list_teacher_seeking_ads_for_institutes"),
  ]);

  const batchSubjectIds = [...new Set((batchRows ?? []).map((b) => b.subject_id).filter((id): id is string => !!id))];
  const { data: batchSubjectRows } = batchSubjectIds.length
    ? await supabase.from("subjects").select("id, translations").in("id", batchSubjectIds)
    : { data: [] as { id: string; translations: Record<string, string> | null }[] };
  const subjectNameById = new Map(
    (batchSubjectRows ?? []).map((s) => [s.id, (s.translations as Record<string, string> | null)?.en ?? null]),
  );

  // Institute Blueprint step 6 — Analytics tab. Mirrors the teacher
  // dashboard's own analytics query (teacher/page.tsx) exactly, just scoped
  // to owner_type='class' instead of 'teacher': content created against an
  // institute batch is already server-derived to owner_id=instituteId
  // (resolveBatchOwner, step 3), so this rolls up every linked teacher's
  // exams/attendance for free — no per-teacher join needed.
  const [{ data: instituteExamRows }, { data: instituteQuestionMarkRows }, { data: instituteLiveClassRows }, { data: announcementRows }] =
    await Promise.all([
    instituteId
      ? supabase.from("exams").select("id, title, question_ids, scheduled_at, batch_id").eq("owner_type", "class").eq("owner_id", instituteId)
      : Promise.resolve({ data: [] as { id: string; title: string; question_ids: string[]; scheduled_at: string | null; batch_id: string | null }[] }),
    instituteId
      ? supabase.from("question_bank_items").select("id, marks").eq("owner_type", "class").eq("owner_id", instituteId)
      : Promise.resolve({ data: [] as { id: string; marks: number }[] }),
    instituteId
      ? supabase
          .from("live_classes")
          .select("id, title, batch_id, scheduled_at, duration_minutes, mode, location")
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
          .neq("status", "cancelled")
      : Promise.resolve({
          data: [] as {
            id: string;
            title: string;
            batch_id: string | null;
            scheduled_at: string;
            duration_minutes: number;
            mode: "online" | "physical";
            location: string | null;
          }[],
        }),
    // Institute Blueprint step 6 — announcements.
    instituteId
      ? supabase
          .from("announcements")
          .select("id, title, body, created_at")
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; title: string; body: string; created_at: string }[] }),
  ]);

  const instituteExamIds = (instituteExamRows ?? []).map((e) => e.id);
  const instituteLiveClassIds = (instituteLiveClassRows ?? []).map((c) => c.id);

  const [{ data: instituteSubmissionRows }, { data: instituteAttendanceRows }] = await Promise.all([
    instituteExamIds.length
      ? supabase.from("exam_submissions").select("id, exam_id, student_id, status, grade").in("exam_id", instituteExamIds)
      : Promise.resolve({
          data: [] as { id: string; exam_id: string; student_id: string; status: "pending" | "graded"; grade: number | null }[],
        }),
    instituteLiveClassIds.length
      ? supabase.from("attendance_records").select("live_class_id, student_id, status").in("live_class_id", instituteLiveClassIds)
      : Promise.resolve({ data: [] as { live_class_id: string; student_id: string; status: "present" | "absent" | "late" }[] }),
  ]);

  const instituteAnalyticsStudentIds = [
    ...new Set([
      ...(instituteSubmissionRows ?? []).map((s) => s.student_id),
      ...(instituteAttendanceRows ?? []).map((a) => a.student_id),
    ]),
  ];
  const { data: instituteAnalyticsStudentRows } = instituteAnalyticsStudentIds.length
    ? await supabase.rpc("get_roster_student_info", { p_student_ids: instituteAnalyticsStudentIds })
    : { data: [] as { id: string; full_name: string; phone: string | null }[] };

  const analyticsStudentById = new Map((instituteAnalyticsStudentRows ?? []).map((p) => [p.id, p]));
  const analyticsMarksByQuestionId = new Map((instituteQuestionMarkRows ?? []).map((q) => [q.id, q.marks]));
  const analyticsMaxMarksByExamId = new Map(
    (instituteExamRows ?? []).map((e) => [e.id, e.question_ids.reduce((sum, qid) => sum + (analyticsMarksByQuestionId.get(qid) ?? 0), 0)]),
  );
  const analyticsExamById = new Map((instituteExamRows ?? []).map((e) => [e.id, e]));

  const analyticsExamResults: AnalyticsExamResultRow[] = (instituteSubmissionRows ?? []).map((s) => {
    const exam = analyticsExamById.get(s.exam_id);
    const maxMarks = analyticsMaxMarksByExamId.get(s.exam_id) ?? 0;
    const scorePercent =
      s.status === "graded" && s.grade !== null && maxMarks > 0
        ? Math.max(0, Math.min(100, Math.round((s.grade / maxMarks) * 100)))
        : null;
    return {
      examId: s.exam_id,
      examTitle: exam?.title ?? "—",
      examDateIso: exam?.scheduled_at ?? null,
      batchId: exam?.batch_id ?? null,
      studentId: s.student_id,
      studentName: analyticsStudentById.get(s.student_id)?.full_name ?? "—",
      status: s.status,
      scorePercent,
    };
  });

  const analyticsLiveClassById = new Map((instituteLiveClassRows ?? []).map((c) => [c.id, c]));
  const analyticsAttendance: AnalyticsAttendanceRow[] = (instituteAttendanceRows ?? []).flatMap((a) => {
    const liveClass = analyticsLiveClassById.get(a.live_class_id);
    if (!liveClass) return [];
    return [
      {
        batchId: liveClass.batch_id,
        dateIso: liveClass.scheduled_at,
        studentId: a.student_id,
        studentName: analyticsStudentById.get(a.student_id)?.full_name ?? "—",
        status: a.status,
      },
    ];
  });

  const teacherIds = (classTeacherRows ?? []).map((row) => row.teacher_id);
  const acceptedTeacherIds = (classTeacherRows ?? [])
    .filter((row) => row.status === "accepted")
    .map((row) => row.teacher_id);

  const isVisibleById = new Map((classTeacherRows ?? []).map((row) => [row.teacher_id, row.is_visible]));
  const rosterStatusById = new Map((classTeacherRows ?? []).map((row) => [row.teacher_id, row.status]));
  const requestedByById = new Map((classTeacherRows ?? []).map((row) => [row.teacher_id, row.requested_by]));
  const acceptedInstituteEnrollments = (instituteEnrollmentRows ?? []).filter((row) => row.status === "accepted");
  const pendingInstituteEnrollments = (instituteEnrollmentRows ?? []).filter((row) => row.status === "pending");
  const studentsCount = new Set(acceptedInstituteEnrollments.map((row) => row.student_id)).size;

  const inquiryIds = (inquiryRows ?? []).map((row) => row.id);
  const { data: inquiryMessageRows } = inquiryIds.length
    ? await supabase
        .from("inquiry_messages")
        .select("id, inquiry_id, sender_role, body, created_at")
        .in("inquiry_id", inquiryIds)
        .order("created_at", { ascending: true })
    : { data: [] as { id: string; inquiry_id: string; sender_role: "owner" | "inquirer"; body: string; created_at: string }[] };

  let teachersAtGlance: TeachersAtGlance[] = [];
  let instituteTeachers: InstituteTeacherRow[] = [];
  // Hoisted out of the block below so the batches mapping further down can
  // resolve taught_by_teacher_id to a display name too.
  let teacherNameById = new Map<string, string>();
  if (teacherIds.length > 0) {
    const [
      { data: teacherProfiles },
      { data: teacherPersonProfiles },
      { data: teacherEnrollments },
      { data: teacherReviews },
      { data: teacherPrices },
    ] = await Promise.all([
      supabase.from("teacher_profiles").select("id, headline, academic_title, status").in("id", teacherIds),
      // Plain `profiles` select would return zero rows here — its only RLS
      // policy is "your own row or admin" (0003). This RPC (0032, widened
      // by 0100 to also flag is_campus_lecturer) opens it up specifically
      // for teachers linked to this institute.
      supabase.rpc("get_linked_teacher_names", { p_class_id: instituteId!, p_teacher_ids: teacherIds }),
      supabase.from("enrollments").select("owner_id").eq("owner_type", "teacher").in("owner_id", teacherIds),
      supabase.from("reviews").select("target_id, rating").eq("target_type", "teacher").in("target_id", teacherIds),
      supabase.from("prices").select("owner_id, hourly_rate, monthly_rate").eq("owner_type", "teacher").in("owner_id", teacherIds),
    ]);

    const nameById = new Map((teacherPersonProfiles ?? []).map((p) => [p.id, p.full_name]));
    teacherNameById = nameById;
    const isCampusLecturerById = new Map((teacherPersonProfiles ?? []).map((p) => [p.id, p.is_campus_lecturer]));
    const headlineById = new Map((teacherProfiles ?? []).map((p) => [p.id, p.headline]));
    const academicTitleById = new Map((teacherProfiles ?? []).map((p) => [p.id, p.academic_title]));
    const statusById = new Map((teacherProfiles ?? []).map((p) => [p.id, p.status]));
    const priceById = new Map((teacherPrices ?? []).map((p) => [p.owner_id, p]));

    const enrollmentCountById = new Map<string, number>();
    for (const row of teacherEnrollments ?? []) {
      enrollmentCountById.set(row.owner_id, (enrollmentCountById.get(row.owner_id) ?? 0) + 1);
    }

    const ratingsById = new Map<string, number[]>();
    for (const row of teacherReviews ?? []) {
      const list = ratingsById.get(row.target_id) ?? [];
      list.push(row.rating);
      ratingsById.set(row.target_id, list);
    }

    // A pending invite isn't "your teacher" yet, so the overview snapshot
    // only counts accepted links — the full roster below still lists both.
    teachersAtGlance = acceptedTeacherIds.map((teacherId) => {
      const ratings = ratingsById.get(teacherId) ?? [];
      const status = statusById.get(teacherId);
      return {
        name: nameById.get(teacherId) ?? "—",
        subject: headlineById.get(teacherId) ?? "",
        studentCount: enrollmentCountById.get(teacherId) ?? 0,
        rating: ratings.length ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)) : 0,
        status: status === "approved" ? "active" : "pending",
      };
    });

    instituteTeachers = teacherIds.map((teacherId) => {
      const price = priceById.get(teacherId);
      const rateDisplay =
        price?.hourly_rate != null
          ? `Rs. ${Number(price.hourly_rate).toLocaleString()}/hr`
          : price?.monthly_rate != null
            ? `Rs. ${Number(price.monthly_rate).toLocaleString()}/mo`
            : "—";
      return {
        rosterStatus: rosterStatusById.get(teacherId) ?? "accepted",
        requestedBy: requestedByById.get(teacherId) ?? "institute",
        id: teacherId,
        name: nameById.get(teacherId) ?? "—",
        subject: headlineById.get(teacherId) || academicTitleById.get(teacherId) || "",
        rateDisplay,
        studentCount: enrollmentCountById.get(teacherId) ?? 0,
        visible: isVisibleById.get(teacherId) ?? true,
        teacherHref: `/teacher/${teacherId}`,
        isCampusLecturer: isCampusLecturerById.get(teacherId) ?? false,
      };
    });
  }

  const averageRating = reviewRows?.length
    ? (reviewRows.reduce((sum, r) => sum + r.rating, 0) / reviewRows.length).toFixed(1)
    : null;

  const dateFormatter = createDateFormatter(locale);
  const announcements: InstituteAnnouncementRow[] = (announcementRows ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    createdLabel: dateFormatter.format(new Date(a.created_at)),
  }));
  const inquiryMessagesByInquiryId = new Map<string, InquiryMessageRow[]>();
  for (const row of inquiryMessageRows ?? []) {
    const list = inquiryMessagesByInquiryId.get(row.inquiry_id) ?? [];
    list.push({
      id: row.id,
      senderRole: row.sender_role,
      body: row.body,
      createdLabel: dateFormatter.format(new Date(row.created_at)),
    });
    inquiryMessagesByInquiryId.set(row.inquiry_id, list);
  }
  const inquiries: InquiryRow[] = (inquiryRows ?? []).map((row) => ({
    id: row.id,
    senderName: row.sender_name,
    senderContact: row.sender_contact,
    message: row.message,
    status: row.status,
    messages: inquiryMessagesByInquiryId.get(row.id) ?? [],
    createdLabel: dateFormatter.format(new Date(row.created_at)),
  }));
  const wantedAdRequests: WantedAdBrowseRow[] = (wantedAdRows ?? []).map((row) => ({
    id: row.id,
    lookingFor: row.looking_for as "teacher" | "institute",
    subject: row.subject,
    mode: row.mode as "online" | "physical" | "both" | null,
    gradeLevel: row.grade_level,
    medium: row.medium as "english" | "sinhala" | "tamil" | "other",
    classType: row.class_type as "new" | "revision",
    title: row.title,
    description: sanitizeRichTextNullable(row.description),
    budgetMin: row.budget_min,
    budgetMax: row.budget_max,
    createdLabel: dateFormatter.format(new Date(row.created_at)),
    myResponse: row.my_response,
    myResponseStatus: row.my_response_status as "new" | "read" | "accepted" | "declined" | null,
  }));
  const teacherSeekingAds: TeacherSeekingAdBrowseRow[] = (teacherSeekingAdRows ?? []).map((row) => ({
    id: row.id,
    teacherName: row.display_name,
    photoUrl: row.photo_url,
    subject: row.subject,
    gradeBand: row.grade_band,
    mode: row.mode as "online" | "physical" | "travels_to_student" | null,
    title: row.title,
    content: row.content,
    createdLabel: dateFormatter.format(new Date(row.created_at)),
    myResponse: row.my_response,
    myResponseStatus: row.my_response_status as "new" | "read" | "accepted" | "declined" | null,
  }));
  const reviews = (myReviewRows ?? []).map((r) => ({
    id: r.id,
    author: r.author ?? "Anonymous",
    date: dateFormatter.format(new Date(r.created_at)),
    rating: r.rating,
    body: r.body ?? "",
    reply: r.reply ?? undefined,
  }));

  const batchStudentCounts = new Map<string, number>();
  for (const row of acceptedInstituteEnrollments) {
    if (!row.batch_id) continue;
    batchStudentCounts.set(row.batch_id, (batchStudentCounts.get(row.batch_id) ?? 0) + 1);
  }
  // Delete is blocked while a live ad points at the batch (advertisements
  // cascade-deletes with it) — same guard the teacher dashboard already
  // uses, computed here from the same classAdRows the Advertisement tab
  // maps below, so there's no extra query for it.
  const activeAdBatchIds = new Set(
    (classAdRows ?? []).filter((ad) => ad.status === "active" && ad.batch_id).map((ad) => ad.batch_id as string),
  );
  const scheduleSlotsByBatchId = new Map<string, ScheduleSlotDraft[]>();
  for (const s of scheduleSlotRows ?? []) {
    const list = scheduleSlotsByBatchId.get(s.batch_id) ?? [];
    list.push({ dayOfWeek: s.day_of_week, startTime: s.start_time.slice(0, 5), endTime: s.end_time.slice(0, 5) });
    scheduleSlotsByBatchId.set(s.batch_id, list);
  }

  const batches: InstituteBatchRow[] = (batchRows ?? []).map((b) => ({
    id: b.id,
    title: b.title,
    mode: b.mode,
    location: b.location,
    scheduleNote: b.schedule_note,
    // Real roster link wins when set; falls back to the old free-text label
    // for batches created before 0091 that haven't been re-saved since.
    teacherLabel: (b.taught_by_teacher_id && teacherNameById.get(b.taught_by_teacher_id)) || b.teacher_label,
    teacherId: b.taught_by_teacher_id,
    subjectName: b.subject_id ? (subjectNameById.get(b.subject_id) ?? null) : null,
    gradeBand: b.grade_band as InstituteBatchRow["gradeBand"],
    studentCount: batchStudentCounts.get(b.id) ?? 0,
    hasActiveAd: activeAdBatchIds.has(b.id),
    isOpenEnrollment: b.is_open_enrollment,
    capacity: b.capacity,
    scheduleSlots: scheduleSlotsByBatchId.get(b.id) ?? [],
    joinCode: b.join_code,
  }));

  // Class-wise ads (0103, multiple per class since 0104) — mirrors the
  // teacher dashboard's Advertisement tab shape (TeacherAdBatchRow), minus
  // a subject picker: an institute batch's subject is already resolved at
  // creation (createBatch's resolve_subject step), so there's nothing to
  // set here.
  const classAdsByBatchId = new Map<
    string,
    { id: string; title: string; content: string | null; status: "active" | "expired" | "removed"; view_count: number }[]
  >();
  // Deleted (0109 soft-delete) ads are set aside here rather than filtered
  // out entirely — the Advertisement tab's "Ad history" section below still
  // needs to show and let the owner restore them.
  const deletedClassAdRows = (classAdRows ?? []).filter((ad) => ad.status === "deleted");
  for (const ad of classAdRows ?? []) {
    if (!ad.batch_id || ad.status === "deleted") continue;
    const list = classAdsByBatchId.get(ad.batch_id) ?? [];
    list.push({ id: ad.id, title: ad.title, content: ad.content, status: ad.status, view_count: ad.view_count });
    classAdsByBatchId.set(ad.batch_id, list);
  }
  const instituteAdBatches: InstituteAdBatchRow[] = (batchRows ?? []).map((b) => {
    const ads = classAdsByBatchId.get(b.id) ?? [];
    return {
      id: b.id,
      title: b.title,
      subjectName: b.subject_id ? (subjectNameById.get(b.subject_id) ?? null) : null,
      hourlyRate: b.hourly_rate,
      monthlyRate: b.monthly_rate,
      ads: ads.map((ad) => ({ id: ad.id, title: ad.title, content: ad.content ?? "", status: ad.status, viewCount: ad.view_count })),
    };
  });

  // Institute Blueprint step 6 — cross-class calendar. Reuses the same
  // live_classes rows the Analytics tab already fetched above (no new
  // query) — every linked teacher's sessions roll up here for free since
  // they're all owner_id=instituteId, same reasoning as the analytics
  // block's own comment.
  const batchById = new Map(batches.map((b) => [b.id, b]));
  const calendarSessions: InstituteCalendarSession[] = (instituteLiveClassRows ?? []).map((c) => {
    const batch = c.batch_id ? batchById.get(c.batch_id) : undefined;
    return {
      id: c.id,
      title: c.title,
      scheduledAtIso: c.scheduled_at,
      durationMinutes: c.duration_minutes,
      mode: c.mode,
      location: c.location,
      batchTitle: batch?.title ?? null,
      teacherName: batch?.teacherLabel ?? null,
    };
  });

  // Only an accepted roster teacher can be assigned to a class — a pending
  // invite hasn't agreed to anything yet.
  const rosterTeacherOptions = acceptedTeacherIds.map((id) => ({
    id,
    name: teacherNameById.get(id) ?? "—",
  }));

  // Institute Blueprint step 4b — Students tab (roster + pending join
  // requests). Plain `profiles` select would return zero rows under RLS
  // (0003, own-row-or-admin); get_roster_student_info (0032/0040) already
  // opens this up for an owner looking up their own enrolled students.
  const enrolledStudentIds = [...new Set((instituteEnrollmentRows ?? []).map((row) => row.student_id))];
  const { data: enrolledStudentRows } = enrolledStudentIds.length
    ? await supabase.rpc("get_roster_student_info", { p_student_ids: enrolledStudentIds })
    : { data: [] as { id: string; full_name: string; phone: string | null }[] };
  const studentInfoById = new Map((enrolledStudentRows ?? []).map((row) => [row.id, row]));
  const batchTitleById = new Map((batchRows ?? []).map((b) => [b.id, b.title]));
  const generalBatchLabel = t("students.noBatch");

  // Ad history (0109) — deleted class ads and promotions, shown read-only
  // with a Restore action; see deletedClassAdRows above.
  const instituteAdHistory: AdHistoryRow[] = deletedClassAdRows.map((ad) => ({
    id: ad.id,
    title: ad.title,
    content: ad.content ?? "",
    meta: ad.batch_id ? (batchTitleById.get(ad.batch_id) ?? undefined) : undefined,
  }));
  const institutePromotionHistory: AdHistoryRow[] = (adRows ?? [])
    .filter((row) => row.status === "deleted")
    .map((row) => ({ id: row.id, content: row.content ?? "" }));

  const instituteStudents: InstituteStudentRow[] = acceptedInstituteEnrollments.map((row) => ({
    id: row.id,
    name: studentInfoById.get(row.student_id)?.full_name ?? "—",
    phone: studentInfoById.get(row.student_id)?.phone ?? null,
    batch: row.batch_id ? (batchTitleById.get(row.batch_id) ?? "—") : generalBatchLabel,
    joinedAt: dateFormatter.format(new Date(row.joined_at)),
  }));
  const instituteJoinRequests: InstituteJoinRequestRow[] = pendingInstituteEnrollments.map((row) => ({
    id: row.id,
    studentName: studentInfoById.get(row.student_id)?.full_name ?? "—",
    batch: row.batch_id ? (batchTitleById.get(row.batch_id) ?? "—") : generalBatchLabel,
    batchId: row.batch_id,
    requestedAt: dateFormatter.format(new Date(row.joined_at)),
  }));

  // Classes & Batches tab's per-class roster (attendance % + average exam
  // marks alongside who's enrolled) — reuses analyticsAttendance/
  // analyticsExamResults computed above for the Analytics tab, narrowed to
  // one batch+student at a time instead of institute-wide, so this is zero
  // new queries. "present" only (not "late"), matching the Analytics tab's
  // own studentRows formula exactly (analytics-tab.tsx) so the two numbers
  // never disagree.
  const attendanceByBatchStudent = new Map<string, { present: number; total: number }>();
  for (const a of analyticsAttendance) {
    if (!a.batchId) continue;
    const key = `${a.batchId}:${a.studentId}`;
    const entry = attendanceByBatchStudent.get(key) ?? { present: 0, total: 0 };
    entry.total += 1;
    if (a.status === "present") entry.present += 1;
    attendanceByBatchStudent.set(key, entry);
  }
  const marksByBatchStudent = new Map<string, { sum: number; count: number }>();
  for (const r of analyticsExamResults) {
    if (!r.batchId || r.scorePercent === null) continue;
    const key = `${r.batchId}:${r.studentId}`;
    const entry = marksByBatchStudent.get(key) ?? { sum: 0, count: 0 };
    entry.sum += r.scorePercent;
    entry.count += 1;
    marksByBatchStudent.set(key, entry);
  }
  const instituteBatchRoster: Record<string, InstituteBatchRosterEntry[]> = {};
  for (const row of acceptedInstituteEnrollments) {
    if (!row.batch_id) continue;
    const key = `${row.batch_id}:${row.student_id}`;
    const att = attendanceByBatchStudent.get(key);
    const marks = marksByBatchStudent.get(key);
    const entry: InstituteBatchRosterEntry = {
      studentId: row.student_id,
      name: studentInfoById.get(row.student_id)?.full_name ?? "—",
      phone: studentInfoById.get(row.student_id)?.phone ?? null,
      joinedAt: dateFormatter.format(new Date(row.joined_at)),
      attendancePercent: att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null,
      avgMarks: marks && marks.count > 0 ? Math.round(marks.sum / marks.count) : null,
    };
    (instituteBatchRoster[row.batch_id] ??= []).push(entry);
  }

  // Institute-level Attendance tab — no new table, reuses attendance_records
  // (already fetched as instituteAttendanceRows for Analytics) at
  // live-class-session granularity for the editor, plus analyticsAttendance
  // re-aggregated by batch for the trend/low-attendance summary.
  const instituteAttendanceByKey = new Map((instituteAttendanceRows ?? []).map((a) => [`${a.live_class_id}:${a.student_id}`, a.status]));
  const instituteAttendanceSessions: InstituteAttendanceSession[] = (instituteLiveClassRows ?? []).map((c) => {
    const pool = c.batch_id ? acceptedInstituteEnrollments.filter((e) => e.batch_id === c.batch_id) : acceptedInstituteEnrollments;
    return {
      id: c.id,
      title: c.title,
      batchLabel: c.batch_id ? (batchTitleById.get(c.batch_id) ?? null) : null,
      dateLabel: dateFormatter.format(new Date(c.scheduled_at)),
      rows: pool.map((e) => ({
        studentId: e.student_id,
        studentName: studentInfoById.get(e.student_id)?.full_name ?? "—",
        status: instituteAttendanceByKey.get(`${c.id}:${e.student_id}`) ?? null,
      })),
    };
  });
  const batchAttendanceAgg = new Map<string, { present: number; total: number }>();
  for (const a of analyticsAttendance) {
    if (!a.batchId) continue;
    const entry = batchAttendanceAgg.get(a.batchId) ?? { present: 0, total: 0 };
    entry.total += 1;
    if (a.status === "present") entry.present += 1;
    batchAttendanceAgg.set(a.batchId, entry);
  }
  const batchAttendanceSummaries: BatchAttendanceSummary[] = batches
    .map((b) => {
      const agg = batchAttendanceAgg.get(b.id);
      return {
        batchId: b.id,
        batchTitle: b.title,
        presentPercent: agg && agg.total > 0 ? Math.round((agg.present / agg.total) * 100) : null,
        recordCount: agg?.total ?? 0,
      };
    })
    .filter((s) => s.recordCount > 0);

  // Timetable (School LMS) — flattens every batch's already-fetched
  // recurring schedule slots into one institute-wide weekly grid, reusing
  // the same WeeklyTimetable component the teacher dashboard's Classes tab
  // uses. No new query.
  const timetableSlots: WeeklyTimetableSlot[] = batches.flatMap((b) =>
    b.scheduleSlots.map((s) => ({ batchTitle: b.title, dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime })),
  );

  // Exams oversight (School LMS) — read-only rollup of exams teachers
  // already create, reusing analyticsExamResults computed above for the
  // Analytics tab. No authoring UI here; institute staff review, they don't
  // create exams themselves.
  const examResultsByExamId = new Map<string, typeof analyticsExamResults>();
  for (const r of analyticsExamResults) {
    const list = examResultsByExamId.get(r.examId) ?? [];
    list.push(r);
    examResultsByExamId.set(r.examId, list);
  }
  const examOversightRows: ExamOversightRow[] = (instituteExamRows ?? []).map((e) => {
    const results = examResultsByExamId.get(e.id) ?? [];
    const graded = results.filter((r) => r.status === "graded" && r.scorePercent !== null);
    const avgScorePercent = graded.length
      ? Math.round(graded.reduce((sum, r) => sum + (r.scorePercent ?? 0), 0) / graded.length)
      : null;
    return {
      id: e.id,
      title: e.title,
      batchTitle: e.batch_id ? (batchTitleById.get(e.batch_id) ?? null) : null,
      dateLabel: e.scheduled_at ? dateFormatter.format(new Date(e.scheduled_at)) : null,
      submissionCount: results.length,
      gradedCount: graded.length,
      avgScorePercent,
    };
  });

  // Finance tab — internal fee tracking, no payment gateway (0127).
  const feeCharges: FeeChargeRow[] = (feeChargeRows ?? []).map((c) => ({
    id: c.id,
    studentId: c.student_id,
    studentName: studentInfoById.get(c.student_id)?.full_name ?? "—",
    batchLabel: c.batch_id ? (batchTitleById.get(c.batch_id) ?? null) : null,
    description: c.description,
    amount: Number(c.amount),
    chargedAtLabel: dateFormatter.format(new Date(c.charged_at)),
  }));
  const feePayments: FeePaymentRow[] = (feePaymentRows ?? []).map((p) => ({
    id: p.id,
    studentId: p.student_id,
    studentName: studentInfoById.get(p.student_id)?.full_name ?? "—",
    amount: Number(p.amount),
    method: p.method,
    paidAtLabel: dateFormatter.format(new Date(p.paid_at)),
    note: p.note,
  }));
  const feePlanTemplates: FeePlanTemplate[] = (feePlanTemplateRows ?? []).map((tpl) => ({
    id: tpl.id,
    name: tpl.name,
    description: tpl.description,
    amount: Number(tpl.amount),
  }));
  const totalCharged = feeCharges.reduce((sum, c) => sum + c.amount, 0);
  const totalCollected = feePayments.reduce((sum, p) => sum + p.amount, 0);
  const outstandingTotal = totalCharged - totalCollected;
  const financeNow = new Date();
  const thisMonthCollected = (feePaymentRows ?? [])
    .filter((p) => {
      const d = new Date(p.paid_at);
      return d.getFullYear() === financeNow.getFullYear() && d.getMonth() === financeNow.getMonth();
    })
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const feeBalanceMap = new Map<string, { totalCharged: number; totalPaid: number }>();
  for (const c of feeCharges) {
    const entry = feeBalanceMap.get(c.studentId) ?? { totalCharged: 0, totalPaid: 0 };
    entry.totalCharged += c.amount;
    feeBalanceMap.set(c.studentId, entry);
  }
  for (const p of feePayments) {
    const entry = feeBalanceMap.get(p.studentId) ?? { totalCharged: 0, totalPaid: 0 };
    entry.totalPaid += p.amount;
    feeBalanceMap.set(p.studentId, entry);
  }
  const financeStudentOptions = [...new Set(acceptedInstituteEnrollments.map((e) => e.student_id))].map((id) => ({
    id,
    name: studentInfoById.get(id)?.full_name ?? "—",
  }));
  const feeBalances: FeeBalanceRow[] = [...feeBalanceMap.entries()]
    .map(([studentId, v]) => ({
      studentId,
      studentName: studentInfoById.get(studentId)?.full_name ?? "—",
      totalCharged: v.totalCharged,
      totalPaid: v.totalPaid,
      balance: v.totalCharged - v.totalPaid,
    }))
    .sort((a, b) => b.balance - a.balance);

  // Parent Portal — staff-facing guardian contact directory (0128), one
  // row per enrolled student. Institute-internal only, no parent login.
  const guardianByStudentId = new Map((guardianRows ?? []).map((g) => [g.student_id, g]));
  const parentPortalRows: ParentPortalStudentRow[] = financeStudentOptions.map(({ id, name }) => {
    const g = guardianByStudentId.get(id);
    return {
      studentId: id,
      studentName: name,
      guardianName: g?.guardian_name ?? "",
      guardianPhone: g?.guardian_phone ?? "",
      guardianEmail: g?.guardian_email ?? "",
      note: g?.note ?? "",
    };
  });

  // Library — digital resource library (0129), public bucket so a direct
  // URL is fine (unlike notes' signed-URL serving path).
  const libraryResources: LibraryResourceRow[] = (libraryResourceRows ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    fileUrl: supabase.storage.from("library").getPublicUrl(r.file_path).data.publicUrl,
    filePath: r.file_path,
    viewCount: r.view_count,
  }));

  // Extracurriculars (0130) — activities + roster, institute-managed.
  const participantsByActivityId = new Map<string, NonNullable<typeof extracurricularParticipantRows>>();
  for (const p of extracurricularParticipantRows ?? []) {
    const list = participantsByActivityId.get(p.activity_id) ?? [];
    list.push(p);
    participantsByActivityId.set(p.activity_id, list);
  }
  const extracurricularActivities: ExtracurricularActivityRow[] = (extracurricularActivityRows ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    scheduleNote: a.schedule_note,
    participants: (participantsByActivityId.get(a.id) ?? []).map((p) => ({
      id: p.id,
      studentId: p.student_id,
      studentName: studentInfoById.get(p.student_id)?.full_name ?? "—",
      certificateIssued: p.certificate_issued,
    })),
  }));
  const extracurricularStudentOptions: ExtracurricularStudentOption[] = financeStudentOptions;

  const referrals: ReferralRow[] = (myReferralRows ?? []).map((row) => ({
    id: row.id,
    name: row.referred_name,
    status: row.reward_status,
    dateLabel: dateFormatter.format(new Date(row.created_at)),
  }));

  const liveClassProfile = await liveClassProfilePromise;
  const liveView = liveClassProfile ? <ClassProfileView classProfile={liveClassProfile} showGate={false} isOwnerView /> : null;

  // Overview tab's "Recent activity" feed — no dedicated event-log table
  // exists, so this unions the 3 most naturally chronological things
  // already fetched above (new ads, newly-accepted enrollments, new
  // reviews) by their real timestamps rather than adding one.
  const recentActivity: RecentActivityItem[] = [
    ...(classAdRows ?? []).map((ad) => ({ id: `ad-${ad.id}`, type: "ad" as const, title: ad.title, dateIso: ad.created_at })),
    ...acceptedInstituteEnrollments.map((row) => ({
      id: `enroll-${row.id}`,
      type: "enrollment" as const,
      studentName: studentInfoById.get(row.student_id)?.full_name ?? "—",
      batchLabel: row.batch_id ? (batchTitleById.get(row.batch_id) ?? "—") : generalBatchLabel,
      dateIso: row.joined_at,
    })),
    ...(myReviewRows ?? []).map((r) => ({ id: `review-${r.id}`, type: "review" as const, author: r.author ?? "Anonymous", dateIso: r.created_at })),
  ]
    .sort((a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime())
    .slice(0, 5)
    .map(({ dateIso, ...rest }) => ({ ...rest, dateLabel: dateFormatter.format(new Date(dateIso)) }));

  // Same "pending" rows the Teachers/Students tabs already compute —
  // surfaced here too so approvals waiting on the institute are visible
  // right from Overview.
  const pendingTeacherApprovals: PendingTeacherApproval[] = instituteTeachers
    .filter((row) => row.rosterStatus === "pending")
    .map((row) => ({ id: row.id, name: row.name, subject: row.subject }));
  const pendingStudentApprovals: PendingStudentApproval[] = instituteJoinRequests.map((row) => ({
    id: row.id,
    studentName: row.studentName,
    batchLabel: row.batch,
  }));

  return (
    <DashboardShell
      userLabel={fullName}
      userInitial={userInitial}
      userPhotoUrl={classProfile?.photo_url ?? null}
      logoutLabel={t("logout")}
      demoRole="class"
      // owner_id on inquiries/enrollments is class_profiles.id for an
      // institute, not the auth user's own id — same distinction every
      // owner-scoped query on this page already makes.
      notifications={notifications}
      realtimeWatch={
        instituteId
          ? [
              { table: "inquiries", filter: `owner_id=eq.${instituteId}` },
              { table: "enrollments", filter: `owner_id=eq.${instituteId}` },
              { table: "notifications", filter: `recipient_id=eq.${userId}` },
            ]
          : [{ table: "notifications", filter: `recipient_id=eq.${userId}` }]
      }
      groups={[
        {
          items: [{ key: "overview", label: t("tabs.overview") }],
        },
        {
          key: "institute",
          label: t("groupInstitute"),
          items: [
            { key: "profile", label: t("tabs.profile") },
            {
              key: "teachers",
              label: t("tabs.teachers"),
              count: pendingTeacherApprovals.length,
              countUrgent: pendingTeacherApprovals.length > 0,
            },
            { key: "batches", label: t("tabs.batches"), count: batches.length },
            {
              key: "students",
              label: t("tabs.students"),
              count: instituteJoinRequests.length,
              countUrgent: instituteJoinRequests.length > 0,
            },
            { key: "calendar", label: t("tabs.calendar") },
          ],
        },
        {
          key: "manage",
          label: t("groupManage"),
          items: [
            {
              key: "inquiries",
              label: t("tabs.inquiries"),
              count: inquiries.filter((i) => i.status === "new").length,
              countUrgent: inquiries.some((i) => i.status === "new"),
            },
            {
              key: "studentRequests",
              label: t("tabs.studentRequests"),
              count: wantedAdRequests.filter((r) => !r.myResponse).length,
              countUrgent: wantedAdRequests.some((r) => !r.myResponse),
            },
            { key: "ads", label: t("tabs.ads"), highlight: true },
            { key: "attendance", label: t("tabs.attendance") },
            { key: "finance", label: t("tabs.finance") },
            { key: "analytics", label: t("tabs.analytics") },
            { key: "announcements", label: t("tabs.announcements") },
            { key: "reviews", label: t("tabs.reviews"), count: reviewRows?.length ?? 0 },
            { key: "settings", label: t("tabs.settings") },
          ],
        },
        {
          key: "lms",
          label: t("groupLms"),
          items: [
            { key: "timetable", label: t("tabs.timetable") },
            { key: "exams", label: t("tabs.exams") },
            { key: "parentPortal", label: t("tabs.parentPortal") },
            { key: "library", label: t("tabs.library") },
            { key: "extracurriculars", label: t("tabs.extracurriculars") },
          ],
        },
      ]}
      panels={{
        overview: (
          <OverviewTab
            instituteName={fullName}
            location={classProfile?.location ?? ""}
            verified={classProfile?.institution_verified ?? false}
            teachersCount={acceptedTeacherIds.length}
            studentsCount={studentsCount}
            batchesCount={batches.length}
            revenueDisplay={thisMonthCollected > 0 ? `Rs. ${thisMonthCollected.toLocaleString()}` : "—"}
            teachersAtGlance={teachersAtGlance}
            recentActivity={recentActivity}
            pendingTeacherApprovals={pendingTeacherApprovals}
            pendingStudentApprovals={pendingStudentApprovals}
          />
        ),
        profile: (
          <ProfileTab
            initialName={classProfile?.name ?? fullName}
            initialLocation={classProfile?.location ?? ""}
            initialEstablished={classProfile?.established ?? ""}
            initialDescription={classProfile?.description ?? ""}
            initialPhotoUrl={classProfile?.photo_url ?? null}
            liveView={liveView}
            initialPhone={profile?.phone ?? ""}
            initialHourlyRate={priceRow?.hourly_rate?.toString() ?? ""}
            initialMonthlyRate={priceRow?.monthly_rate?.toString() ?? ""}
            initialStatus={classProfile?.status ?? "pending"}
            initialOwnerPublished={classProfile?.owner_published ?? true}
            initialInstitutionVerified={classProfile?.institution_verified ?? false}
            initialHasVerificationDocument={classProfile?.verification_document_path != null}
          />
        ),
        teachers: <TeachersTab teachers={instituteTeachers} seekingAds={teacherSeekingAds} />,
        batches: (
          <BatchesTab batches={batches} teacherOptions={rosterTeacherOptions} rosterByBatch={instituteBatchRoster} />
        ),
        students: (
          <StudentsTab
            students={instituteStudents}
            requests={instituteJoinRequests}
            batchOptions={batches.map((b) => ({ id: b.id, title: b.title }))}
          />
        ),
        calendar: <CalendarTab sessions={calendarSessions} />,
        inquiries: <InquiriesTab inquiries={inquiries} />,
        studentRequests: <WantedAdsBrowseTab requests={wantedAdRequests} />,
        ads: (
          <AdvertisementTab
            promotions={(adRows ?? [])
              .filter((row) => row.status !== "deleted")
              .map((row) => ({ id: row.id, content: row.content ?? "" }))}
            batches={instituteAdBatches}
            adHistory={instituteAdHistory}
            promotionHistory={institutePromotionHistory}
          />
        ),
        attendance: <AttendanceTab sessions={instituteAttendanceSessions} batchSummaries={batchAttendanceSummaries} />,
        finance: (
          <FinanceTab
            totalCharged={totalCharged}
            totalCollected={totalCollected}
            outstandingTotal={outstandingTotal}
            thisMonthCollected={thisMonthCollected}
            balances={feeBalances}
            charges={feeCharges}
            payments={feePayments}
            students={financeStudentOptions}
            batches={batches.map((b) => ({ id: b.id, title: b.title }))}
            templates={feePlanTemplates}
          />
        ),
        timetable: <TimetableTab slots={timetableSlots} />,
        exams: <ExamsLmsTab exams={examOversightRows} />,
        parentPortal: <ParentPortalTab students={parentPortalRows} />,
        library: <LibraryTab resources={libraryResources} />,
        extracurriculars: <ExtracurricularsTab activities={extracurricularActivities} studentOptions={extracurricularStudentOptions} />,
        announcements: <AnnouncementsTab announcements={announcements} />,
        analytics: (
          <AnalyticsTab
            examResults={analyticsExamResults}
            attendance={analyticsAttendance}
            batches={batches.map((b): AnalyticsBatchOption => ({ id: b.id, title: b.title }))}
          />
        ),
        reviews: (
          <ReviewsTab initialReviews={reviews} averageRating={averageRating ?? "0.0"} reviewCount={reviewRows?.length ?? 0} />
        ),
        settings: (
          <SettingsTab
            initialNotificationPrefs={(profile?.notification_prefs as Record<string, boolean>) ?? {}}
            referralCode={referralCodeValue ?? ""}
            referrals={referrals}
          />
        ),
      }}
      defaultTab="overview"
    />
  );
}
