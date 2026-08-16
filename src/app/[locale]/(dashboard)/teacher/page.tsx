import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OverviewTab } from "@/components/dashboard/teacher/overview-tab";
import { ProfileTab } from "@/components/dashboard/teacher/profile-tab";
import { NotesTab } from "@/components/dashboard/teacher/notes-tab";
import { ClassesTab } from "@/components/dashboard/teacher/classes-tab";
import { QuestionBankTab } from "@/components/dashboard/teacher/question-bank-tab";
import { ExamsTab } from "@/components/dashboard/teacher/exams-tab";
import { LiveClassesTab } from "@/components/dashboard/teacher/live-classes-tab";
import { StudentsTab } from "@/components/dashboard/teacher/students-tab";
import { AttendanceTab } from "@/components/dashboard/teacher/attendance-tab";
import { ReviewsTab } from "@/components/dashboard/teacher/reviews-tab";
import { AdvertisementTab } from "@/components/dashboard/teacher/advertisement-tab";
import { SettingsTab } from "@/components/dashboard/teacher/settings-tab";
import { createClient } from "@/lib/supabase/server";
import type { TeacherBatchRow, BatchRosterEntry } from "@/components/dashboard/teacher/classes-tab";
import type { TeacherNoteRow } from "@/components/dashboard/teacher/notes-tab";

export default async function TeacherDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("teacherDashboard");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // proxy.ts already gates this route behind an authenticated session.
  const userId = user!.id;

  const [{ data: profile }, { data: teacherProfile }, { data: priceRow }, { data: adRow }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", userId).single(),
    supabase.from("teacher_profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("prices").select("hourly_rate, monthly_rate").eq("owner_type", "teacher").eq("owner_id", userId).maybeSingle(),
    supabase
      .from("advertisements")
      .select("content")
      .eq("owner_type", "teacher")
      .eq("owner_id", userId)
      .eq("placement", "own_profile")
      .maybeSingle(),
  ]);

  const fullName = profile?.full_name ?? user!.email ?? "Teacher";
  const userInitial = fullName.charAt(0).toUpperCase();

  const [
    { count: studentsCount },
    { data: reviewRows },
    { data: examRows },
    { data: pendingSubmissionRows },
  ] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("owner_type", "teacher")
      .eq("owner_id", userId),
    supabase.from("reviews").select("rating").eq("target_type", "teacher").eq("target_id", userId),
    supabase.from("exams").select("id").eq("owner_type", "teacher").eq("owner_id", userId),
    supabase.from("exam_submissions").select("id, exam_id").eq("status", "pending"),
  ]);

  const examIds = new Set((examRows ?? []).map((e) => e.id));
  const pendingSubmissionsCount = (pendingSubmissionRows ?? []).filter((s) => examIds.has(s.exam_id)).length;
  const averageRating = reviewRows?.length
    ? (reviewRows.reduce((sum, r) => sum + r.rating, 0) / reviewRows.length).toFixed(1)
    : null;

  const [{ data: batchRows }, { data: enrollmentRows }, { data: noteRows }] = await Promise.all([
    supabase
      .from("batches")
      .select("id, title, mode, location, schedule_note, grade_band")
      .eq("owner_type", "teacher")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("enrollments")
      .select("student_id, batch_id, joined_at")
      .eq("owner_type", "teacher")
      .eq("owner_id", userId),
    supabase
      .from("notes")
      .select("id, title, batch_id, page_count, created_at")
      .eq("owner_type", "teacher")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const batches: TeacherBatchRow[] = (batchRows ?? []).map((b) => ({
    id: b.id,
    title: b.title,
    mode: b.mode,
    location: b.location,
    scheduleNote: b.schedule_note,
    gradeBand: b.grade_band,
  }));

  const studentIds = [...new Set((enrollmentRows ?? []).map((e) => e.student_id))];
  const { data: studentProfiles } = studentIds.length
    ? await supabase.from("profiles").select("id, full_name, phone").in("id", studentIds)
    : { data: [] as { id: string; full_name: string; phone: string | null }[] };
  const studentById = new Map((studentProfiles ?? []).map((p) => [p.id, p]));

  const rosterByBatch: Record<string, BatchRosterEntry[]> = {};
  for (const enrollment of enrollmentRows ?? []) {
    if (!enrollment.batch_id) continue;
    const student = studentById.get(enrollment.student_id);
    const entry: BatchRosterEntry = {
      name: student?.full_name ?? "—",
      joinedAt: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(enrollment.joined_at)),
      phone: student?.phone ?? null,
    };
    (rosterByBatch[enrollment.batch_id] ??= []).push(entry);
  }

  const notes: TeacherNoteRow[] = (noteRows ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    batchTitle: batches.find((b) => b.id === n.batch_id)?.title ?? null,
    pageCount: n.page_count,
  }));

  return (
    <DashboardShell
      publicProfileHref={`/teacher/${userId}`}
      publicProfileLabel={t("publicProfile")}
      userLabel={fullName}
      userInitial={userInitial}
      logoutLabel={t("logout")}
      demoRole="teacher"
      groups={[
        {
          label: t("groupTeach"),
          items: [
            { key: "overview", label: t("tabs.overview") },
            { key: "profile", label: t("tabs.profile") },
            { key: "notes", label: t("tabs.notes"), count: notes.length },
            { key: "classes", label: t("tabs.classes"), count: batches.length },
            { key: "questionBank", label: t("tabs.questionBank"), count: 12 },
            { key: "exams", label: t("tabs.exams"), count: examRows?.length ?? 0 },
            { key: "live", label: t("tabs.live") },
          ],
        },
        {
          label: t("groupManage"),
          items: [
            { key: "students", label: t("tabs.students"), count: studentsCount ?? 0 },
            { key: "attendance", label: t("tabs.attendance") },
            { key: "reviews", label: t("tabs.reviews"), count: reviewRows?.length ?? 0 },
            { key: "ads", label: t("tabs.ads") },
            { key: "settings", label: t("tabs.settings") },
          ],
        },
      ]}
      panels={{
        overview: (
          <OverviewTab
            teacherName={fullName}
            activeStudentsCount={studentsCount ?? 0}
            averageRating={averageRating}
            reviewsCount={reviewRows?.length ?? 0}
            pendingSubmissionsCount={pendingSubmissionsCount}
          />
        ),
        profile: (
          <ProfileTab
            initialQualifications={teacherProfile?.qualifications ?? ""}
            initialExperienceYears={teacherProfile?.experience_years?.toString() ?? ""}
            initialLocation={teacherProfile?.location ?? ""}
            initialClassType={teacherProfile?.class_type ?? "physical"}
            initialHourlyRate={priceRow?.hourly_rate?.toString() ?? ""}
            initialMonthlyRate={priceRow?.monthly_rate?.toString() ?? ""}
            teacherName={fullName}
          />
        ),
        notes: <NotesTab notes={notes} batches={batches} />,
        classes: <ClassesTab batches={batches} rosterByBatch={rosterByBatch} />,
        questionBank: <QuestionBankTab />,
        exams: <ExamsTab />,
        live: <LiveClassesTab />,
        students: <StudentsTab />,
        attendance: <AttendanceTab />,
        reviews: <ReviewsTab />,
        ads: <AdvertisementTab initialContent={adRow?.content ?? ""} />,
        settings: <SettingsTab initialPhone={profile?.phone ?? ""} email={user!.email ?? ""} />,
      }}
      defaultTab="overview"
    />
  );
}
