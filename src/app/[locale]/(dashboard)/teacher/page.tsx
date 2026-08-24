import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
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
import { ReviewsTab } from "@/components/dashboard/teacher/reviews-tab";
import { InquiriesTab } from "@/components/dashboard/inquiries-tab";
import { AdvertisementTab } from "@/components/dashboard/teacher/advertisement-tab";
import type { TeacherAdBatchRow } from "@/components/dashboard/teacher/advertisement-tab";
import { SettingsTab } from "@/components/dashboard/teacher/settings-tab";
import { TeacherProfileView } from "@/components/features/teacher-profile-view";
import { createClient } from "@/lib/supabase/server";
import { createDateFormatter, createScheduleFormatter } from "@/lib/format-date";
import type { TeacherProfileDetail } from "@/types/teacher-profile";
import type { TeacherBatchRow, BatchRosterEntry } from "@/components/dashboard/teacher/classes-tab";
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
import type { InquiryRow } from "@/components/dashboard/inquiries-tab";

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
  const dateFormatter = createDateFormatter(locale);
  const scheduleFormatter = createScheduleFormatter(locale);

  const [{ data: profile }, { data: teacherProfile }, { data: priceRow }, { data: adRow }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, notification_prefs").eq("id", userId).single(),
    supabase.from("teacher_profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("prices").select("hourly_rate, monthly_rate").eq("owner_type", "teacher").eq("owner_id", userId).maybeSingle(),
    supabase
      .from("advertisements")
      .select("content, title")
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
    { data: inquiryRows },
  ] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("owner_type", "teacher")
      .eq("owner_id", userId)
      .eq("status", "accepted"),
    supabase.from("reviews").select("rating").eq("target_type", "teacher").eq("target_id", userId),
    supabase.from("exams").select("id").eq("owner_type", "teacher").eq("owner_id", userId),
    supabase.from("exam_submissions").select("id, exam_id").eq("status", "pending"),
    supabase
      .from("inquiries")
      .select("id, sender_name, sender_contact, message, status, reply, created_at")
      .eq("owner_type", "teacher")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const inquiries: InquiryRow[] = (inquiryRows ?? []).map((row) => ({
    id: row.id,
    senderName: row.sender_name,
    senderContact: row.sender_contact,
    message: row.message,
    status: row.status,
    reply: row.reply,
    createdLabel: dateFormatter.format(new Date(row.created_at)),
  }));

  const examIds = new Set((examRows ?? []).map((e) => e.id));
  const pendingSubmissionsCount = (pendingSubmissionRows ?? []).filter((s) => examIds.has(s.exam_id)).length;
  const averageRating = reviewRows?.length
    ? (reviewRows.reduce((sum, r) => sum + r.rating, 0) / reviewRows.length).toFixed(1)
    : null;

  // Same RPC the public /teacher/[id] page uses — masked reviewer names,
  // consistent with what this teacher's own public profile shows.
  const { data: myReviewRows } = await supabase.rpc("list_public_reviews", {
    p_target_type: "teacher",
    p_target_id: userId,
  });
  const reviews = (myReviewRows ?? []).map((r) => ({
    id: r.id,
    author: r.author ?? "Anonymous",
    date: dateFormatter.format(new Date(r.created_at)),
    rating: r.rating,
    body: r.body ?? "",
    reply: r.reply ?? undefined,
  }));

  const [{ data: batchRows }, { data: enrollmentRows }, { data: noteRows }, { data: subjectLinkRows }] =
    await Promise.all([
      supabase
        .from("batches")
        .select("id, title, mode, location, schedule_note, grade_band, status, subject_id, hourly_rate, monthly_rate")
        .eq("owner_type", "teacher")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("enrollments")
        .select("id, student_id, batch_id, joined_at, status")
        .eq("owner_type", "teacher")
        .eq("owner_id", userId),
      supabase
        .from("notes")
        .select("id, title, batch_id, page_count, is_public, created_at")
        .eq("owner_type", "teacher")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false }),
      supabase.from("subject_links").select("subject_id").eq("owner_type", "teacher").eq("owner_id", userId),
    ]);

  const subjectIds = (subjectLinkRows ?? []).map((s) => s.subject_id);
  const { data: subjectRows } = subjectIds.length
    ? await supabase.from("subjects").select("id, translations, grade_band").in("id", subjectIds)
    : { data: [] as { id: string; translations: unknown; grade_band: string | null }[] };
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
  const topGradeBand =
    [...subjectGradeBandCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const batches: TeacherBatchRow[] = (batchRows ?? []).map((b) => ({
    id: b.id,
    title: b.title,
    mode: b.mode,
    location: b.location,
    scheduleNote: b.schedule_note,
    gradeBand: b.grade_band,
  }));

  // Batch-scoped "search results" ads (0039) — one per batch, distinct from
  // the single own_profile promo box fetched above.
  const { data: batchAdRows } = await supabase
    .from("advertisements")
    .select("id, batch_id, title, content, status")
    .eq("owner_type", "teacher")
    .eq("owner_id", userId)
    .eq("placement", "search_results");
  const batchAdByBatchId = new Map((batchAdRows ?? []).filter((a) => a.batch_id).map((a) => [a.batch_id as string, a]));

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

  const studentIds = [...new Set((enrollmentRows ?? []).map((e) => e.student_id))];
  // Plain `profiles` select would return zero rows here — its only RLS
  // policy is "your own row or admin" (0003). This RPC (0032) opens it up
  // for any student who has a relationship (accepted or a pending request)
  // with this teacher — the owner needs to see who a request is *from* to
  // decide whether to accept it, not just who's already an accepted student.
  const { data: studentProfiles } = studentIds.length
    ? await supabase.rpc("get_roster_student_info", { p_student_ids: studentIds })
    : { data: [] as { id: string; full_name: string; phone: string | null }[] };
  const studentById = new Map((studentProfiles ?? []).map((p) => [p.id, p]));

  const acceptedEnrollments = (enrollmentRows ?? []).filter((e) => e.status === "accepted");
  const pendingEnrollments = (enrollmentRows ?? []).filter((e) => e.status === "pending");

  const rosterByBatch: Record<string, BatchRosterEntry[]> = {};
  for (const enrollment of acceptedEnrollments) {
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
    batchTitle: batches.find((b) => b.id === n.batch_id)?.title ?? null,
    pageCount: n.page_count,
    isPublic: n.is_public,
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

  const { data: questionRows } = await supabase
    .from("question_bank_items")
    .select(
      "id, question_text, topic, grade_band, batch_id, type, difficulty, marks, language, options, correct_option_id, question_image_path",
    )
    .eq("owner_type", "teacher")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  type RawQuestionOption = { id: string; text: string; imagePath?: string };
  const questionImagePaths = new Set<string>();
  for (const q of questionRows ?? []) {
    if (q.question_image_path) questionImagePaths.add(q.question_image_path);
    for (const option of (q.options as RawQuestionOption[] | null) ?? []) {
      if (option.imagePath) questionImagePaths.add(option.imagePath);
    }
  }
  const questionImageUrlByPath = new Map<string, string>();
  if (questionImagePaths.size > 0) {
    const { data: signedQuestionImages } = await supabase.storage
      .from("question-images")
      .createSignedUrls([...questionImagePaths], 3600);
    for (const entry of signedQuestionImages ?? []) {
      if (entry.path && entry.signedUrl) questionImageUrlByPath.set(entry.path, entry.signedUrl);
    }
  }

  const questions: QuestionBankItem[] = (questionRows ?? []).map((q) => ({
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
    correctOptionId: q.correct_option_id ?? undefined,
  }));

  const { data: examDetailRows } = await supabase
    .from("exams")
    .select("id, title, question_ids, duration_minutes, scheduled_at")
    .eq("owner_type", "teacher")
    .eq("owner_id", userId)
    .order("scheduled_at", { ascending: false });

  const examDetailIds = (examDetailRows ?? []).map((e) => e.id);
  const { data: submissionDetailRows } = examDetailIds.length
    ? await supabase
        .from("exam_submissions")
        .select("id, exam_id, student_id, photo_urls, status, grade, feedback, submitted_at")
        .in("exam_id", examDetailIds)
    : { data: [] as { id: string; exam_id: string; student_id: string; photo_urls: string[]; status: "pending" | "graded"; grade: number | null; feedback: string | null; submitted_at: string }[] };

  const allPhotoPaths = (submissionDetailRows ?? []).flatMap((s) => s.photo_urls);
  const signedUrlByPath = new Map<string, string>();
  if (allPhotoPaths.length > 0) {
    const { data: signedUrls } = await supabase.storage.from("submissions").createSignedUrls(allPhotoPaths, 3600);
    for (const entry of signedUrls ?? []) {
      if (entry.path && entry.signedUrl) signedUrlByPath.set(entry.path, entry.signedUrl);
    }
  }

  const exams: TeacherExamRow[] = (examDetailRows ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    durationMinutes: e.duration_minutes,
    scheduledLabel: e.scheduled_at ? scheduleFormatter.format(new Date(e.scheduled_at)) : "—",
    questionCount: e.question_ids.length,
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
  }));

  const { data: liveClassRows } = await supabase
    .from("live_classes")
    .select("id, title, mode, location, scheduled_at, duration_minutes")
    .eq("owner_type", "teacher")
    .eq("owner_id", userId)
    .neq("status", "cancelled")
    .order("scheduled_at", { ascending: false });

  const liveClassIds = (liveClassRows ?? []).map((c) => c.id);
  const [{ data: liveClassLinkRows }, { data: attendanceRows }] = await Promise.all([
    liveClassIds.length
      ? supabase.from("live_class_links").select("live_class_id, join_link").in("live_class_id", liveClassIds)
      : Promise.resolve({ data: [] as { live_class_id: string; join_link: string }[] }),
    liveClassIds.length
      ? supabase.from("attendance_records").select("live_class_id, student_id, status").in("live_class_id", liveClassIds)
      : Promise.resolve({ data: [] as { live_class_id: string; student_id: string; status: "present" | "absent" | "late" }[] }),
  ]);
  const joinLinkByClassId = new Map((liveClassLinkRows ?? []).map((l) => [l.live_class_id, l.join_link]));
  const attendanceByKey = new Map((attendanceRows ?? []).map((a) => [`${a.live_class_id}:${a.student_id}`, a.status]));

  const liveClasses: TeacherLiveClassRow[] = (liveClassRows ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    scheduledAtIso: c.scheduled_at,
    scheduledLabel: scheduleFormatter.format(new Date(c.scheduled_at)),
    mode: c.mode,
    location: c.location,
    joinLink: joinLinkByClassId.get(c.id) ?? null,
  }));

  const lessonOptions: TeacherLessonOption[] = (liveClassRows ?? []).map((c) => ({ id: c.id, title: c.title }));
  const lessonTitleById = new Map(lessonOptions.map((l) => [l.id, l.title]));

  const { data: assignmentRows } = await supabase
    .from("assignments")
    .select("id, title, batch_id, lesson_id, file_path, due_at")
    .eq("owner_type", "teacher")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  const assignmentFilePaths = (assignmentRows ?? []).map((a) => a.file_path);
  const assignmentFileUrlByPath = new Map<string, string>();
  if (assignmentFilePaths.length > 0) {
    const { data: signedAssignmentUrls } = await supabase.storage
      .from("assignments")
      .createSignedUrls(assignmentFilePaths, 3600);
    for (const entry of signedAssignmentUrls ?? []) {
      if (entry.path && entry.signedUrl) assignmentFileUrlByPath.set(entry.path, entry.signedUrl);
    }
  }

  const batchTitleById = new Map(batches.map((b) => [b.id, b.title]));

  const assignments: TeacherAssignmentRow[] = (assignmentRows ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    batchId: a.batch_id,
    batchTitle: a.batch_id ? (batchTitleById.get(a.batch_id) ?? null) : null,
    lessonTitle: a.lesson_id ? (lessonTitleById.get(a.lesson_id) ?? null) : null,
    dueLabel: a.due_at ? dateFormatter.format(new Date(a.due_at)) : null,
    fileUrl: assignmentFileUrlByPath.get(a.file_path) ?? "",
  }));

  const assignmentIds = (assignmentRows ?? []).map((a) => a.id);
  const { data: assignmentSubmissionRows } = assignmentIds.length
    ? await supabase
        .from("assignment_submissions")
        .select("id, assignment_id, student_id, photo_urls, status, grade, feedback, submitted_at")
        .in("assignment_id", assignmentIds)
    : {
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
      };

  const allAssignmentPhotoPaths = (assignmentSubmissionRows ?? []).flatMap((s) => s.photo_urls);
  const assignmentPhotoUrlByPath = new Map<string, string>();
  if (allAssignmentPhotoPaths.length > 0) {
    const { data: signedPhotoUrls } = await supabase.storage
      .from("submissions")
      .createSignedUrls(allAssignmentPhotoPaths, 3600);
    for (const entry of signedPhotoUrls ?? []) {
      if (entry.path && entry.signedUrl) assignmentPhotoUrlByPath.set(entry.path, entry.signedUrl);
    }
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

  const rosterStudents = [...new Map((enrollmentRows ?? []).map((e) => [e.student_id, e])).values()];
  const attendanceSessions: AttendanceSession[] = (liveClassRows ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    dateLabel: dateFormatter.format(new Date(c.scheduled_at)),
    rows: rosterStudents.map((enrollment) => ({
      studentId: enrollment.student_id,
      studentName: studentById.get(enrollment.student_id)?.full_name ?? "—",
      status: attendanceByKey.get(`${c.id}:${enrollment.student_id}`) ?? null,
    })),
  }));

  // Same RPC the public /teacher/[id] page uses to gate the phone number —
  // called here too so the dashboard's inline "view live page" shows the
  // number exactly as this teacher (viewing their own profile) would see it.
  const { data: liveProfilePhone } = await supabase.rpc("get_teacher_contact", { p_teacher_id: userId });

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
  };

  return (
    <DashboardShell
      userLabel={fullName}
      userInitial={userInitial}
      userPhotoUrl={teacherProfile?.photo_url ?? null}
      logoutLabel={t("logout")}
      demoRole="teacher"
      realtimeWatch={[
        { table: "inquiries", filter: `owner_id=eq.${userId}` },
        { table: "enrollments", filter: `owner_id=eq.${userId}` },
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
            { key: "classes", label: t("tabs.classes"), count: batches.length },
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
            { key: "attendance", label: t("tabs.attendance") },
            { key: "reviews", label: t("tabs.reviews"), count: reviewRows?.length ?? 0 },
            {
              key: "inquiries",
              label: t("tabs.inquiries"),
              count: inquiries.filter((i) => i.status === "new").length,
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
            liveView={<TeacherProfileView teacher={liveProfile} showGate={false} isOwnerView />}
          />
        ),
        notes: <NotesTab notes={notes} batches={batches} />,
        classes: <ClassesTab batches={batches} rosterByBatch={rosterByBatch} />,
        questionBank: <QuestionBankTab initialQuestions={questions} batches={batches} />,
        exams: <ExamsTab exams={exams} submissions={examSubmissions} questions={questions} />,
        assignments: (
          <AssignmentsTab
            assignments={assignments}
            submissions={assignmentSubmissions}
            batches={batches}
            lessons={lessonOptions}
          />
        ),
        live: <LiveClassesTab classes={liveClasses} hostName={fullName} />,
        students: <StudentsTab students={students} requests={requests} />,
        attendance: <AttendanceTab sessions={attendanceSessions} />,
        inquiries: <InquiriesTab inquiries={inquiries} />,
        reviews: <ReviewsTab initialReviews={reviews} averageRating={averageRating ?? "0.0"} reviewCount={reviewRows?.length ?? 0} />,
        ads: (
          <AdvertisementTab
            initialContent={adRow?.content ?? ""}
            batches={adBatches}
            subjectOptions={subjectOptions}
            defaultHourlyRate={priceRow?.hourly_rate}
            defaultMonthlyRate={priceRow?.monthly_rate}
          />
        ),
        settings: (
          <SettingsTab
            initialPhone={profile?.phone ?? ""}
            initialNotificationPrefs={(profile?.notification_prefs as Record<string, boolean>) ?? {}}
            initialContactMode={teacherProfile?.contact_mode ?? "phone"}
            email={user!.email ?? ""}
          />
        ),
      }}
      defaultTab="overview"
    />
  );
}
