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
    .select("full_name, phone")
    .eq("id", userId)
    .single();

  const fullName = profile?.full_name ?? user!.email ?? "Student";
  const userInitial = fullName.charAt(0).toUpperCase();

  const [{ data: enrollments }, { data: noteRows }, { data: examRows }, { data: submissionRows }] =
    await Promise.all([
      supabase.from("enrollments").select("id, owner_type, owner_id, batch_id, joined_at"),
      supabase.from("notes").select("id, owner_type, owner_id, batch_id, title, page_count"),
      supabase.from("exams").select("id"),
      supabase.from("exam_submissions").select("exam_id").eq("student_id", userId),
    ]);

  const classesCount = enrollments?.length ?? 0;
  const submittedExamIds = new Set((submissionRows ?? []).map((s) => s.exam_id));
  const examsDueCount = (examRows ?? []).filter((e) => !submittedExamIds.has(e.id)).length;

  const teacherIds = (enrollments ?? []).filter((e) => e.owner_type === "teacher").map((e) => e.owner_id);
  const classIds = (enrollments ?? []).filter((e) => e.owner_type === "class").map((e) => e.owner_id);
  const nowIso = new Date().toISOString();

  const [teacherLive, classLive] = await Promise.all([
    teacherIds.length
      ? supabase
          .from("live_classes")
          .select("title, scheduled_at")
          .eq("owner_type", "teacher")
          .in("owner_id", teacherIds)
          .eq("status", "scheduled")
          .gte("scheduled_at", nowIso)
          .order("scheduled_at", { ascending: true })
          .limit(1)
      : Promise.resolve({ data: [] as { title: string; scheduled_at: string }[] }),
    classIds.length
      ? supabase
          .from("live_classes")
          .select("title, scheduled_at")
          .eq("owner_type", "class")
          .in("owner_id", classIds)
          .eq("status", "scheduled")
          .gte("scheduled_at", nowIso)
          .order("scheduled_at", { ascending: true })
          .limit(1)
      : Promise.resolve({ data: [] as { title: string; scheduled_at: string }[] }),
  ]);

  const nextLive = [...(teacherLive.data ?? []), ...(classLive.data ?? [])].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
  )[0];
  const nextLiveLabel = nextLive
    ? new Intl.DateTimeFormat(locale, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(
        new Date(nextLive.scheduled_at),
      )
    : null;

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
    teacherOwnerIds.size
      ? supabase.from("profiles").select("id, full_name").in("id", [...teacherOwnerIds])
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

  const batchById = new Map((allBatches ?? []).map((b) => [b.id, b]));
  const joinedOwnerKeys = new Set((enrollments ?? []).map((e) => `${e.owner_type}:${e.owner_id}`));
  const enrolledBatchIds = new Set((enrollments ?? []).map((e) => e.batch_id).filter((id): id is string => Boolean(id)));

  const myClasses: MyClassRow[] = (enrollments ?? []).map((e) => {
    const batch = e.batch_id ? batchById.get(e.batch_id) : undefined;
    return {
      enrollmentId: e.id,
      batchTitle: batch?.title ?? null,
      ownerName: ownerName(e.owner_type, e.owner_id),
      ownerType: e.owner_type,
      mode: batch?.mode ?? null,
      scheduleNote: batch?.schedule_note ?? null,
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
        live: <LiveClassesTab />,
        notes: <NotesTab notes={studentNotes} studentName={fullName} />,
        exams: <ExamsTab />,
        reviews: <ReviewsTab />,
        profile: (
          <ProfileTab initialName={fullName} initialPhone={profile?.phone ?? ""} email={user!.email ?? ""} />
        ),
      }}
      defaultTab="overview"
    />
  );
}
