import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { NotificationRow } from "@/components/dashboard/notification-bell";
import { OverviewTab } from "@/components/dashboard/teacher/overview-tab";
import { ProfileTab } from "@/components/dashboard/teacher/profile-tab";
import { NotesTab } from "@/components/dashboard/teacher/notes-tab";
import { ClassesTab } from "@/components/dashboard/teacher/classes-tab";
import { QuestionBankTab } from "@/components/dashboard/teacher/question-bank-tab";
import { ExamsTab } from "@/components/dashboard/teacher/exams-tab";
import { AssignmentsTab } from "@/components/dashboard/teacher/assignments-tab";
import { LiveClassesTab } from "@/components/dashboard/teacher/live-classes-tab";
import { StudentsTab } from "@/components/dashboard/teacher/students-tab";
import { AttendanceTab } from "@/components/dashboard/teacher/attendance-tab";
import { AnalyticsTab } from "@/components/dashboard/teacher/analytics-tab";
import type {
  AnalyticsExamResultRow,
  AnalyticsAttendanceRow,
  AnalyticsBatchOption,
} from "@/components/dashboard/teacher/analytics-tab";
import { ReviewsTab } from "@/components/dashboard/teacher/reviews-tab";
import { InquiriesTab } from "@/components/dashboard/inquiries-tab";
import { WantedAdsBrowseTab } from "@/components/dashboard/wanted-ads-browse-tab";
import { AdvertisementTab } from "@/components/dashboard/teacher/advertisement-tab";
import type { TeacherAdBatchRow } from "@/components/dashboard/teacher/advertisement-tab";
import type { AdHistoryRow } from "@/components/dashboard/ad-history-list";
import { SettingsTab, type InstituteInviteRow } from "@/components/dashboard/teacher/settings-tab";
import { TeacherProfileView } from "@/components/features/teacher-profile-view";
import { TeacherOnboardingWizard } from "@/components/onboarding/teacher-onboarding-wizard";
import { createClient } from "@/lib/supabase/server";
import { createDateFormatter, createScheduleFormatter } from "@/lib/format-date";
import type { TeacherProfileDetail } from "@/types/teacher-profile";
import type { ReferralRow } from "@/components/dashboard/refer-earn-panel";
import type {
  TeacherBatchRow,
  TeacherBatchOption,
  BatchRosterEntry,
  InstituteTaughtBatchRow,
} from "@/components/dashboard/teacher/classes-tab";
import type { TeacherNoteRow } from "@/components/dashboard/teacher/notes-tab";
import type { TeacherStudentRow, TeacherJoinRequestRow } from "@/components/dashboard/teacher/students-tab";
import type { TeacherLiveClassRow } from "@/components/dashboard/teacher/live-classes-tab";
import type { AttendanceSession } from "@/components/dashboard/teacher/attendance-tab";
import type { QuestionBankItem } from "@/types/dashboard-exams";
import type { TeacherExamRow, ExamSubmissionRow } from "@/components/dashboard/teacher/exams-tab";
import type {
  TeacherAssignmentRow,
  AssignmentSubmissionRow,
  TeacherLessonOption,
} from "@/components/dashboard/teacher/assignments-tab";
import type { InquiryRow, InquiryMessageRow } from "@/components/dashboard/inquiries-tab";
import type { WantedAdBrowseRow } from "@/components/dashboard/wanted-ads-browse-tab";

