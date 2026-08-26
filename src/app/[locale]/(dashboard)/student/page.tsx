import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OverviewTab } from "@/components/dashboard/student/overview-tab";
import { ClassesTab } from "@/components/dashboard/student/classes-tab";
import { LiveClassesTab } from "@/components/dashboard/student/live-classes-tab";
import { NotesTab } from "@/components/dashboard/student/notes-tab";
import { ExamsTab } from "@/components/dashboard/student/exams-tab";
import { AssignmentsTab } from "@/components/dashboard/student/assignments-tab";
import { ReviewsTab } from "@/components/dashboard/student/reviews-tab";
import { ProfileTab } from "@/components/dashboard/student/profile-tab";
import { SettingsTab } from "@/components/dashboard/student/settings-tab";
import { WantedAdsTab } from "@/components/dashboard/student/wanted-ads-tab";
import { createClient } from "@/lib/supabase/server";
import { createDateFormatter, createScheduleFormatter } from "@/lib/format-date";
import type { MyClassRow, AvailableBatchRow } from "@/components/dashboard/student/classes-tab";
import type { StudentNoteRow } from "@/components/dashboard/student/notes-tab";
import type { ReviewTarget, StudentPostedReview } from "@/components/dashboard/student/reviews-tab";
import type { StudentLiveClassRow } from "@/components/dashboard/student/live-classes-tab";
import type { StudentExamRow, StudentExamQuestion } from "@/components/dashboard/student/exams-tab";
import type { StudentAssignmentRow } from "@/components/dashboard/student/assignments-tab";
import type { WantedAdRow, WantedAdResponseRow } from "@/components/dashboard/student/wanted-ads-tab";
import type { PublicWantedAd } from "@/components/features/wanted-ads-board";

