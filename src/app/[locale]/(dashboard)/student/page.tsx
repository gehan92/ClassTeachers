import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OverviewTab } from "@/components/dashboard/student/overview-tab";
import { ClassesTab } from "@/components/dashboard/student/classes-tab";
import { LiveClassesTab } from "@/components/dashboard/student/live-classes-tab";
import { NotesTab } from "@/components/dashboard/student/notes-tab";
import { ExamsTab } from "@/components/dashboard/student/exams-tab";
import { ReviewsTab } from "@/components/dashboard/student/reviews-tab";
import { ProfileTab } from "@/components/dashboard/student/profile-tab";
import { createClient } from "@/lib/supabase/server";
import type { MyClassRow, AvailableBatchRow } from "@/components/dashboard/student/classes-tab";
import type { StudentNoteRow } from "@/components/dashboard/student/notes-tab";
import type { ReviewTarget, StudentPostedReview } from "@/components/dashboard/student/reviews-tab";
import type { StudentLiveClassRow } from "@/components/dashboard/student/live-classes-tab";
import type { StudentExamRow, StudentExamQuestion } from "@/components/dashboard/student/exams-tab";

function isFuture(iso: string): boolean {
  return new Date(iso).getTime() >= Date.now();
}

export default async function StudentDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("studentDashboard");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // proxy.ts already gates this route behind an authenticated session.
  const userId = user!.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, grade_level, notification_prefs")
    .eq("id", userId)
    .single();

  const fullName = profile?.full_name ?? user!.email ?? "Student";
  const userInitial = fullName.charAt(0).toUpperCase();

  const [{ data: enrollments }, { data: noteRows }, { data: examRows }, { data: submissionRows }] =
    await Promise.all([
      supabase.from("enrollments").select("id, owner_type, owner_id, batch_id, joined_at, status"),
      supabase.from("notes").select("id, owner_type, owner_id, batch_id, title, page_count"),
      supabase
        .from("exams")
        .select("id, owner_type, owner_id, title, question_ids, duration_minutes, scheduled_at")
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("exam_submissions")
        .select("exam_id, status, grade, feedback, submitted_at")
        .eq("student_id", userId),
    ]);

  const acceptedEnrollments = (enrollments ?? []).filter((e) => e.status === "accepted");
  const classesCount = acceptedEnrollments.length;
  const submissionByExamId = new Map((submissionRows ?? []).map((s) => [s.exam_id, s]));
  const examsDueCount = (examRows ?? []).filter((e) => submissionByExamId.get(e.id)?.status !== "graded").length;

  const teacherIds = acceptedEnrollments.filter((e) => e.owner_type === "teacher").map((e) => e.owner_id);
  const classIds = acceptedEnrollments.filter((e) => e.owner_type === "class").map((e) => e.owner_id);

  const [teacherLive, classLive] = await Promise.all([
    teacherIds.length
      ? supabase
          .from("live_classes")
          .select("id, owner_id, title, mode, scheduled_at, duration_minutes")
          .eq("owner_type", "teacher")
          .in("owner_id", teacherIds)
          .neq("status", "cancelled")
          .order("scheduled_at", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; owner_id: string; title: string; mode: "online" | "physical"; scheduled_at: string; duration_minutes: number }[] }),
    classIds.length
      ? supabase
          .from("live_classes")
          .select("id, owner_id, title, mode, scheduled_at, duration_minutes")
          .eq("owner_type", "class")
          .in("owner_id", classIds)
          .neq("status", "cancelled")
          .order("scheduled_at", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; owner_id: string; title: string; mode: "online" | "physical"; scheduled_at: string; duration_minutes: number }[] }),
  ]);

  const liveClassRows = [
    ...(teacherLive.data ?? []).map((r) => ({ ...r, ownerType: "teacher" as const })),
    ...(classLive.data ?? []).map((r) => ({ ...r, ownerType: "class" as const })),
  ].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const nextLive = liveClassRows.find((row) => isFuture(row.scheduled_at));
  const nextLiveLabel = nextLive
    ? new Intl.DateTimeFormat(locale, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(
        new Date(nextLive.scheduled_at),
      )
    : null;

  const liveClassIds = liveClassRows.map((r) => r.id);
  const { data: liveClassLinkRows } = liveClassIds.length
    ? await supabase.from("live_class_links").select("live_class_id, join_link").in("live_class_id", liveClassIds)
    : { data: [] as { live_class_id: string; join_link: string }[] };
  const joinLinkByClassId = new Map((liveClassLinkRows ?? []).map((l) => [l.live_class_id, l.join_link]));

  const { data: allBatches } = await supabase
    .from("batches")
    .select("id, owner_type, owner_id, title, mode, location, schedule_note")
    .order("created_at", { ascending: false });

  const teacherOwnerIds = new Set<string>();
  const classOwnerIds = new Set<string>();
  for (const e of enrollments ?? []) (e.owner_type === "teacher" ? teacherOwnerIds : classOwnerIds).add(e.owner_id);
  for (const b of allBatches ?? []) (b.owner_type === "teacher" ? teacherOwnerIds : classOwnerIds).add(b.owner_id);
  for (const n of noteRows ?? []) (n.owner_type === "teacher" ? teacherOwnerIds : classOwnerIds).add(n.owner_id);

  const [{ data: teacherOwners }, { data: classOwners }] = await Promise.all([
    // Plain `profiles` select would return zero rows here — its only RLS
    // policy is "your own row or admin" (0003). This RPC (0032) opens it up
    // specifically for teachers the caller is actually enrolled with.
    teacherOwnerIds.size
      ? supabase.rpc("get_enrolled_teacher_names", { p_teacher_ids: [...teacherOwnerIds] })
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    classOwnerIds.size
      ? supabase.from("class_profiles").select("id, name").in("id", [...classOwnerIds])
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const teacherNameById = new Map((teacherOwners ?? []).map((p) => [p.id, p.full_name]));
  const classNameById = new Map((classOwners ?? []).map((c) => [c.id, c.name]));
  function ownerName(ownerType: "teacher" | "class", ownerId: string) {
    return (ownerType === "teacher" ? teacherNameById.get(ownerId) : classNameById.get(ownerId)) ?? "—";
  }

  const liveClasses: StudentLiveClassRow[] = liveClassRows.map((row) => ({
    id: row.id,
    title: row.title,
    teacherName: ownerName(row.ownerType, row.owner_id),
    scheduledAtIso: row.scheduled_at,
    scheduledLabel: new Intl.DateTimeFormat(locale, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(row.scheduled_at)),
    durationMinutes: row.duration_minutes,
    mode: row.mode,
    joinLink: joinLinkByClassId.get(row.id) ?? null,
  }));

  const batchById = new Map((allBatches ?? []).map((b) => [b.id, b]));
  const joinedOwnerKeys = new Set((enrollments ?? []).map((e) => `${e.owner_type}:${e.owner_id}`));
  const enrolledBatchIds = new Set((enrollments ?? []).map((e) => e.batch_id).filter((id): id is string => Boolean(id)));

  const myClasses: MyClassRow[] = (enrollments ?? [])
    .filter((e) => e.status !== "declined")
    .map((e) => {
      const batch = e.batch_id ? batchById.get(e.batch_id) : undefined;
      return {
        enrollmentId: e.id,
        batchTitle: batch?.title ?? null,
        ownerName: ownerName(e.owner_type, e.owner_id),
        ownerType: e.owner_type,
        mode: batch?.mode ?? null,
        scheduleNote: batch?.schedule_note ?? null,
        status: e.status,
      };
    });

  const availableBatches: AvailableBatchRow[] = (allBatches ?? [])
    .filter((b) => !joinedOwnerKeys.has(`${b.owner_type}:${b.owner_id}`))
    .map((b) => ({
      id: b.id,
      title: b.title,
      ownerName: ownerName(b.owner_type, b.owner_id),
      mode: b.mode,
      location: b.location,
      scheduleNote: b.schedule_note,
    }));

  const studentNotes: StudentNoteRow[] = (noteRows ?? [])
    .filter((n) => !n.batch_id || enrolledBatchIds.has(n.batch_id))
    .map((n) => ({
      id: n.id,
      title: n.title,
      batchTitle: n.batch_id ? (batchById.get(n.batch_id)?.title ?? null) : null,
      ownerName: ownerName(n.owner_type, n.owner_id),
      pageCount: n.page_count,
    }));

  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const allQuestionIds = [...new Set((examRows ?? []).flatMap((e) => e.question_ids))];
  const { data: examQuestionRows } = allQuestionIds.length
    ? await supabase.from("question_bank_items").select("id, question_text, type, marks").in("id", allQuestionIds)
    : { data: [] as { id: string; question_text: string; type: "mcq" | "essay"; marks: number }[] };
  const questionById = new Map((examQuestionRows ?? []).map((q) => [q.id, q]));

  const exams: StudentExamRow[] = (examRows ?? []).map((e) => {
    const submission = submissionByExamId.get(e.id);
    return {
      id: e.id,
      title: e.title,
      teacherName: ownerName(e.owner_type, e.owner_id),
      durationMinutes: e.duration_minutes,
      scheduledLabel: e.scheduled_at ? dateFormatter.format(new Date(e.scheduled_at)) : "—",
      isOpen: !e.scheduled_at || !isFuture(e.scheduled_at),
      questions: e.question_ids
        .map((qid) => {
          const q = questionById.get(qid);
          return q ? { id: q.id, text: q.question_text, type: q.type, marks: q.marks } : null;
        })
        .filter((q): q is StudentExamQuestion => q !== null),
      submission: submission
        ? {
            status: submission.status,
            grade: submission.grade,
            feedback: submission.feedback,
            submittedLabel: submission.submitted_at ? dateFormatter.format(new Date(submission.submitted_at)) : null,
          }
        : null,
    };
  });

  const reviewTargets: ReviewTarget[] = [...joinedOwnerKeys].map((key) => {
    const [ownerType, ownerId] = key.split(":") as ["teacher" | "class", string];
    return { ownerType, ownerId, name: ownerName(ownerType, ownerId) };
  });

  const { data: myReviewRows } = await supabase
    .from("reviews")
    .select("id, target_type, target_id, rating, comment, created_at")
    .eq("reviewer_id", userId)
    .in("target_type", ["teacher", "class"]);

  const myReviews: StudentPostedReview[] = (myReviewRows ?? []).map((r) => ({
    id: r.id,
    ownerType: r.target_type as "teacher" | "class",
    ownerId: r.target_id,
    targetName: ownerName(r.target_type as "teacher" | "class", r.target_id),
    rating: r.rating,
    body: r.comment ?? "",
    date: dateFormatter.format(new Date(r.created_at)),
  }));

  return (
    <DashboardShell
      userLabel={fullName}
      userInitial={userInitial}
      logoutLabel={t("logout")}
      demoRole="student"
      groups={[
        {
          label: t("groupLearn"),
          items: [
            { key: "overview", label: t("tabs.overview") },
            { key: "classes", label: t("tabs.classes") },
            { key: "live", label: t("tabs.live") },
            { key: "notes", label: t("tabs.notes") },
            { key: "exams", label: t("tabs.exams"), count: examsDueCount },
          ],
        },
        {
          label: t("groupAccount"),
          items: [
            { key: "reviews", label: t("tabs.reviews") },
            { key: "profile", label: t("tabs.profile") },
          ],
        },
      ]}
      panels={{
        overview: (
          <OverviewTab
            studentName={fullName}
            classesCount={classesCount}
            nextLiveLabel={nextLiveLabel}
            examsDueCount={examsDueCount}
            notesCount={studentNotes.length}
          />
        ),
        classes: <ClassesTab myClasses={myClasses} availableBatches={availableBatches} />,
        live: <LiveClassesTab classes={liveClasses} />,
        notes: <NotesTab notes={studentNotes} studentName={fullName} />,
        exams: <ExamsTab exams={exams} />,
        reviews: <ReviewsTab targets={reviewTargets} initialReviews={myReviews} />,
        profile: (
          <ProfileTab
            initialName={fullName}
            initialPhone={profile?.phone ?? ""}
            initialGrade={profile?.grade_level ?? ""}
            initialNotificationPrefs={(profile?.notification_prefs as Record<string, boolean>) ?? {}}
            email={user!.email ?? ""}
          />
        ),
      }}
      defaultTab="overview"
    />
  );
}