type RawQuestionOption = { id: string; text: string; imagePath?: string };

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

  // Onboarding gate (0107) — checked before any of the heavier dashboard
  // queries below run, so an incomplete profile never fetches (let alone
  // renders) real dashboard data. profile_completed_at lives on `profiles`
  // regardless of role; existing accounts were backfilled to non-null in
  // the same migration, so this only affects accounts created afterward.
  const [{ data: gateProfile }, { data: gateTeacherProfile }] = await Promise.all([
    supabase.from("profiles").select("role, profile_completed_at").eq("id", userId).single(),
    supabase
      .from("teacher_profiles")
      .select("headline, bio, class_type, institution, academic_title, qualifications, work_experience, publications, experience_years, location, languages")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  if (gateProfile && !gateProfile.profile_completed_at && gateProfile.role !== "admin") {
    const isCampusLecturer = gateProfile.role === "campus_lecturer";
    return (
      <TeacherOnboardingWizard
        isCampusLecturer={isCampusLecturer}
        initial={{
          headline: gateTeacherProfile?.headline ?? "",
          bio: gateTeacherProfile?.bio ?? "",
          classType: gateTeacherProfile?.class_type ?? "both",
          institution: gateTeacherProfile?.institution ?? "",
          academicTitle: gateTeacherProfile?.academic_title ?? "",
          qualifications: (gateTeacherProfile?.qualifications ?? []).join(", "),
          workExperience: (gateTeacherProfile?.work_experience ?? []).join(", "),
          publications: (gateTeacherProfile?.publications ?? []).join(", "),
          experienceYears: gateTeacherProfile?.experience_years?.toString() ?? "",
          location: gateTeacherProfile?.location ?? "",
          languages: (gateTeacherProfile?.languages ?? []).join(", "),
          hourlyRate: "",
          monthlyRate: "",
        }}
      />
    );
  }

  const dateFormatter = createDateFormatter(locale);
  const scheduleFormatter = createScheduleFormatter(locale);

  // Stage 1 — every query below only needs userId, not each other's
  // results, so they all run as one batch instead of a chain of sequential
  // round trips. This function re-runs in full on every page load AND
  // every router.refresh() after a mutation (see useDashboardRefresh), so
  // collapsing that chain here is what actually makes the dashboard feel
  // fast rather than just showing a loading indicator sooner.
  const [
    { data: profile },
    { data: teacherProfile },
    { data: priceRow },
    { data: adRow },
    { count: studentsCount },
    { data: reviewRows },
    { data: examRows },
    { data: pendingSubmissionRows },
    { data: inquiryRows },
    { data: wantedAdRows },
    { data: myReviewRows },
    { data: batchRows },
    { data: enrollmentRows },
    { data: noteRows },
    { data: subjectLinkRows },
    { data: batchAdRows },
    { data: questionRows },
    { data: questionAnswerRows },
    { data: examDetailRows },
    { data: liveClassRows },
    { data: assignmentRows },
    { data: liveProfilePhone },
    { data: referralCodeValue },
    { data: myReferralRows },
    { data: instituteInviteRows },
    { data: assignedInstituteBatchRows },
    { data: managedBatchStudentRows },
    { data: notificationRows },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, notification_prefs, role").eq("id", userId).single(),
    supabase.from("teacher_profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("prices").select("hourly_rate, monthly_rate").eq("owner_type", "teacher").eq("owner_id", userId).maybeSingle(),
    supabase
      .from("advertisements")
      .select("content, title")
      .eq("owner_type", "teacher")
      .eq("owner_id", userId)
      .eq("placement", "own_profile")
      .maybeSingle(),
    supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("owner_type", "teacher")
      .eq("owner_id", userId)
      .eq("status", "accepted"),
    supabase.from("reviews").select("rating").eq("target_type", "teacher").eq("target_id", userId),
    // No owner filter — RLS (can_manage_content, 0093) already scopes this
    // to exams this teacher owns OR manages via an assigned institute
    // batch, and pendingSubmissionsCount below should count both.
    supabase.from("exams").select("id"),
    supabase.from("exam_submissions").select("id, exam_id").eq("status", "pending"),
    supabase
      .from("inquiries")
      .select("id, sender_name, sender_contact, message, status, created_at")
      .eq("owner_type", "teacher")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    supabase.rpc("list_wanted_ads_for_responder"),
    // Same RPC the public /teacher/[id] page uses — masked reviewer names,
    // consistent with what this teacher's own public profile shows.
    supabase.rpc("list_public_reviews", { p_target_type: "teacher", p_target_id: userId }),
    supabase
      .from("batches")
      .select(
        "id, title, mode, class_size_type, location, schedule_note, grade_band, status, subject_id, hourly_rate, monthly_rate, course_code, is_open_enrollment, capacity",
      )
      .eq("owner_type", "teacher")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("enrollments")
      .select("id, student_id, batch_id, joined_at, status")
      .eq("owner_type", "teacher")
      .eq("owner_id", userId),
    // No owner filter on notes/question_bank_items/exams/live_classes/
    // assignments below — 0093/0094 already scope every one of these
    // tables' RLS to "owner OR admin OR a teacher assigned to the batch via
    // can_manage_content", so an unfiltered select naturally returns this
    // teacher's own content plus whatever they manage at a linked institute
    // batch, with zero risk of over-fetching (RLS is the real boundary, not
    // this filter — same trust-RLS pattern used throughout this codebase).
    supabase
      .from("notes")
      .select("id, title, batch_id, page_count, is_public, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("subject_links").select("subject_id").eq("owner_type", "teacher").eq("owner_id", userId),
    // Batch-scoped "search results" ads (0039) — one per batch, distinct
    // from the single own_profile promo box fetched above.
    supabase
      .from("advertisements")
      .select("id, batch_id, title, content, status")
      .eq("owner_type", "teacher")
      .eq("owner_id", userId)
      .eq("placement", "search_results"),
    supabase
      .from("question_bank_items")
      .select(
        "id, question_text, topic, grade_band, batch_id, type, difficulty, marks, language, options, multi_select, code_format, question_image_path",
      )
      .order("created_at", { ascending: false }),
    // correct_option_id/correct_option_ids/sample_answer are revoke()d from
    // ordinary SELECT on question_bank_items (0085) — even for the owning
    // teacher — precisely so a direct table query can never read the answer
    // key. This RPC is the one legitimate path back to it, scoped to
    // exactly the questions this caller owns (or all of them, if admin).
    supabase.rpc("get_my_question_answers"),
    supabase
      .from("exams")
      .select("id, title, question_ids, duration_minutes, scheduled_at, batch_id, published, reveal_answers")
      .order("scheduled_at", { ascending: false }),
    supabase
      .from("live_classes")
      .select("id, title, mode, location, scheduled_at, duration_minutes, batch_id")
      .neq("status", "cancelled")
      .order("scheduled_at", { ascending: false }),
    supabase
      .from("assignments")
      .select("id, title, batch_id, lesson_id, file_path, due_at")
      .order("created_at", { ascending: false }),
    // Same RPC the public /teacher/[id] page uses to gate the phone number
    // — called here too so the dashboard's inline "view live page" shows
    // the number exactly as this teacher (viewing their own profile) would.
    supabase.rpc("get_teacher_contact", { p_teacher_id: userId }),
    // Refer & Earn panel (Settings tab) — lazily assigns a code the first
    // time it's asked for (referrals, 0089), nothing to backfill up front.
    supabase.rpc("ensure_referral_code"),
    supabase.rpc("list_my_referrals"),
    // Institute Blueprint step 1 (0091) — invites this teacher hasn't
    // responded to yet. Surfaced in the Settings tab.
    supabase.from("class_teachers").select("class_id, joined_at").eq("teacher_id", userId).eq("status", "pending"),
    // Institute Blueprint step 3b — batches this teacher is assigned to
    // inside an institute (0091's taught_by_teacher_id), offered as a
    // content target alongside their own batches in notes/exams/live-
    // classes/question-bank/assignments.
    supabase
      .from("batches")
      .select("id, title, owner_id, mode, location, schedule_note")
      .eq("taught_by_teacher_id", userId),
    // Institute Blueprint step 3b, completed — resolves every accepted
    // student's name/phone across every institute batch this teacher
    // manages (0101), the piece get_roster_student_info (0032) never
    // covered since it only opens up for the institute's own owner.
    supabase.rpc("get_managed_batch_student_info"),
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

  // Stage 2 — everything here needs an id list derived from a stage-1
  // result, but nothing here depends on anything else in this stage, so
  // it's still one batch rather than seven more sequential round trips.
  const subjectIds = (subjectLinkRows ?? []).map((s) => s.subject_id);
  const studentIds = [...new Set((enrollmentRows ?? []).map((e) => e.student_id))];
  const questionImagePaths = new Set<string>();
  for (const q of questionRows ?? []) {
    if (q.question_image_path) questionImagePaths.add(q.question_image_path);
    for (const option of (q.options as RawQuestionOption[] | null) ?? []) {
      if (option.imagePath) questionImagePaths.add(option.imagePath);
    }
  }
  const examDetailIds = (examDetailRows ?? []).map((e) => e.id);
  const liveClassIds = (liveClassRows ?? []).map((c) => c.id);
  const assignmentFilePaths = (assignmentRows ?? []).map((a) => a.file_path);
  const assignmentIds = (assignmentRows ?? []).map((a) => a.id);
  const inquiryIds = (inquiryRows ?? []).map((i) => i.id);
  // Institute Blueprint step 3b — the institute names behind
  // assignedInstituteBatchRows, needed to label each assigned batch
  // clearly (e.g. "Horizon Institute — A/L Maths") everywhere it appears:
  // content-target selectors, batch titles on notes/exams/etc., and the
  // Classes tab's own "Teaching at institutes" section.
  const assignedInstituteIds = [...new Set((assignedInstituteBatchRows ?? []).map((row) => row.owner_id))];

  const [
    { data: subjectRows },
    { data: studentProfiles },
    { data: signedQuestionImages },
    { data: submissionDetailRows },
    { data: liveClassLinkRows },
    { data: attendanceRows },
    { data: participantRows },
    { data: signedAssignmentUrls },
    { data: assignmentSubmissionRows },
    { data: inquiryMessageRows },
    { data: assignedInstituteRows },
  ] = await Promise.all([
    subjectIds.length
      ? supabase.from("subjects").select("id, translations, grade_band").in("id", subjectIds)
      : Promise.resolve({ data: [] as { id: string; translations: unknown; grade_band: string | null }[] }),
    // Plain `profiles` select would return zero rows here — its only RLS
    // policy is "your own row or admin" (0003). This RPC (0032) opens it up
    // for any student who has a relationship (accepted or a pending
    // request) with this teacher — the owner needs to see who a request is
    // *from* to decide whether to accept it, not just who's already an
    // accepted student.
    studentIds.length
      ? supabase.rpc("get_roster_student_info", { p_student_ids: studentIds })
      : Promise.resolve({ data: [] as { id: string; full_name: string; phone: string | null }[] }),
    questionImagePaths.size > 0
      ? supabase.storage.from("question-images").createSignedUrls([...questionImagePaths], 3600)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
    examDetailIds.length
      ? supabase
          .from("exam_submissions")
          .select(
            "id, exam_id, student_id, photo_urls, status, grade, feedback, submitted_at, mcq_score, mcq_max_score, code_answers",
          )
          .in("exam_id", examDetailIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            exam_id: string;
            student_id: string;
            photo_urls: string[];
            status: "pending" | "graded";
            grade: number | null;
            feedback: string | null;
            submitted_at: string;
            mcq_score: number | null;
            mcq_max_score: number | null;
            code_answers: Record<string, string>;
          }[],
        }),
    liveClassIds.length
      ? supabase.from("live_class_links").select("live_class_id, join_link").in("live_class_id", liveClassIds)
      : Promise.resolve({ data: [] as { live_class_id: string; join_link: string }[] }),
    liveClassIds.length
      ? supabase.from("attendance_records").select("live_class_id, student_id, status").in("live_class_id", liveClassIds)
      : Promise.resolve({ data: [] as { live_class_id: string; student_id: string; status: "present" | "absent" | "late" }[] }),
    liveClassIds.length
      ? supabase.from("live_class_participants").select("live_class_id, student_id").in("live_class_id", liveClassIds)
      : Promise.resolve({ data: [] as { live_class_id: string; student_id: string }[] }),
    assignmentFilePaths.length > 0
      ? supabase.storage.from("assignments").createSignedUrls(assignmentFilePaths, 3600)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
    assignmentIds.length
      ? supabase
          .from("assignment_submissions")
          .select("id, assignment_id, student_id, photo_urls, status, grade, feedback, submitted_at")
          .in("assignment_id", assignmentIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            assignment_id: string;
            student_id: string;
            photo_urls: string[];
            status: "pending" | "graded";
            grade: number | null;
            feedback: string | null;
            submitted_at: string;
          }[],
        }),
    inquiryIds.length
      ? supabase
          .from("inquiry_messages")
          .select("id, inquiry_id, sender_role, body, created_at")
          .in("inquiry_id", inquiryIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({
          data: [] as { id: string; inquiry_id: string; sender_role: "owner" | "inquirer"; body: string; created_at: string }[],
        }),
    assignedInstituteIds.length
      ? supabase.from("class_profiles").select("id, name").in("id", assignedInstituteIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  // Stage 3 — signed URLs for submission photos, only knowable once stage 2
  // returned the rows that name those photo paths. Last stage: both queries
  // are independent of each other, so still one round trip, not two.
  const allPhotoPaths = (submissionDetailRows ?? []).flatMap((s) => s.photo_urls);
  const allAssignmentPhotoPaths = (assignmentSubmissionRows ?? []).flatMap((s) => s.photo_urls);

  const [{ data: signedUrls }, { data: signedPhotoUrls }] = await Promise.all([
    allPhotoPaths.length > 0
      ? supabase.storage.from("submissions").createSignedUrls(allPhotoPaths, 3600)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
    allAssignmentPhotoPaths.length > 0
      ? supabase.storage.from("submissions").createSignedUrls(allAssignmentPhotoPaths, 3600)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
  ]);

  // Everything below is pure computation over already-fetched data — no
  // more round trips from here on.

  const fullName = profile?.full_name ?? user!.email ?? "Teacher";
  const userInitial = fullName.charAt(0).toUpperCase();
  const isCampusLecturer = profile?.role === "campus_lecturer";

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
    title: row.title,
    description: row.description,
    createdLabel: dateFormatter.format(new Date(row.created_at)),
    myResponse: row.my_response,
  }));

  const examIds = new Set((examRows ?? []).map((e) => e.id));
  const pendingSubmissionsCount = (pendingSubmissionRows ?? []).filter((s) => examIds.has(s.exam_id)).length;
  const averageRating = reviewRows?.length
    ? (reviewRows.reduce((sum, r) => sum + r.rating, 0) / reviewRows.length).toFixed(1)
    : null;

  const reviews = (myReviewRows ?? []).map((r) => ({
    id: r.id,
    author: r.author ?? "Anonymous",
    date: dateFormatter.format(new Date(r.created_at)),
    rating: r.rating,
    body: r.body ?? "",
    reply: r.reply ?? undefined,
  }));

  const subjectOptions = (subjectRows ?? [])
    .map((s) => ({ id: s.id, name: (s.translations as Record<string, string> | null)?.en ?? "" }))
    .filter((s) => s.name);
  const subjectNameById = new Map(subjectOptions.map((s) => [s.id, s.name]));
  const subjectNames = subjectOptions.map((s) => s.name);
  const subjectGradeBandCounts = new Map<string, number>();
  for (const s of subjectRows ?? []) {
    if (!s.grade_band) continue;
    subjectGradeBandCounts.set(s.grade_band, (subjectGradeBandCounts.get(s.grade_band) ?? 0) + 1);
  }
  const topGradeBand = [...subjectGradeBandCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Deleting a batch cascades to delete its search-results ad (0039) — the
  // Classes tab needs to know this up front to disable the Delete action
  // rather than let the teacher hit the server-side block after the fact.
  const activeAdBatchIds = new Set(
    (batchAdRows ?? []).filter((a) => a.batch_id && a.status === "active").map((a) => a.batch_id as string),
  );

  const batches: TeacherBatchRow[] = (batchRows ?? []).map((b) => ({
    id: b.id,
    title: b.title,
    mode: b.mode,
    classSizeType: b.class_size_type,
    location: b.location,
    scheduleNote: b.schedule_note,
    gradeBand: b.grade_band,
    courseCode: b.course_code,
    hasActiveAd: activeAdBatchIds.has(b.id),
    isOpenEnrollment: b.is_open_enrollment,
    capacity: b.capacity,
  }));

  // Institute Blueprint step 3b — every assigned institute batch, labeled
  // with its institute's name (e.g. "Horizon Institute — A/L Maths") so it
  // reads clearly wherever it shows up alongside the teacher's own batches:
  // content-target selectors, note/exam/live-class/assignment batch
  // labels, and the Classes tab's own "Teaching at institutes" list below.
  const assignedInstituteNameById = new Map((assignedInstituteRows ?? []).map((row) => [row.id, row.name]));
  const instituteBatchLabelById = new Map(
    (assignedInstituteBatchRows ?? []).map((b) => [b.id, `${assignedInstituteNameById.get(b.owner_id) ?? "—"} — ${b.title}`]),
  );
  const batchTitleById = new Map<string, string>([
    ...batches.map((b): [string, string] => [b.id, b.title]),
    ...instituteBatchLabelById,
  ]);

  // Deleted (0109 soft-delete) rows stay in batchAdRows so the Advertisement
  // tab's "Ad history" section can list and restore them — they're set
  // aside here rather than treated as a batch's live ad.
  const batchAdByBatchId = new Map<string, { id: string; title: string; content: string | null; status: "active" | "expired" | "removed" }>();
  const deletedBatchAdRows: NonNullable<typeof batchAdRows> = [];
  for (const a of batchAdRows ?? []) {
    if (a.status === "deleted") {
      deletedBatchAdRows.push(a);
      continue;
    }
    if (a.batch_id) batchAdByBatchId.set(a.batch_id, { id: a.id, title: a.title, content: a.content, status: a.status });
  }

  const adBatches: TeacherAdBatchRow[] = (batchRows ?? []).map((b) => {
    const ad = batchAdByBatchId.get(b.id);
    return {
      id: b.id,
      title: b.title,
      subjectId: b.subject_id,
      subjectName: b.subject_id ? (subjectNameById.get(b.subject_id) ?? null) : null,
      hourlyRate: b.hourly_rate,
      monthlyRate: b.monthly_rate,
      ad: ad ? { id: ad.id, title: ad.title, content: ad.content ?? "", status: ad.status } : null,
    };
  });

  const teacherAdHistory: AdHistoryRow[] = deletedBatchAdRows.map((ad) => ({
    id: ad.id,
    title: ad.title,
    content: ad.content ?? "",
    meta: ad.batch_id ? (batchTitleById.get(ad.batch_id) ?? undefined) : undefined,
  }));

  // get_roster_student_info only ever resolves this teacher's own students
  // (0032); get_managed_batch_student_info (0101) is the institute-batch
  // equivalent — merged into one map so every downstream lookup (rosters,
  // submissions, analytics) works the same regardless of which side a
  // student came from.
  const studentById = new Map((studentProfiles ?? []).map((p) => [p.id, p]));
  for (const r of managedBatchStudentRows ?? []) {
    if (!studentById.has(r.student_id)) {
      studentById.set(r.student_id, { id: r.student_id, full_name: r.full_name, phone: r.phone });
    }
  }

  // Personal enrollments only — this teacher's own Students tab (accept/
  // decline join requests) is deliberately not extended to institute
  // batches: approving who's "in" at an institute is the institute's own
  // call (Students tab, 0097), not something a linked teacher does.
  const acceptedEnrollments = (enrollmentRows ?? []).filter((e) => e.status === "accepted");
  const pendingEnrollments = (enrollmentRows ?? []).filter((e) => e.status === "pending");

  // Institute Blueprint step 3b — every accepted student across every
  // institute batch this teacher manages, shaped like a regular enrollment
  // row so it can be pooled together with acceptedEnrollments below for
  // rosters, content-target student counts, and individual-student
  // targeting on exams/live classes. Kept separate from acceptedEnrollments
  // itself (see the comment above) so it never leaks into the personal
  // Students tab.
  const instituteAcceptedEnrollments = (managedBatchStudentRows ?? []).map((r) => ({
    id: r.enrollment_id,
    student_id: r.student_id,
    batch_id: r.batch_id as string | null,
    joined_at: r.joined_at,
  }));
  const combinedAcceptedEnrollments = [...acceptedEnrollments, ...instituteAcceptedEnrollments];

  const rosterByBatch: Record<string, BatchRosterEntry[]> = {};
  for (const enrollment of combinedAcceptedEnrollments) {
    if (!enrollment.batch_id) continue;
    const student = studentById.get(enrollment.student_id);
    const entry: BatchRosterEntry = {
      name: student?.full_name ?? "—",
      joinedAt: dateFormatter.format(new Date(enrollment.joined_at)),
      phone: student?.phone ?? null,
    };
    (rosterByBatch[enrollment.batch_id] ??= []).push(entry);
  }

  const notes: TeacherNoteRow[] = (noteRows ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    batchId: n.batch_id,
    batchTitle: n.batch_id ? (batchTitleById.get(n.batch_id) ?? null) : null,
    pageCount: n.page_count,
    isPublic: n.is_public,
    createdAtIso: n.created_at,
    createdLabel: dateFormatter.format(new Date(n.created_at)),
  }));

  const students: TeacherStudentRow[] = acceptedEnrollments.map((enrollment) => {
    const student = studentById.get(enrollment.student_id);
    return {
      id: enrollment.id,
      name: student?.full_name ?? "—",
      batch: (enrollment.batch_id && batches.find((b) => b.id === enrollment.batch_id)?.title) || t("students.noBatch"),
      joinedAt: dateFormatter.format(new Date(enrollment.joined_at)),
      phone: student?.phone ?? null,
    };
  });

  const requests: TeacherJoinRequestRow[] = pendingEnrollments.map((enrollment) => {
    const student = studentById.get(enrollment.student_id);
    return {
      id: enrollment.id,
      studentName: student?.full_name ?? "—",
      batch: (enrollment.batch_id && batches.find((b) => b.id === enrollment.batch_id)?.title) || t("students.noBatch"),
      requestedAt: dateFormatter.format(new Date(enrollment.joined_at)),
    };
  });

  const questionImageUrlByPath = new Map<string, string>();
  for (const entry of signedQuestionImages ?? []) {
    if (entry.path && entry.signedUrl) questionImageUrlByPath.set(entry.path, entry.signedUrl);
  }

  const answersByQuestionId = new Map((questionAnswerRows ?? []).map((a) => [a.id, a]));

  const questions: QuestionBankItem[] = (questionRows ?? []).map((q) => {
    const answers = answersByQuestionId.get(q.id);
    return {
      id: q.id,
      text: q.question_text,
      topic: q.topic ?? "",
      gradeBand: (q.grade_band ?? "12-13") as QuestionBankItem["gradeBand"],
      batchId: q.batch_id ?? undefined,
      type: q.type,
      difficulty: q.difficulty,
      marks: q.marks,
      language: (q.language ?? "en") as QuestionBankItem["language"],
      imageUrl: q.question_image_path ? questionImageUrlByPath.get(q.question_image_path) : undefined,
      options: ((q.options as RawQuestionOption[] | null) ?? undefined)?.map((o) => ({
        id: o.id,
        text: o.text,
        imageUrl: o.imagePath ? questionImageUrlByPath.get(o.imagePath) : undefined,
      })),
      correctOptionIds: answers && answers.correct_option_ids.length > 0 ? answers.correct_option_ids : undefined,
      multiSelect: q.multi_select,
      codeFormat: q.code_format,
      sampleAnswer: answers?.sample_answer ?? undefined,
    };
  });

  const signedUrlByPath = new Map<string, string>();
  for (const entry of signedUrls ?? []) {
    if (entry.path && entry.signedUrl) signedUrlByPath.set(entry.path, entry.signedUrl);
  }

  const exams: TeacherExamRow[] = (examDetailRows ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    durationMinutes: e.duration_minutes,
    scheduledAtIso: e.scheduled_at,
    scheduledLabel: e.scheduled_at ? scheduleFormatter.format(new Date(e.scheduled_at)) : "—",
    questionCount: e.question_ids.length,
    questionIds: e.question_ids,
    batchTitle: e.batch_id ? (batchTitleById.get(e.batch_id) ?? null) : null,
    published: e.published,
    revealAnswers: e.reveal_answers,
  }));

  const examSubmissions: ExamSubmissionRow[] = (submissionDetailRows ?? []).map((s) => ({
    id: s.id,
    examId: s.exam_id,
    studentName: studentById.get(s.student_id)?.full_name ?? "—",
    submittedLabel: s.submitted_at ? dateFormatter.format(new Date(s.submitted_at)) : null,
    status: s.status,
    grade: s.grade,
    feedback: s.feedback,
    photoUrls: s.photo_urls.map((p) => signedUrlByPath.get(p)).filter((u): u is string => Boolean(u)),
    mcqScore: s.mcq_score,
    mcqMaxScore: s.mcq_max_score,
    codeAnswers: s.code_answers ?? {},
  }));

  // Analytics tab — pure computation over data already fetched above for
  // Exams/Attendance, no extra queries. A submission's `grade` is a raw,
  // free-typed number (see gradeSubmission in exams-actions.ts), not a
  // percentage — comparing raw scores across exams with different total
  // marks would be misleading, so it's converted to a % of the exam's total
  // marks (summed from question_bank_items.marks for that exam's
  // question_ids) here, once, rather than in the client component.
  const marksByQuestionId = new Map((questionRows ?? []).map((q) => [q.id, q.marks]));
  const maxMarksByExamId = new Map(
    (examDetailRows ?? []).map((e) => [
      e.id,
      e.question_ids.reduce((sum, qid) => sum + (marksByQuestionId.get(qid) ?? 0), 0),
    ]),
  );
  const examById = new Map((examDetailRows ?? []).map((e) => [e.id, e]));

  const analyticsExamResults: AnalyticsExamResultRow[] = (submissionDetailRows ?? []).map((s) => {
    const exam = examById.get(s.exam_id);
    const maxMarks = maxMarksByExamId.get(s.exam_id) ?? 0;
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
      studentName: studentById.get(s.student_id)?.full_name ?? "—",
      status: s.status,
      scorePercent,
    };
  });

  const liveClassById = new Map((liveClassRows ?? []).map((c) => [c.id, c]));
  const analyticsAttendance: AnalyticsAttendanceRow[] = (attendanceRows ?? []).flatMap((a) => {
    const liveClass = liveClassById.get(a.live_class_id);
    if (!liveClass) return [];
    return [
      {
        batchId: liveClass.batch_id,
        dateIso: liveClass.scheduled_at,
        studentId: a.student_id,
        studentName: studentById.get(a.student_id)?.full_name ?? "—",
        status: a.status,
      },
    ];
  });

  const analyticsBatchOptions: AnalyticsBatchOption[] = [
    ...batches.map((b) => ({ id: b.id, title: b.title })),
    ...(assignedInstituteBatchRows ?? []).map((b) => ({ id: b.id, title: instituteBatchLabelById.get(b.id) ?? b.title })),
  ];

  const joinLinkByClassId = new Map((liveClassLinkRows ?? []).map((l) => [l.live_class_id, l.join_link]));
  const attendanceByKey = new Map((attendanceRows ?? []).map((a) => [`${a.live_class_id}:${a.student_id}`, a.status]));
  const participantIdsByClassId = new Map<string, Set<string>>();
  for (const p of participantRows ?? []) {
    const set = participantIdsByClassId.get(p.live_class_id) ?? new Set<string>();
    set.add(p.student_id);
    participantIdsByClassId.set(p.live_class_id, set);
  }

  // A live class scoped to a batch only rosters that batch's students —
  // combinedAcceptedEnrollments so an institute-assigned batch's students
  // are included, not just this teacher's own. An unscoped one (batch_id
  // null) rosters everyone accepted directly with this teacher — same
  // "null = all my students" shape as assignments (0049) — and stays
  // scoped to acceptedEnrollments only, since batch_id can never be null
  // for content a linked teacher manages at an institute (can_manage_content
  // requires a batch), so there's no institute equivalent of "unscoped" to
  // include here. An explicit participant list (0055) narrows either pool
  // further, to exactly the students the teacher hand-picked.
  function rosterFor(liveClassId: string, batchId: string | null) {
    const pool = batchId
      ? combinedAcceptedEnrollments.filter((e) => e.batch_id === batchId)
      : acceptedEnrollments;
    const participantIds = participantIdsByClassId.get(liveClassId);
    const scoped = participantIds ? pool.filter((e) => participantIds.has(e.student_id)) : pool;
    return scoped.map((e) => ({
      studentId: e.student_id,
      studentName: studentById.get(e.student_id)?.full_name ?? "—",
      status: attendanceByKey.get(`${liveClassId}:${e.student_id}`) ?? null,
    }));
  }

  const liveClasses: TeacherLiveClassRow[] = (liveClassRows ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    scheduledAtIso: c.scheduled_at,
    scheduledLabel: scheduleFormatter.format(new Date(c.scheduled_at)),
    mode: c.mode,
    location: c.location,
    joinLink: joinLinkByClassId.get(c.id) ?? null,
    batchId: c.batch_id,
    batchTitle: c.batch_id ? (batchTitleById.get(c.batch_id) ?? null) : null,
    roster: rosterFor(c.id, c.batch_id),
  }));

  const lessonOptions: TeacherLessonOption[] = (liveClassRows ?? []).map((c) => ({ id: c.id, title: c.title }));
  const lessonTitleById = new Map(lessonOptions.map((l) => [l.id, l.title]));

  const assignmentFileUrlByPath = new Map<string, string>();
  for (const entry of signedAssignmentUrls ?? []) {
    if (entry.path && entry.signedUrl) assignmentFileUrlByPath.set(entry.path, entry.signedUrl);
  }

  const assignments: TeacherAssignmentRow[] = (assignmentRows ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    batchId: a.batch_id,
    batchTitle: a.batch_id ? (batchTitleById.get(a.batch_id) ?? null) : null,
    lessonId: a.lesson_id,
    lessonTitle: a.lesson_id ? (lessonTitleById.get(a.lesson_id) ?? null) : null,
    dueAtIso: a.due_at,
    dueLabel: a.due_at ? dateFormatter.format(new Date(a.due_at)) : null,
    fileUrl: assignmentFileUrlByPath.get(a.file_path) ?? "",
  }));

  const assignmentPhotoUrlByPath = new Map<string, string>();
  for (const entry of signedPhotoUrls ?? []) {
    if (entry.path && entry.signedUrl) assignmentPhotoUrlByPath.set(entry.path, entry.signedUrl);
  }

  const assignmentSubmissions: AssignmentSubmissionRow[] = (assignmentSubmissionRows ?? []).map((s) => ({
    id: s.id,
    assignmentId: s.assignment_id,
    studentName: studentById.get(s.student_id)?.full_name ?? "—",
    submittedLabel: s.submitted_at ? dateFormatter.format(new Date(s.submitted_at)) : null,
    status: s.status,
    grade: s.grade,
    feedback: s.feedback,
    photoUrls: s.photo_urls.map((p) => assignmentPhotoUrlByPath.get(p)).filter((u): u is string => Boolean(u)),
  }));

  const attendanceSessions: AttendanceSession[] = (liveClassRows ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    dateLabel: dateFormatter.format(new Date(c.scheduled_at)),
    rows: rosterFor(c.id, c.batch_id),
  }));

  const liveProfile: TeacherProfileDetail = {
    id: userId,
    name: fullName,
    headline: teacherProfile?.headline ?? null,
    bio: teacherProfile?.bio ?? null,
    location: teacherProfile?.location ?? null,
    classType: (teacherProfile?.class_type as TeacherProfileDetail["classType"]) ?? "physical",
    experienceYears: teacherProfile?.experience_years ?? null,
    qualifications: teacherProfile?.qualifications ?? [],
    workExperience: teacherProfile?.work_experience ?? [],
    photoUrl: teacherProfile?.photo_url ?? null,
    subjects: subjectNames,
    languages: teacherProfile?.languages ?? [],
    gradeBand: topGradeBand,
    rating: averageRating ? Number(averageRating) : 0,
    reviewCount: reviewRows?.length ?? 0,
    avatarInitials: userInitial,
    hourlyRate: priceRow?.hourly_rate ?? undefined,
    monthlyRate: priceRow?.monthly_rate ?? undefined,
    adHeadline: adRow?.title ?? undefined,
    adText: adRow?.content ?? undefined,
    notesCount: notes.length,
    notes: notes.map((n) => ({ id: n.id, title: n.title, pageCount: n.pageCount })),
    schedule: (batchRows ?? [])
      .filter((b) => b.status === "active")
      .map((b) => {
        const ad = batchAdByBatchId.get(b.id);
        return {
          id: b.id,
          title: b.title,
          mode: b.mode as "online" | "physical",
          location: b.location,
          scheduleNote: b.schedule_note,
          gradeBand: b.grade_band,
          adId: ad?.status === "active" ? ad.id : null,
        };
      }),
    reviews,
    phone: liveProfilePhone,
    contactMode: (teacherProfile?.contact_mode as TeacherProfileDetail["contactMode"]) ?? "phone",
    isCampusLecturer,
    institution: teacherProfile?.institution ?? null,
    academicTitle: teacherProfile?.academic_title ?? null,
    institutionVerified: teacherProfile?.institution_verified ?? false,
    publications: teacherProfile?.publications ?? [],
  };

  const referrals: ReferralRow[] = (myReferralRows ?? []).map((row) => ({
    id: row.id,
    name: row.referred_name,
    status: row.reward_status,
    dateLabel: dateFormatter.format(new Date(row.created_at)),
  }));

  // Institute Blueprint step 1 (0091) — resolve the inviting institute's
  // name for each pending roster invite. Usually zero or one row, so a
  // second small query beats widening Stage 1 with an embedded join this
  // codebase's types don't support (see database.ts's own note on that).
  const instituteInviteClassIds = (instituteInviteRows ?? []).map((row) => row.class_id);
  const { data: inviteInstituteRows } = instituteInviteClassIds.length
    ? await supabase.from("class_profiles").select("id, name").in("id", instituteInviteClassIds)
    : { data: [] as { id: string; name: string }[] };
  const instituteNameById = new Map((inviteInstituteRows ?? []).map((row) => [row.id, row.name]));
  const instituteInvites: InstituteInviteRow[] = (instituteInviteRows ?? []).map((row) => ({
    classId: row.class_id,
    instituteName: instituteNameById.get(row.class_id) ?? "—",
    dateLabel: dateFormatter.format(new Date(row.joined_at)),
  }));

  // Institute Blueprint step 3b — label each assigned batch with its
  // institute's name so it reads clearly alongside the teacher's own
  // batches in the same selector, e.g. "Horizon Institute — A/L Maths".
  const contentTargetBatches: TeacherBatchOption[] = [
    ...batches.map((b) => ({ id: b.id, title: b.title })),
    ...(assignedInstituteBatchRows ?? []).map((b) => ({ id: b.id, title: instituteBatchLabelById.get(b.id) ?? b.title })),
  ];

  // Classes tab's "Teaching at institutes" section — read-only (a linked
  // teacher can't edit the batch itself, only the institute owner can), so
  // this is a much lighter row shape than TeacherBatchRow, just enough to
  // orient the teacher: which institute, which class, how it runs, and who's
  // in it (rosterByBatch already includes these students, see above).
  const instituteTaughtBatches: InstituteTaughtBatchRow[] = (assignedInstituteBatchRows ?? []).map((b) => ({
    id: b.id,
    title: b.title,
    instituteName: assignedInstituteNameById.get(b.owner_id) ?? "—",
    mode: b.mode,
    location: b.location,
    scheduleNote: b.schedule_note,
    studentCount: rosterByBatch[b.id]?.length ?? 0,
  }));

  return (
    <DashboardShell
      userLabel={fullName}
      userInitial={userInitial}
      userPhotoUrl={teacherProfile?.photo_url ?? null}
      logoutLabel={t("logout")}
      demoRole="teacher"
      notifications={notifications}
      realtimeWatch={[
        { table: "inquiries", filter: `owner_id=eq.${userId}` },
        { table: "enrollments", filter: `owner_id=eq.${userId}` },
        { table: "notifications", filter: `recipient_id=eq.${userId}` },
        // No owner_id column on these three — the ownership link is one
        // hop away (exam_id/assignment_id/live_class_id), so they watch
        // unfiltered. See RealtimeRefresh's own comment for why that's a
        // performance trade-off, not a data-exposure one.
        { table: "exam_submissions" },
        { table: "assignment_submissions" },
        { table: "attendance_records" },
      ]}
      groups={[
        {
          items: [{ key: "overview", label: t("tabs.overview") }],
        },
        {
          label: t("groupTeaching"),
          items: [
            { key: "profile", label: t("tabs.profile") },
            {
              key: "classes",
              label: isCampusLecturer ? t("tabs.classesCampus") : t("tabs.classes"),
              count: batches.length,
            },
            { key: "live", label: t("tabs.live") },
          ],
        },
        {
          label: t("groupContent"),
          items: [
            { key: "notes", label: t("tabs.notes"), count: notes.length },
            { key: "questionBank", label: t("tabs.questionBank"), count: questions.length },
            { key: "exams", label: t("tabs.exams"), count: examRows?.length ?? 0 },
            { key: "assignments", label: t("tabs.assignments"), count: assignments.length },
          ],
        },
        {
          label: t("groupStudents"),
          items: [
            { key: "students", label: t("tabs.students"), count: studentsCount ?? 0 },
            { key: "analytics", label: t("tabs.analytics") },
            { key: "attendance", label: t("tabs.attendance") },
            { key: "reviews", label: t("tabs.reviews"), count: reviewRows?.length ?? 0 },
            {
              key: "inquiries",
              label: t("tabs.inquiries"),
              count: inquiries.filter((i) => i.status === "new").length,
            },
            {
              key: "studentRequests",
              label: t("tabs.studentRequests"),
              count: wantedAdRequests.filter((r) => !r.myResponse).length,
            },
          ],
        },
        {
          label: t("groupMore"),
          items: [
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
            initialHeadline={teacherProfile?.headline ?? ""}
            initialBio={teacherProfile?.bio ?? ""}
            initialQualifications={teacherProfile?.qualifications ?? []}
            initialWorkExperience={teacherProfile?.work_experience ?? []}
            initialExperienceYears={teacherProfile?.experience_years?.toString() ?? ""}
            initialSubjects={subjectNames}
            initialLanguages={teacherProfile?.languages ?? []}
            initialLocation={teacherProfile?.location ?? ""}
            initialClassType={teacherProfile?.class_type ?? "physical"}
            initialHourlyRate={priceRow?.hourly_rate?.toString() ?? ""}
            initialMonthlyRate={priceRow?.monthly_rate?.toString() ?? ""}
            initialStatus={teacherProfile?.status ?? "pending"}
            initialOwnerPublished={teacherProfile?.owner_published ?? true}
            initialPhotoUrl={teacherProfile?.photo_url ?? null}
            teacherName={fullName}
            isCampusLecturer={isCampusLecturer}
            initialInstitution={teacherProfile?.institution ?? ""}
            initialAcademicTitle={teacherProfile?.academic_title ?? ""}
            initialPublications={teacherProfile?.publications ?? []}
            institutionVerified={teacherProfile?.institution_verified ?? false}
            initialHasVerificationDocument={Boolean(teacherProfile?.verification_document_path)}
            liveView={<TeacherProfileView teacher={liveProfile} showGate={false} isOwnerView />}
          />
        ),
        notes: <NotesTab notes={notes} batches={contentTargetBatches} />,
        classes: (
          <ClassesTab
            batches={batches}
            rosterByBatch={rosterByBatch}
            isCampusLecturer={isCampusLecturer}
            instituteBatches={instituteTaughtBatches}
          />
        ),
        questionBank: <QuestionBankTab initialQuestions={questions} batches={contentTargetBatches} />,
        exams: (
          <ExamsTab
            exams={exams}
            submissions={examSubmissions}
            questions={questions}
            batches={contentTargetBatches.map((b) => ({ id: b.id, title: b.title, studentCount: rosterByBatch[b.id]?.length ?? 0 }))}
            totalStudentsCount={combinedAcceptedEnrollments.length}
            studentPool={combinedAcceptedEnrollments.map((e) => ({
              id: e.student_id,
              name: studentById.get(e.student_id)?.full_name ?? "—",
              batchId: e.batch_id,
            }))}
          />
        ),
        assignments: (
          <AssignmentsTab
            assignments={assignments}
            submissions={assignmentSubmissions}
            batches={contentTargetBatches}
            lessons={lessonOptions}
          />
        ),
        live: (
          <LiveClassesTab
            classes={liveClasses}
            hostName={fullName}
            batches={contentTargetBatches.map((b) => ({ id: b.id, title: b.title, studentCount: rosterByBatch[b.id]?.length ?? 0 }))}
            totalStudentsCount={combinedAcceptedEnrollments.length}
            studentPool={combinedAcceptedEnrollments.map((e) => ({
              id: e.student_id,
              name: studentById.get(e.student_id)?.full_name ?? "—",
              batchId: e.batch_id,
            }))}
          />
        ),
        students: <StudentsTab students={students} requests={requests} />,
        analytics: (
          <AnalyticsTab
            examResults={analyticsExamResults}
            attendance={analyticsAttendance}
            batches={analyticsBatchOptions}
            isCampusLecturer={isCampusLecturer}
          />
        ),
        attendance: <AttendanceTab sessions={attendanceSessions} />,
        inquiries: <InquiriesTab inquiries={inquiries} />,
        studentRequests: <WantedAdsBrowseTab requests={wantedAdRequests} />,
        reviews: <ReviewsTab initialReviews={reviews} averageRating={averageRating ?? "0.0"} reviewCount={reviewRows?.length ?? 0} />,
        ads: (
          <AdvertisementTab
            initialContent={adRow?.content ?? ""}
            batches={adBatches}
            subjectOptions={subjectOptions}
            defaultHourlyRate={priceRow?.hourly_rate}
            defaultMonthlyRate={priceRow?.monthly_rate}
            history={teacherAdHistory}
          />
        ),
        settings: (
          <SettingsTab
            initialFullName={fullName}
            initialPhone={profile?.phone ?? ""}
            initialNotificationPrefs={(profile?.notification_prefs as Record<string, boolean>) ?? {}}
            initialContactMode={teacherProfile?.contact_mode ?? "phone"}
            email={user!.email ?? ""}
            referralCode={referralCodeValue ?? ""}
            referrals={referrals}
            instituteInvites={instituteInvites}
          />
        ),
      }}
      defaultTab="overview"
    />
  );
}