type RawQuestionOption = { id: string; text: string; imagePath?: string };
type RawLiveClassRow = {
  id: string;
  owner_id: string;
  title: string;
  mode: "online" | "physical";
  scheduled_at: string;
  duration_minutes: number;
  batch_id: string | null;
};

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
  const dateFormatter = createDateFormatter(locale);
  const scheduleFormatter = createScheduleFormatter(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // proxy.ts already gates this route behind an authenticated session.
  const userId = user!.id;

  // Stage 1 — every query below only needs userId (or nothing at all,
  // relying purely on RLS), not each other's results, so they all run as
  // one batch instead of a chain of sequential round trips. This function
  // re-runs in full on every page load AND every router.refresh() after a
  // mutation (see useDashboardRefresh), so collapsing that chain here is
  // what actually makes the dashboard feel fast rather than just showing a
  // loading indicator sooner.
  const [
    { data: profile },
    { data: enrollments },
    { data: noteRows },
    { data: examRows },
    { data: submissionRows },
    { data: allBatches },
    { data: assignmentRows },
    { data: assignmentSubmissionRows },
    { data: myReviewRows },
    { data: wantedAdRows },
    { data: subjectRows },
    { data: wantedAdResponseRows },
    { data: publicWantedAdRows },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "full_name, phone, grade_level, notification_prefs, avatar_url, bio, education_level, institution_name, qualifications, work_experience, subjects, languages, share_phone_with_teachers, date_of_birth, location, learning_goals, preferred_mode, achievements, interests, availability",
      )
      .eq("id", userId)
      .single(),
    supabase.from("enrollments").select("id, owner_type, owner_id, batch_id, joined_at, status"),
    supabase.from("notes").select("id, owner_type, owner_id, batch_id, title, page_count"),
    supabase
      .from("exams")
      .select("id, owner_type, owner_id, title, question_ids, duration_minutes, scheduled_at")
      .order("scheduled_at", { ascending: true }),
    supabase.from("exam_submissions").select("exam_id, status, grade, feedback, submitted_at").eq("student_id", userId),
    supabase
      .from("batches")
      .select("id, owner_type, owner_id, title, mode, location, schedule_note")
      .order("created_at", { ascending: false }),
    // No explicit owner filter here — RLS (is_enrolled, 0047) already
    // scopes which assignment rows come back.
    supabase
      .from("assignments")
      .select("id, owner_type, owner_id, batch_id, lesson_id, title, file_path, due_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("assignment_submissions")
      .select("assignment_id, status, grade, feedback, submitted_at, photo_urls")
      .eq("student_id", userId),
    supabase
      .from("reviews")
      .select("id, target_type, target_id, rating, comment, created_at")
      .eq("reviewer_id", userId)
      .in("target_type", ["teacher", "class"]),
    supabase
      .from("wanted_ads")
      .select("id, looking_for, subject_id, mode, grade_level, title, description, status")
      .eq("student_id", userId)
      .order("created_at", { ascending: false }),
    // The full catalog, not just subjects this student already has a class
    // in — unlike the teacher Ads tab (scoped to subject_links, what that
    // teacher already teaches), a student can be looking for help with any
    // subject that exists, including ones they've never had a class for.
    supabase.from("subjects").select("id, translations"),
    supabase.rpc("list_wanted_ad_responses_for_student"),
    // Same anon-safe RPC the public /requests page uses — reused here to
    // show a few real, other-students' requests as posting inspiration
    // (never fake sample text), filtered down to a handful below.
    supabase.rpc("list_public_wanted_ads"),
  ]);

  const fullName = profile?.full_name ?? user!.email ?? "Student";
  const userInitial = fullName.charAt(0).toUpperCase();

  const acceptedEnrollments = (enrollments ?? []).filter((e) => e.status === "accepted");
  const classesCount = acceptedEnrollments.length;
  const submissionByExamId = new Map((submissionRows ?? []).map((s) => [s.exam_id, s]));
  const allExamIds = (examRows ?? []).map((e) => e.id);
  const teacherIds = acceptedEnrollments.filter((e) => e.owner_type === "teacher").map((e) => e.owner_id);
  const classIds = acceptedEnrollments.filter((e) => e.owner_type === "class").map((e) => e.owner_id);
  const teacherOwnerIds = new Set<string>();
  const classOwnerIds = new Set<string>();
  for (const e of enrollments ?? []) (e.owner_type === "teacher" ? teacherOwnerIds : classOwnerIds).add(e.owner_id);
  for (const b of allBatches ?? []) (b.owner_type === "teacher" ? teacherOwnerIds : classOwnerIds).add(b.owner_id);
  for (const n of noteRows ?? []) (n.owner_type === "teacher" ? teacherOwnerIds : classOwnerIds).add(n.owner_id);
  const submissionPhotoPaths = (assignmentSubmissionRows ?? []).flatMap((s) => s.photo_urls ?? []);
  const assignmentFilePaths = (assignmentRows ?? []).map((a) => a.file_path);

  // Stage 2 — everything here needs a stage-1 result, but nothing here
  // depends on anything else in this stage.
  const [
    { data: visibleExamIds },
    teacherLive,
    classLive,
    { data: teacherOwners },
    { data: classOwners },
    { data: signedSubmissionUrls },
    { data: signedAssignmentUrls },
  ] = await Promise.all([
    // An exam can be narrowed by batch and/or an explicit hand-picked
    // student list (0060/0061) — is_enrolled_in_exam() is the one place
    // both checks actually live, so this asks the database the same
    // question its own question-bank/submission RLS asks, instead of
    // re-deriving the batch/participant logic here and risking it
    // drifting out of sync. Same pattern as visible_live_class_ids below.
    allExamIds.length
      ? supabase.rpc("visible_exam_ids", { p_ids: allExamIds })
      : Promise.resolve({ data: [] as string[] }),
    teacherIds.length
      ? supabase
          .from("live_classes")
          .select("id, owner_id, title, mode, scheduled_at, duration_minutes, batch_id")
          .eq("owner_type", "teacher")
          .in("owner_id", teacherIds)
          .neq("status", "cancelled")
          .order("scheduled_at", { ascending: true })
      : Promise.resolve({ data: [] as RawLiveClassRow[] }),
    classIds.length
      ? supabase
          .from("live_classes")
          .select("id, owner_id, title, mode, scheduled_at, duration_minutes, batch_id")
          .eq("owner_type", "class")
          .in("owner_id", classIds)
          .neq("status", "cancelled")
          .order("scheduled_at", { ascending: true })
      : Promise.resolve({ data: [] as RawLiveClassRow[] }),
    // Plain `profiles` select would return zero rows here — its only RLS
    // policy is "your own row or admin" (0003). This RPC (0032) opens it up
    // specifically for teachers the caller is actually enrolled with.
    teacherOwnerIds.size
      ? supabase.rpc("get_enrolled_teacher_names", { p_teacher_ids: [...teacherOwnerIds] })
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    classOwnerIds.size
      ? supabase.from("class_profiles").select("id, name").in("id", [...classOwnerIds])
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    submissionPhotoPaths.length > 0
      ? supabase.storage.from("submissions").createSignedUrls(submissionPhotoPaths, 3600)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
    assignmentFilePaths.length > 0
      ? supabase.storage.from("assignments").createSignedUrls(assignmentFilePaths, 3600)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
  ]);

  const visibleExamIdSet = new Set(visibleExamIds ?? []);
  const visibleExamRows = (examRows ?? []).filter((e) => visibleExamIdSet.has(e.id));
  const examsDueCount = visibleExamRows.filter((e) => submissionByExamId.get(e.id)?.status !== "graded").length;

  const allLiveClassRows = [
    ...(teacherLive.data ?? []).map((r) => ({ ...r, ownerType: "teacher" as const })),
    ...(classLive.data ?? []).map((r) => ({ ...r, ownerType: "class" as const })),
  ].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const allLiveClassIds = allLiveClassRows.map((r) => r.id);
  const allQuestionIds = [...new Set(visibleExamRows.flatMap((e) => e.question_ids))];

  // Stage 3 — needs a stage-2 result; the two queries here are independent
  // of each other.
  const [{ data: visibleLiveClassIds }, { data: examQuestionRows }] = await Promise.all([
    // A live class can be narrowed by batch (0054) and/or an explicit
    // hand-picked student list (0055) — is_enrolled_in_live_class() is the
    // one place both checks actually live, so this asks the database the
    // same question its own RLS asks, instead of re-deriving the batch/
    // participant logic here and risking it drifting out of sync.
    allLiveClassIds.length
      ? supabase.rpc("visible_live_class_ids", { p_ids: allLiveClassIds })
      : Promise.resolve({ data: [] as string[] }),
    allQuestionIds.length
      ? supabase
          .from("question_bank_items")
          .select("id, question_text, type, marks, options, correct_option_ids, question_image_path")
          .in("id", allQuestionIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            question_text: string;
            type: "mcq" | "essay";
            marks: number;
            options: unknown;
            correct_option_ids: string[];
            question_image_path: string | null;
          }[],
        }),
  ]);

  const visibleIdSet = new Set(visibleLiveClassIds ?? []);
  const liveClassRows = allLiveClassRows.filter((r) => visibleIdSet.has(r.id));
  const nextLive = liveClassRows.find((row) => isFuture(row.scheduled_at));
  const nextLiveLabel = nextLive ? scheduleFormatter.format(new Date(nextLive.scheduled_at)) : null;
  const liveClassIds = liveClassRows.map((r) => r.id);

  // correct_option_ids IS selected above (needed to derive multiSelect
  // below) but must never be forwarded into StudentExamQuestion — this is
  // the student's own view of the exam, and leaking the correct answer(s)
  // would defeat the point of not grading it in front of them.
  const questionById = new Map(
    (examQuestionRows ?? []).map((q) => [q.id, { ...q, options: (q.options as RawQuestionOption[] | null) ?? null }]),
  );
  const questionImagePaths = new Set<string>();
  for (const q of questionById.values()) {
    if (q.question_image_path) questionImagePaths.add(q.question_image_path);
    for (const option of q.options ?? []) {
      if (option.imagePath) questionImagePaths.add(option.imagePath);
    }
  }

  // Stage 4 — needs a stage-3 result; all three queries here are
  // independent of each other.
  const [{ data: liveClassLinkRows }, { data: reminderRows }, { data: signedQuestionImages }] = await Promise.all([
    liveClassIds.length
      ? supabase.from("live_class_links").select("live_class_id, join_link").in("live_class_id", liveClassIds)
      : Promise.resolve({ data: [] as { live_class_id: string; join_link: string }[] }),
    liveClassIds.length
      ? supabase.from("live_class_reminders").select("live_class_id").in("live_class_id", liveClassIds)
      : Promise.resolve({ data: [] as { live_class_id: string }[] }),
    questionImagePaths.size > 0
      ? supabase.storage.from("question-images").createSignedUrls([...questionImagePaths], 3600)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
  ]);

  // Everything below is pure computation over already-fetched data — no
  // more round trips from here on.

  const joinLinkByClassId = new Map((liveClassLinkRows ?? []).map((l) => [l.live_class_id, l.join_link]));
  const reminderClassIds = (reminderRows ?? []).map((r) => r.live_class_id);

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
    scheduledLabel: scheduleFormatter.format(new Date(row.scheduled_at)),
    durationMinutes: row.duration_minutes,
    mode: row.mode,
    joinLink: joinLinkByClassId.get(row.id) ?? null,
  }));

  const batchById = new Map((allBatches ?? []).map((b) => [b.id, b]));
  // A declined enrollment must not count as "already joined" (or the
  // teacher's class becomes permanently unrequestable — see
  // rejoin_after_decline, 0066) and must not unlock batch-scoped content —
  // is_enrolled() only checks status at the owner level, so a student
  // accepted into one batch but declined from another under the same
  // teacher would otherwise still see the declined batch's notes/
  // assignments through this filter alone.
  const joinedOwnerKeys = new Set(
    (enrollments ?? []).filter((e) => e.status !== "declined").map((e) => `${e.owner_type}:${e.owner_id}`),
  );
  const enrolledBatchIds = new Set(
    (enrollments ?? [])
      .filter((e) => e.status === "accepted")
      .map((e) => e.batch_id)
      .filter((id): id is string => Boolean(id)),
  );

  const myClasses: MyClassRow[] = (enrollments ?? [])
    .filter((e) => e.status !== "declined")
    .map((e) => {
      const batch = e.batch_id ? batchById.get(e.batch_id) : undefined;
      return {
        enrollmentId: e.id,
        ownerId: e.owner_id,
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
      batchId: n.batch_id,
      batchTitle: n.batch_id ? (batchById.get(n.batch_id)?.title ?? null) : null,
      ownerName: ownerName(n.owner_type, n.owner_id),
      pageCount: n.page_count,
    }));

  const questionImageUrlByPath = new Map<string, string>();
  for (const entry of signedQuestionImages ?? []) {
    if (entry.path && entry.signedUrl) questionImageUrlByPath.set(entry.path, entry.signedUrl);
  }

  const exams: StudentExamRow[] = visibleExamRows.map((e) => {
    const submission = submissionByExamId.get(e.id);
    return {
      id: e.id,
      title: e.title,
      teacherName: ownerName(e.owner_type, e.owner_id),
      durationMinutes: e.duration_minutes,
      scheduledLabel: e.scheduled_at ? scheduleFormatter.format(new Date(e.scheduled_at)) : "—",
      isOpen: !e.scheduled_at || !isFuture(e.scheduled_at),
      questions: e.question_ids
        .map((qid): StudentExamQuestion | null => {
          const q = questionById.get(qid);
          if (!q) return null;
          return {
            id: q.id,
            text: q.question_text,
            type: q.type,
            marks: q.marks,
            imageUrl: q.question_image_path ? questionImageUrlByPath.get(q.question_image_path) : undefined,
            options: q.options?.map((o) => ({
              id: o.id,
              text: o.text,
              imageUrl: o.imagePath ? questionImageUrlByPath.get(o.imagePath) : undefined,
            })),
            multiSelect: q.correct_option_ids.length > 1,
          };
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

  const lessonTitleById = new Map(liveClassRows.map((r) => [r.id, r.title]));

  const assignmentSubmissionByAssignmentId = new Map(
    (assignmentSubmissionRows ?? []).map((s) => [s.assignment_id, s]),
  );

  const submissionPhotoUrlByPath = new Map<string, string>();
  for (const entry of signedSubmissionUrls ?? []) {
    if (entry.path && entry.signedUrl) submissionPhotoUrlByPath.set(entry.path, entry.signedUrl);
  }

  const assignmentFileUrlByPath = new Map<string, string>();
  for (const entry of signedAssignmentUrls ?? []) {
    if (entry.path && entry.signedUrl) assignmentFileUrlByPath.set(entry.path, entry.signedUrl);
  }

  // Same batch-scoping notes already apply (0008): a batch-scoped assignment
  // is only visible to a student enrolled in that specific batch, not just
  // any batch of that teacher's — RLS only checks the owner-level enrollment.
  const visibleAssignmentRows = (assignmentRows ?? []).filter(
    (a) => !a.batch_id || enrolledBatchIds.has(a.batch_id),
  );

  const assignments: StudentAssignmentRow[] = visibleAssignmentRows.map((a) => {
    const submission = assignmentSubmissionByAssignmentId.get(a.id);
    return {
      id: a.id,
      title: a.title,
      teacherName: ownerName(a.owner_type, a.owner_id),
      batchId: a.batch_id,
      batchTitle: a.batch_id ? (batchById.get(a.batch_id)?.title ?? null) : null,
      lessonTitle: a.lesson_id ? (lessonTitleById.get(a.lesson_id) ?? null) : null,
      dueLabel: a.due_at ? dateFormatter.format(new Date(a.due_at)) : null,
      fileUrl: assignmentFileUrlByPath.get(a.file_path) ?? "",
      submission: submission
        ? {
            status: submission.status,
            grade: submission.grade,
            feedback: submission.feedback,
            submittedLabel: submission.submitted_at ? dateFormatter.format(new Date(submission.submitted_at)) : null,
            photoUrls: (submission.photo_urls ?? [])
              .map((path) => submissionPhotoUrlByPath.get(path))
              .filter((url): url is string => Boolean(url)),
          }
        : null,
    };
  });
  const assignmentsDueCount = visibleAssignmentRows.filter(
    (a) => assignmentSubmissionByAssignmentId.get(a.id)?.status !== "graded",
  ).length;

  // Overview's quick-action cards need real content, not just counts — the
  // teacher's name/class title for the next live class, and a couple of
  // actual exam titles that are still due, so the card can say something
  // true instead of static placeholder copy.
  const nextLiveTeacherName = nextLive ? ownerName(nextLive.ownerType, nextLive.owner_id) : null;
  const dueExamTitles = visibleExamRows
    .filter((e) => submissionByExamId.get(e.id)?.status !== "graded")
    .slice(0, 2)
    .map((e) => e.title);

  const subjectOptions = (subjectRows ?? [])
    .map((s) => ({ id: s.id, name: (s.translations as Record<string, string> | null)?.en ?? "" }))
    .filter((s) => s.name)
    .sort((a, b) => a.name.localeCompare(b.name));
  const subjectNameById = new Map(subjectOptions.map((s) => [s.id, s.name]));

  const wantedAds: WantedAdRow[] = (wantedAdRows ?? []).map((ad) => ({
    id: ad.id,
    lookingFor: ad.looking_for,
    subjectId: ad.subject_id,
    subjectName: ad.subject_id ? (subjectNameById.get(ad.subject_id) ?? null) : null,
    mode: ad.mode,
    gradeLevel: ad.grade_level,
    title: ad.title,
    description: ad.description,
    status: ad.status,
  }));

  const wantedAdResponses: WantedAdResponseRow[] = (wantedAdResponseRows ?? []).map((r) => ({
    id: r.id,
    wantedAdId: r.wanted_ad_id,
    responderType: r.responder_type as "teacher" | "class",
    responderName: r.responder_name,
    message: r.message,
    status: r.status as "new" | "read",
    createdLabel: dateFormatter.format(new Date(r.created_at)),
  }));
  const unreadResponsesCount = wantedAdResponses.filter((r) => r.status === "new").length;

  // A few, not many — just enough to show real activity and give writing
  // inspiration, not a full second copy of the /requests board. Excludes
  // this student's own ads (list_public_wanted_ads carries no student_id to
  // filter by, so we exclude by id against the ads already fetched above).
  const ownWantedAdIds = new Set(wantedAds.map((ad) => ad.id));
  const sampleWantedAds: PublicWantedAd[] = (publicWantedAdRows ?? [])
    .filter((row) => !ownWantedAdIds.has(row.id))
    .slice(0, 3)
    .map((row) => ({
      id: row.id,
      lookingFor: row.looking_for as "teacher" | "institute",
      subject: row.subject,
      mode: row.mode as "online" | "physical" | "both" | null,
      gradeLevel: row.grade_level,
      title: row.title,
      description: row.description,
      createdLabel: dateFormatter.format(new Date(row.created_at)),
    }));

  const reviewTargets: ReviewTarget[] = [...joinedOwnerKeys].map((key) => {
    const [ownerType, ownerId] = key.split(":") as ["teacher" | "class", string];
    return { ownerType, ownerId, name: ownerName(ownerType, ownerId) };
  });

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
      userPhotoUrl={profile?.avatar_url ?? null}
      logoutLabel={t("logout")}
      demoRole="student"
      bellKey="wantedAds"
      realtimeWatch={[{ table: "live_class_reminders", filter: `student_id=eq.${userId}` }]}
      groups={[
        {
          items: [{ key: "overview", label: t("tabs.overview") }],
        },
        {
          label: t("groupClasses"),
          items: [
            { key: "classes", label: t("tabs.classes") },
            { key: "live", label: t("tabs.live") },
            { key: "wantedAds", label: t("tabs.wantedAds"), count: unreadResponsesCount },
          ],
        },
        {
          label: t("groupContent"),
          items: [
            { key: "notes", label: t("tabs.notes") },
            { key: "exams", label: t("tabs.exams"), count: examsDueCount },
            { key: "assignments", label: t("tabs.assignments"), count: assignmentsDueCount },
          ],
        },
        {
          label: t("groupAccount"),
          items: [
            { key: "reviews", label: t("tabs.reviews") },
            { key: "profile", label: t("tabs.profile") },
            { key: "settings", label: t("tabs.settings") },
          ],
        },
      ]}
      panels={{
        overview: (
          <OverviewTab
            studentName={fullName}
            classesCount={classesCount}
            nextLiveTitle={nextLive?.title ?? null}
            nextLiveTeacherName={nextLiveTeacherName}
            nextLiveLabel={nextLiveLabel}
            examsDueCount={examsDueCount}
            dueExamTitles={dueExamTitles}
            notesCount={studentNotes.length}
          />
        ),
        classes: <ClassesTab myClasses={myClasses} availableBatches={availableBatches} />,
        live: <LiveClassesTab classes={liveClasses} studentName={fullName} reminderClassIds={reminderClassIds} />,
        wantedAds: (
          <WantedAdsTab
            wantedAds={wantedAds}
            subjectOptions={subjectOptions}
            responses={wantedAdResponses}
            sampleAds={sampleWantedAds}
          />
        ),
        notes: <NotesTab notes={studentNotes} studentName={fullName} />,
        exams: <ExamsTab exams={exams} />,
        assignments: <AssignmentsTab assignments={assignments} />,
        reviews: <ReviewsTab targets={reviewTargets} initialReviews={myReviews} />,
        profile: (
          <ProfileTab
            initialName={fullName}
            initialPhone={profile?.phone ?? ""}
            initialGrade={profile?.grade_level ?? ""}
            initialPhotoUrl={profile?.avatar_url ?? null}
            initialBio={profile?.bio ?? ""}
            initialEducationLevel={profile?.education_level ?? null}
            initialInstitutionName={profile?.institution_name ?? ""}
            initialQualifications={profile?.qualifications ?? []}
            initialWorkExperience={profile?.work_experience ?? []}
            initialSharePhoneWithTeachers={profile?.share_phone_with_teachers ?? true}
            initialSubjects={profile?.subjects ?? []}
            initialLanguages={profile?.languages ?? []}
            initialDateOfBirth={profile?.date_of_birth ?? null}
            initialLocation={profile?.location ?? ""}
            initialLearningGoals={profile?.learning_goals ?? ""}
            initialPreferredMode={profile?.preferred_mode ?? null}
            initialAchievements={profile?.achievements ?? []}
            initialInterests={profile?.interests ?? []}
            initialAvailability={profile?.availability ?? ""}
            classesCount={classesCount}
            email={user!.email ?? ""}
          />
        ),
        settings: (
          <SettingsTab
            initialPhone={profile?.phone ?? ""}
            initialSharePhoneWithTeachers={profile?.share_phone_with_teachers ?? true}
            initialNotificationPrefs={(profile?.notification_prefs as Record<string, boolean>) ?? {}}
            email={user!.email ?? ""}
          />
        ),
      }}
      defaultTab="overview"
    />
  );
}
