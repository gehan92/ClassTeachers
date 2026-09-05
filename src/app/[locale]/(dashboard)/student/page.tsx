import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { NotificationRow } from "@/components/dashboard/notification-bell";
import { OverviewTab } from "@/components/dashboard/student/overview-tab";
import { AnnouncementsPanel, type AnnouncementRow } from "@/components/dashboard/student/announcements-panel";
import { ClassesTab } from "@/components/dashboard/student/classes-tab";
import { LiveClassesTab } from "@/components/dashboard/student/live-classes-tab";
import { NotesTab } from "@/components/dashboard/student/notes-tab";
import { ExamsTab } from "@/components/dashboard/student/exams-tab";
import { AssignmentsTab } from "@/components/dashboard/student/assignments-tab";
import { ReviewsTab } from "@/components/dashboard/student/reviews-tab";
import { ProfileTab } from "@/components/dashboard/student/profile-tab";
import { SettingsTab } from "@/components/dashboard/student/settings-tab";
import { WantedAdsTab } from "@/components/dashboard/student/wanted-ads-tab";
import { SentInquiriesTab } from "@/components/dashboard/student/sent-inquiries-tab";
import type { SentInquiryRow, SentInquiryMessage } from "@/components/dashboard/student/sent-inquiries-tab";
import { ProgressTab } from "@/components/dashboard/student/progress-tab";
import type { ProgressAttendanceRow } from "@/components/dashboard/student/progress-tab";
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
import { StudentOnboardingWizard } from "@/components/onboarding/student-onboarding-wizard";
import type { InstituteTeacherCard, InstituteQuickView } from "@/types/class-profile";

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

  // Onboarding gate (0107) — checked before any of the heavier dashboard
  // queries below run, so an incomplete profile never fetches (let alone
  // renders) real dashboard data. Applies to parent accounts too — they
  // resolve to role "student" under the hood (see signUpAction's comment).
  const { data: gateProfile } = await supabase
    .from("profiles")
    .select(
      "full_name, role, profile_completed_at, date_of_birth, education_level, grade_level, location, preferred_mode, subjects, learning_goals, languages, achievements, interests",
    )
    .eq("id", userId)
    .single();
  if (gateProfile && !gateProfile.profile_completed_at && gateProfile.role !== "admin") {
    return (
      <StudentOnboardingWizard
        initial={{
          fullName: gateProfile.full_name,
          dateOfBirth: gateProfile.date_of_birth ?? "",
          educationLevel: gateProfile.education_level ?? "",
          gradeLevel: gateProfile.grade_level ?? "",
          location: gateProfile.location ?? "",
          preferredMode: gateProfile.preferred_mode ?? "",
          subjects: (gateProfile.subjects ?? []).join(", "),
          learningGoals: gateProfile.learning_goals ?? "",
          languages: (gateProfile.languages ?? []).join(", "),
          achievements: (gateProfile.achievements ?? []).join(", "),
          interests: (gateProfile.interests ?? []).join(", "),
        }}
      />
    );
  }

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
    { data: myInquiryRows },
    { data: attendanceRows },
    { data: notificationRows },
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
      .select("id, owner_type, owner_id, batch_id, title, question_ids, duration_minutes, scheduled_at, reveal_answers")
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("exam_submissions")
      .select("exam_id, status, grade, feedback, submitted_at, mcq_answers, code_answers")
      .eq("student_id", userId),
    supabase
      .from("batches")
      .select("id, owner_type, owner_id, title, mode, location, schedule_note, course_code, is_open_enrollment")
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
      .select("id, looking_for, subject_id, mode, grade_level, medium, class_type, title, description, status")
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
    // Inquiries this student sent (0037) — only reachable at all because
    // they were signed in when they submitted one, which stashed their
    // auth.uid() as inquirer_id (0088 opened read access to that).
    supabase
      .from("inquiries")
      .select("id, owner_type, owner_id, message, created_at")
      .eq("inquirer_id", userId)
      .order("created_at", { ascending: false }),
    // Progress tab (Growth Plan item 4) — attendance was never surfaced to
    // the student at all before this, only ever shown on the teacher side.
    // RLS (0033) already lets a student read their own rows directly, no
    // RPC needed.
    supabase
      .from("attendance_records")
      .select("id, live_class_id, status, marked_at")
      .eq("student_id", userId)
      .order("marked_at", { ascending: false }),
    supabase
      .from("notifications")
      .select("id, type, data, tab, read_at, created_at")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const notifications: NotificationRow[] = (notificationRows ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    data: (n.data as Record<string, unknown>) ?? {},
    tab: n.tab,
    readAt: n.read_at,
    createdAt: n.created_at,
  }));

  // Sidebar "new content" dots — same notifications this page already
  // fetched for the bell, just checked for an unread row of the matching
  // type. Independent of examsDueCount/assignmentsDueCount below, which
  // mean "still due," not "unseen."
  const hasUnreadOfType = (type: string) => notifications.some((n) => n.type === type && !n.readAt);
  const hasNewNotes = hasUnreadOfType("new_note");
  const hasNewExams = hasUnreadOfType("new_exam");
  const hasNewAssignments = hasUnreadOfType("new_assignment");
  const hasNewLive = hasUnreadOfType("new_live_class");

  const fullName = profile?.full_name ?? user!.email ?? "Student";
  const userInitial = fullName.charAt(0).toUpperCase();

  const acceptedEnrollments = (enrollments ?? []).filter((e) => e.status === "accepted");
  const classesCount = acceptedEnrollments.length;
  const submissionByExamId = new Map((submissionRows ?? []).map((s) => [s.exam_id, s]));
  const allExamIds = (examRows ?? []).map((e) => e.id);
  // Exactly the exams this student is allowed to see the answer key for —
  // graded AND the teacher opted the exam into reveal_answers (0079). Passed
  // to get_revealed_question_answers below rather than fetching for every
  // exam and filtering client-side, since the RPC itself re-checks both
  // conditions server-side regardless (see 0085's comment on why that
  // recheck can't be skipped).
  const revealedExamIds = (examRows ?? [])
    .filter((e) => e.reveal_answers && submissionByExamId.get(e.id)?.status === "graded")
    .map((e) => e.id);
  const teacherIds = acceptedEnrollments.filter((e) => e.owner_type === "teacher").map((e) => e.owner_id);
  const classIds = acceptedEnrollments.filter((e) => e.owner_type === "class").map((e) => e.owner_id);
  // Deduped separately from the arrays above — a multi-batch institute
  // enrollment (0092) can repeat the same owner_id across several accepted
  // rows, and each of these two feeds a one-row-per-id fetch below (the
  // class workspace's "quick view" popups), not a per-batch one.
  const acceptedTeacherOwnerIds = [...new Set(teacherIds)];
  const acceptedClassOwnerIds = [...new Set(classIds)];
  const teacherOwnerIds = new Set<string>();
  const classOwnerIds = new Set<string>();
  for (const e of enrollments ?? []) (e.owner_type === "teacher" ? teacherOwnerIds : classOwnerIds).add(e.owner_id);
  for (const b of allBatches ?? []) (b.owner_type === "teacher" ? teacherOwnerIds : classOwnerIds).add(b.owner_id);
  for (const n of noteRows ?? []) (n.owner_type === "teacher" ? teacherOwnerIds : classOwnerIds).add(n.owner_id);
  const submissionPhotoPaths = (assignmentSubmissionRows ?? []).flatMap((s) => s.photo_urls ?? []);
  const assignmentFilePaths = (assignmentRows ?? []).map((a) => a.file_path);

  // An inquiry target isn't necessarily someone the student has joined —
  // that's the whole point of inquiries — so it can't reuse
  // get_enrolled_teacher_names below (relationship-gated). class_profiles'
  // own SELECT policy is already public for any approved+published row
  // (0036), so class targets fold straight into the existing lookup;
  // teacher targets not already covered by an enrollment get resolved
  // separately via get_public_teacher_profile (masked name, same as what
  // the student already saw when they sent the inquiry).
  const inquiryOnlyTeacherIds = new Set<string>();
  for (const inq of myInquiryRows ?? []) {
    if (inq.owner_type === "class") classOwnerIds.add(inq.owner_id);
    else if (!teacherOwnerIds.has(inq.owner_id)) inquiryOnlyTeacherIds.add(inq.owner_id);
  }

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
    { data: revealedAnswerRows },
    inquiryOnlyTeacherProfiles,
    { data: myInquiryMessageRows },
    { data: announcementRows },
    teacherProfileResults,
    { data: classProfileDetailRows },
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
      : Promise.resolve({ data: [] as { id: string; full_name: string; is_campus_lecturer: boolean }[] }),
    classOwnerIds.size
      ? supabase.from("class_profiles").select("id, name").in("id", [...classOwnerIds])
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    submissionPhotoPaths.length > 0
      ? supabase.storage.from("submissions").createSignedUrls(submissionPhotoPaths, 3600)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
    assignmentFilePaths.length > 0
      ? supabase.storage.from("assignments").createSignedUrls(assignmentFilePaths, 3600)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
    // correct_option_ids/sample_answer are revoke()d from ordinary SELECT on
    // question_bank_items (0085) — this RPC is the only path back to them,
    // and it only returns a row for an exam already confirmed graded +
    // revealed above, re-checked server-side.
    revealedExamIds.length
      ? supabase.rpc("get_revealed_question_answers", { p_exam_ids: revealedExamIds })
      : Promise.resolve({
          data: [] as { exam_id: string; question_id: string; correct_option_ids: string[]; sample_answer: string | null }[],
        }),
    // No batch equivalent of get_public_teacher_profile exists — one call
    // per distinct id, but this is bounded by how many different teachers
    // this student has ever inquired about (typically a handful).
    Promise.all(
      [...inquiryOnlyTeacherIds].map((id) => supabase.rpc("get_public_teacher_profile", { p_teacher_id: id })),
    ),
    myInquiryRows?.length
      ? supabase
          .from("inquiry_messages")
          .select("id, inquiry_id, sender_role, body, created_at")
          .in(
            "inquiry_id",
            myInquiryRows.map((i) => i.id),
          )
          .order("created_at", { ascending: true })
      : Promise.resolve({
          data: [] as { id: string; inquiry_id: string; sender_role: "owner" | "inquirer"; body: string; created_at: string }[],
        }),
    // Institute Blueprint step 6 — "one announcement reaching students
    // across every class." Only institutes the student is actually
    // accepted into (classIds, not classOwnerIds — a pending/declined
    // request shouldn't surface an institute's internal notices).
    classIds.length
      ? supabase
          .from("announcements")
          .select("id, owner_id, title, body, created_at")
          .eq("owner_type", "class")
          .in("owner_id", classIds)
          .order("created_at", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] as { id: string; owner_id: string; title: string; body: string; created_at: string }[] }),
    // Class workspace "quick view" popups (student dashboard equivalent of
    // the institute dashboard's own teacher quick-view) — one row per
    // distinct enrolled teacher, same bounded-by-how-many-classes-this-
    // student-is-actually-in shape as inquiryOnlyTeacherProfiles above.
    // display_name comes back masked (mask_display_name is unconditional on
    // this RPC) — deliberately ignored below in favor of teacherNameById,
    // which already holds the real name for an accepted enrollment.
    acceptedTeacherOwnerIds.length
      ? Promise.all(
          acceptedTeacherOwnerIds.map((id) => supabase.rpc("get_public_teacher_profile", { p_teacher_id: id })),
        )
      : Promise.resolve([]),
    // class_profiles' SELECT policy is already public for any approved row
    // (0005) — no RPC needed, same reasoning classOwners above relies on.
    acceptedClassOwnerIds.length
      ? supabase
          .from("class_profiles")
          .select("id, description, photo_url, location, class_type, established, institution_verified")
          .in("id", acceptedClassOwnerIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            description: string | null;
            photo_url: string | null;
            location: string | null;
            class_type: "physical" | "online" | "both" | null;
            established: string | null;
            institution_verified: boolean;
          }[],
        }),
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
          .select("id, question_text, type, marks, options, multi_select, code_format, question_image_path")
          .in("id", allQuestionIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            question_text: string;
            type: "mcq" | "essay" | "code";
            marks: number;
            options: unknown;
            multi_select: boolean;
            code_format: boolean;
            question_image_path: string | null;
          }[],
        }),
  ]);

  const revealedAnswersByKey = new Map(
    (revealedAnswerRows ?? []).map((r) => [`${r.exam_id}:${r.question_id}`, r]),
  );

  const visibleIdSet = new Set(visibleLiveClassIds ?? []);
  const liveClassRows = allLiveClassRows.filter((r) => visibleIdSet.has(r.id));
  const nextLive = liveClassRows.find((row) => isFuture(row.scheduled_at));
  const nextLiveLabel = nextLive ? scheduleFormatter.format(new Date(nextLive.scheduled_at)) : null;
  const liveClassIds = liveClassRows.map((r) => r.id);

  // correct_option_ids/sample_answer are no longer selected above at all —
  // they're revoke()d at the database (0085) — so questionById never carries
  // them. revealedAnswersByKey (built above from get_revealed_question_
  // answers, keyed by exam+question) is the only source for them, and it
  // only ever contains entries for an exam already confirmed graded +
  // revealed, so the exams.map below can look them up unconditionally.
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
  const campusLecturerTeacherIds = new Set(
    (teacherOwners ?? []).filter((p) => p.is_campus_lecturer).map((p) => p.id),
  );
  for (const { data: rows } of inquiryOnlyTeacherProfiles) {
    const teacher = rows?.[0];
    if (teacher?.display_name) teacherNameById.set(teacher.id, teacher.display_name);
  }
  const classNameById = new Map((classOwners ?? []).map((c) => [c.id, c.name]));
  function ownerName(ownerType: "teacher" | "class", ownerId: string) {
    return (ownerType === "teacher" ? teacherNameById.get(ownerId) : classNameById.get(ownerId)) ?? "—";
  }

  // Class workspace "quick view" popups (student dashboard) — reuses the
  // exact InstituteTeacherCard shape the institute dashboard's own teacher
  // popup already renders, so both sides of the same feature share one
  // component (TeacherQuickProfile) with zero duplication.
  const teacherProfiles: InstituteTeacherCard[] = teacherProfileResults.flatMap(({ data }) => {
    const row = data?.[0];
    if (!row) return [];
    return [
      {
        id: row.id,
        displayName: teacherNameById.get(row.id) ?? row.display_name ?? "—",
        photoUrl: row.photo_url,
        headline: row.headline,
        subjects: row.subjects ?? [],
        rating: Number(row.rating),
        reviewCount: Number(row.review_count),
        isCampusLecturer: row.is_campus_lecturer,
        bio: row.bio,
        qualifications: row.qualifications ?? [],
        workExperience: row.work_experience ?? [],
        experienceYears: row.experience_years,
        languages: row.languages ?? [],
        academicTitle: row.academic_title,
        institution: row.institution,
        publications: row.publications ?? [],
      },
    ];
  });

  const instituteProfiles: InstituteQuickView[] = (classProfileDetailRows ?? []).map((row) => ({
    id: row.id,
    name: classNameById.get(row.id) ?? "—",
    photoUrl: row.photo_url,
    description: row.description,
    location: row.location,
    classType: row.class_type,
    establishedText: row.established,
    verified: row.institution_verified,
  }));

  const announcements: AnnouncementRow[] = (announcementRows ?? []).map((a) => ({
    id: a.id,
    instituteName: classNameById.get(a.owner_id) ?? "—",
    title: a.title,
    body: a.body,
    createdLabel: dateFormatter.format(new Date(a.created_at)),
  }));

  // Deliberately built from allLiveClassRows (every live class ever held by
  // an enrolled teacher/class), not the visibility-filtered liveClassRows
  // below — attendance is a historical record, a past session shouldn't
  // disappear from it just because it's no longer "upcoming".
  const liveClassInfoById = new Map(allLiveClassRows.map((r) => [r.id, r]));
  const attendanceStatusByLiveClassId = new Map((attendanceRows ?? []).map((r) => [r.live_class_id, r.status]));
  const attendanceHistory: ProgressAttendanceRow[] = (attendanceRows ?? []).flatMap((row) => {
    const session = liveClassInfoById.get(row.live_class_id);
    if (!session) return [];
    return [
      {
        id: row.id,
        sessionTitle: session.title,
        teacherName: ownerName(session.ownerType, session.owner_id),
        dateLabel: dateFormatter.format(new Date(session.scheduled_at)),
        status: row.status,
      },
    ];
  });
  const presentCount = attendanceHistory.filter((a) => a.status !== "absent").length;
  const attendanceRatePercent =
    attendanceHistory.length > 0 ? Math.round((presentCount / attendanceHistory.length) * 100) : null;

  const liveClasses: StudentLiveClassRow[] = liveClassRows.map((row) => ({
    id: row.id,
    title: row.title,
    teacherName: ownerName(row.ownerType, row.owner_id),
    ownerId: row.owner_id,
    ownerType: row.ownerType,
    batchId: row.batch_id,
    scheduledAtIso: row.scheduled_at,
    scheduledLabel: scheduleFormatter.format(new Date(row.scheduled_at)),
    durationMinutes: row.duration_minutes,
    mode: row.mode,
    joinLink: joinLinkByClassId.get(row.id) ?? null,
    attendanceStatus: attendanceStatusByLiveClassId.get(row.id) ?? null,
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
  // A student can now hold more than one batch at the same institute
  // (0091/0092), so "already joined" for a class-owned batch has to be
  // scoped to that specific batch — otherwise joining one class at an
  // institute would wrongly hide every other class it offers. Teacher-
  // owned batches keep the old owner-level behavior (joinedOwnerKeys
  // above): a student still only ever has one relationship with a given
  // teacher, whichever of their batches it's through.
  const joinedClassBatchIds = new Set(
    (enrollments ?? [])
      .filter((e) => e.status !== "declined" && e.owner_type === "class" && e.batch_id)
      .map((e) => e.batch_id as string),
  );
  const joinedClassOwnerKeysWithNoBatch = new Set(
    (enrollments ?? [])
      .filter((e) => e.status !== "declined" && e.owner_type === "class" && !e.batch_id)
      .map((e) => e.owner_id),
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
        batchId: e.batch_id,
        batchTitle: batch?.title ?? null,
        ownerName: ownerName(e.owner_type, e.owner_id),
        ownerType: e.owner_type,
        mode: batch?.mode ?? null,
        scheduleNote: batch?.schedule_note ?? null,
        status: e.status,
        isCampusLecturer: e.owner_type === "teacher" && campusLecturerTeacherIds.has(e.owner_id),
      };
    });

  const availableBatches: AvailableBatchRow[] = (allBatches ?? [])
    .filter((b) =>
      b.owner_type === "teacher"
        ? !joinedOwnerKeys.has(`teacher:${b.owner_id}`)
        : !joinedClassBatchIds.has(b.id) && !joinedClassOwnerKeysWithNoBatch.has(b.owner_id),
    )
    .map((b) => ({
      id: b.id,
      title: b.title,
      ownerName: ownerName(b.owner_type, b.owner_id),
      mode: b.mode,
      location: b.location,
      scheduleNote: b.schedule_note,
      isCampusLecturer: b.owner_type === "teacher" && campusLecturerTeacherIds.has(b.owner_id),
      courseCode: b.course_code,
      isOpenEnrollment: b.is_open_enrollment,
    }));

  const studentNotes: StudentNoteRow[] = (noteRows ?? [])
    .filter((n) => !n.batch_id || enrolledBatchIds.has(n.batch_id))
    .map((n) => ({
      id: n.id,
      title: n.title,
      batchId: n.batch_id,
      batchTitle: n.batch_id ? (batchById.get(n.batch_id)?.title ?? null) : null,
      ownerName: ownerName(n.owner_type, n.owner_id),
      ownerId: n.owner_id,
      ownerType: n.owner_type,
      pageCount: n.page_count,
    }));

  const questionImageUrlByPath = new Map<string, string>();
  for (const entry of signedQuestionImages ?? []) {
    if (entry.path && entry.signedUrl) questionImageUrlByPath.set(entry.path, entry.signedUrl);
  }

  const exams: StudentExamRow[] = visibleExamRows.map((e) => {
    const submission = submissionByExamId.get(e.id);
    // Only forward the answer key into the browser once this exact exam is
    // both graded and opted in via reveal_answers (0079) — see the comment
    // above questionById for why this can't just be "always selected".
    const canReveal = e.reveal_answers && submission?.status === "graded";
    return {
      id: e.id,
      title: e.title,
      teacherName: ownerName(e.owner_type, e.owner_id),
      ownerId: e.owner_id,
      ownerType: e.owner_type,
      batchId: e.batch_id,
      durationMinutes: e.duration_minutes,
      scheduledLabel: e.scheduled_at ? scheduleFormatter.format(new Date(e.scheduled_at)) : "—",
      isOpen: !e.scheduled_at || !isFuture(e.scheduled_at),
      questions: e.question_ids
        .map((qid): StudentExamQuestion | null => {
          const q = questionById.get(qid);
          if (!q) return null;
          const revealed = revealedAnswersByKey.get(`${e.id}:${qid}`);
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
            multiSelect: q.multi_select,
            codeFormat: q.code_format,
            correctOptionIds: revealed?.correct_option_ids,
            sampleAnswer: revealed?.sample_answer ?? undefined,
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
      reviewAnswers: canReveal
        ? { mcqAnswers: submission!.mcq_answers ?? {}, codeAnswers: submission!.code_answers ?? {} }
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
      ownerId: a.owner_id,
      ownerType: a.owner_type,
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
    medium: ad.medium,
    classType: ad.class_type,
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
      medium: row.medium as "english" | "sinhala" | "tamil" | "other",
      classType: row.class_type as "new" | "revision",
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

  const inquiryMessagesByInquiryId = new Map<string, SentInquiryMessage[]>();
  for (const row of myInquiryMessageRows ?? []) {
    const list = inquiryMessagesByInquiryId.get(row.inquiry_id) ?? [];
    list.push({
      id: row.id,
      senderRole: row.sender_role,
      body: row.body,
      createdLabel: dateFormatter.format(new Date(row.created_at)),
    });
    inquiryMessagesByInquiryId.set(row.inquiry_id, list);
  }
  const myInquiries: SentInquiryRow[] = (myInquiryRows ?? []).map((row) => ({
    id: row.id,
    ownerType: row.owner_type as "teacher" | "class",
    targetName: ownerName(row.owner_type as "teacher" | "class", row.owner_id),
    message: row.message,
    messages: inquiryMessagesByInquiryId.get(row.id) ?? [],
    createdLabel: dateFormatter.format(new Date(row.created_at)),
  }));

  return (
    <DashboardShell
      userLabel={fullName}
      userInitial={userInitial}
      userPhotoUrl={profile?.avatar_url ?? null}
      logoutLabel={t("logout")}
      demoRole="student"
      notifications={notifications}
      realtimeWatch={[
        { table: "live_class_reminders", filter: `student_id=eq.${userId}` },
        { table: "notifications", filter: `recipient_id=eq.${userId}` },
      ]}
      groups={[
        {
          items: [
            { key: "overview", label: t("tabs.overview") },
            { key: "progress", label: t("tabs.progress") },
          ],
        },
        {
          label: t("groupClasses"),
          items: [
            { key: "classes", label: t("tabs.classes") },
          ],
        },
        {
          label: t("groupContent"),
          items: [
            { key: "live", label: t("tabs.live"), hasNew: hasNewLive },
            { key: "notes", label: t("tabs.notes"), hasNew: hasNewNotes },
            { key: "exams", label: t("tabs.exams"), count: examsDueCount, hasNew: hasNewExams },
            { key: "assignments", label: t("tabs.assignments"), count: assignmentsDueCount, hasNew: hasNewAssignments },
          ],
        },
        {
          label: t("groupMore"),
          items: [
            { key: "reviews", label: t("tabs.reviews") },
            { key: "inquiries", label: t("tabs.inquiries") },
            { key: "wantedAds", label: t("tabs.wantedAds"), count: unreadResponsesCount },
            { key: "profile", label: t("tabs.profile") },
            { key: "settings", label: t("tabs.settings") },
          ],
        },
      ]}
      panels={{
        overview: (
          <>
            <AnnouncementsPanel announcements={announcements} />
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
          </>
        ),
        progress: (
          <ProgressTab
            attendance={attendanceHistory}
            attendanceRatePercent={attendanceRatePercent}
            exams={exams}
            assignments={assignments}
          />
        ),
        classes: (
          <ClassesTab
            myClasses={myClasses}
            availableBatches={availableBatches}
            notes={studentNotes}
            exams={exams}
            assignments={assignments}
            liveClasses={liveClasses}
            reminderClassIds={reminderClassIds}
            studentName={fullName}
            teacherProfiles={teacherProfiles}
            instituteProfiles={instituteProfiles}
          />
        ),
        live: <LiveClassesTab classes={liveClasses} studentName={fullName} reminderClassIds={reminderClassIds} />,
        wantedAds: (
          <WantedAdsTab
            wantedAds={wantedAds}
            subjectOptions={subjectOptions}
            responses={wantedAdResponses}
            sampleAds={sampleWantedAds}
          />
        ),
        inquiries: <SentInquiriesTab inquiries={myInquiries} />,
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
