import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OverviewTab } from "@/components/dashboard/institute/overview-tab";
import { TeachersTab, type InstituteTeacherRow } from "@/components/dashboard/institute/teachers-tab";
import { BatchesTab } from "@/components/dashboard/institute/batches-tab";
import { AdvertisementTab } from "@/components/dashboard/institute/advertisement-tab";
import { ReviewsTab } from "@/components/dashboard/institute/reviews-tab";
import { SettingsTab } from "@/components/dashboard/institute/settings-tab";
import { InquiriesTab, type InquiryRow } from "@/components/dashboard/inquiries-tab";
import { WantedAdsBrowseTab, type WantedAdBrowseRow } from "@/components/dashboard/wanted-ads-browse-tab";
import { createClient } from "@/lib/supabase/server";
import { createDateFormatter } from "@/lib/format-date";
import type { TeachersAtGlance } from "@/types/dashboard-institute";
import type { InstituteBatchRow } from "@/components/dashboard/institute/batches-tab";

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

  const [{ data: profile }, { data: classProfile }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, notification_prefs").eq("id", userId).single(),
    supabase.from("class_profiles").select("*").eq("owner_id", userId).maybeSingle(),
  ]);

  const fullName = profile?.full_name ?? user!.email ?? "Institute";
  const userInitial = fullName.charAt(0).toUpperCase();
  const instituteId = classProfile?.id;

  // Every query below only needs instituteId (or nothing at all), not each
  // other's results — including the two that used to be their own separate
  // awaits further down (list_public_reviews, batches/batchEnrollmentRows)
  // — so they all run as one batch instead of a chain of sequential round
  // trips. Only the teacher-related queries below this genuinely have to
  // wait, since they need teacherIds out of classTeacherRows first.
  const [
    { data: classTeacherRows },
    { count: studentsCount },
    { data: reviewRows },
    { data: priceRow },
    { data: adRow },
    { data: inquiryRows },
    { data: wantedAdRows },
    { data: myReviewRows },
    { data: batchRows },
    { data: batchEnrollmentRows },
  ] = await Promise.all([
    instituteId
      ? supabase.from("class_teachers").select("teacher_id, is_visible").eq("class_id", instituteId)
      : Promise.resolve({ data: [] as { teacher_id: string; is_visible: boolean }[] }),
    instituteId
      ? supabase
          .from("enrollments")
          .select("id", { count: "exact", head: true })
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
      : Promise.resolve({ count: 0 }),
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
    instituteId
      ? supabase
          .from("advertisements")
          .select("content")
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
          .eq("placement", "own_profile")
          .maybeSingle()
      : Promise.resolve({ data: null }),
    instituteId
      ? supabase
          .from("inquiries")
          .select("id, sender_name, sender_contact, message, status, reply, created_at")
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
            reply: string | null;
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
          .select("id, title, mode, location, schedule_note, teacher_label")
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; title: string; mode: "online" | "physical"; location: string | null; schedule_note: string | null; teacher_label: string | null }[] }),
    instituteId
      ? supabase.from("enrollments").select("batch_id").eq("owner_type", "class").eq("owner_id", instituteId)
      : Promise.resolve({ data: [] as { batch_id: string | null }[] }),
  ]);

  const teacherIds = (classTeacherRows ?? []).map((row) => row.teacher_id);

  const isVisibleById = new Map((classTeacherRows ?? []).map((row) => [row.teacher_id, row.is_visible]));

  let teachersAtGlance: TeachersAtGlance[] = [];
  let instituteTeachers: InstituteTeacherRow[] = [];
  if (teacherIds.length > 0) {
    const [
      { data: teacherProfiles },
      { data: teacherPersonProfiles },
      { data: teacherEnrollments },
      { data: teacherReviews },
      { data: teacherPrices },
    ] = await Promise.all([
      supabase.from("teacher_profiles").select("id, headline, status").in("id", teacherIds),
      // Plain `profiles` select would return zero rows here — its only RLS
      // policy is "your own row or admin" (0003). This RPC (0032) opens it
      // up specifically for teachers linked to this institute.
      supabase.rpc("get_linked_teacher_names", { p_class_id: instituteId!, p_teacher_ids: teacherIds }),
      supabase.from("enrollments").select("owner_id").eq("owner_type", "teacher").in("owner_id", teacherIds),
      supabase.from("reviews").select("target_id, rating").eq("target_type", "teacher").in("target_id", teacherIds),
      supabase.from("prices").select("owner_id, hourly_rate, monthly_rate").eq("owner_type", "teacher").in("owner_id", teacherIds),
    ]);

    const nameById = new Map((teacherPersonProfiles ?? []).map((p) => [p.id, p.full_name]));
    const headlineById = new Map((teacherProfiles ?? []).map((p) => [p.id, p.headline]));
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

    teachersAtGlance = teacherIds.map((teacherId) => {
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
        id: teacherId,
        name: nameById.get(teacherId) ?? "—",
        subject: headlineById.get(teacherId) ?? "",
        rateDisplay,
        studentCount: enrollmentCountById.get(teacherId) ?? 0,
        visible: isVisibleById.get(teacherId) ?? true,
        teacherHref: `/teacher/${teacherId}`,
      };
    });
  }

  const averageRating = reviewRows?.length
    ? (reviewRows.reduce((sum, r) => sum + r.rating, 0) / reviewRows.length).toFixed(1)
    : null;

  const dateFormatter = createDateFormatter(locale);
  const inquiries: InquiryRow[] = (inquiryRows ?? []).map((row) => ({
    id: row.id,
    senderName: row.sender_name,
    senderContact: row.sender_contact,
    message: row.message,
    status: row.status,
    reply: row.reply,
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
  const reviews = (myReviewRows ?? []).map((r) => ({
    id: r.id,
    author: r.author ?? "Anonymous",
    date: dateFormatter.format(new Date(r.created_at)),
    rating: r.rating,
    body: r.body ?? "",
    reply: r.reply ?? undefined,
  }));

  const batchStudentCounts = new Map<string, number>();
  for (const row of batchEnrollmentRows ?? []) {
    if (!row.batch_id) continue;
    batchStudentCounts.set(row.batch_id, (batchStudentCounts.get(row.batch_id) ?? 0) + 1);
  }
  const batches: InstituteBatchRow[] = (batchRows ?? []).map((b) => ({
    id: b.id,
    title: b.title,
    mode: b.mode,
    location: b.location,
    scheduleNote: b.schedule_note,
    teacherLabel: b.teacher_label,
    studentCount: batchStudentCounts.get(b.id) ?? 0,
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
      realtimeWatch={
        instituteId
          ? [
              { table: "inquiries", filter: `owner_id=eq.${instituteId}` },
              { table: "enrollments", filter: `owner_id=eq.${instituteId}` },
            ]
          : []
      }
      groups={[
        {
          label: t("groupInstitute"),
          items: [
            { key: "overview", label: t("tabs.overview") },
            { key: "teachers", label: t("tabs.teachers"), count: teacherIds.length },
            { key: "batches", label: t("tabs.batches"), count: batches.length },
          ],
        },
        {
          label: t("groupManage"),
          items: [
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
            { key: "ads", label: t("tabs.ads") },
            { key: "reviews", label: t("tabs.reviews"), count: reviewRows?.length ?? 0 },
            { key: "settings", label: t("tabs.settings") },
          ],
        },
      ]}
      panels={{
        overview: (
          <OverviewTab
            instituteName={fullName}
            teachersCount={teacherIds.length}
            studentsCount={studentsCount ?? 0}
            averageRating={averageRating}
            batchesCount={batches.length}
            teachersAtGlance={teachersAtGlance}
          />
        ),
        teachers: <TeachersTab teachers={instituteTeachers} />,
        batches: <BatchesTab batches={batches} />,
        inquiries: <InquiriesTab inquiries={inquiries} />,
        studentRequests: <WantedAdsBrowseTab requests={wantedAdRequests} />,
        ads: <AdvertisementTab initialContent={adRow?.content ?? ""} />,
        reviews: (
          <ReviewsTab initialReviews={reviews} averageRating={averageRating ?? "0.0"} reviewCount={reviewRows?.length ?? 0} />
        ),
        settings: (
          <SettingsTab
            initialName={classProfile?.name ?? fullName}
            initialLocation={classProfile?.location ?? ""}
            initialEstablished={classProfile?.established ?? ""}
            initialPhotoUrl={classProfile?.photo_url ?? null}
            initialPhone={profile?.phone ?? ""}
            initialHourlyRate={priceRow?.hourly_rate?.toString() ?? ""}
            initialMonthlyRate={priceRow?.monthly_rate?.toString() ?? ""}
            initialStatus={classProfile?.status ?? "pending"}
            initialOwnerPublished={classProfile?.owner_published ?? true}
            initialNotificationPrefs={(profile?.notification_prefs as Record<string, boolean>) ?? {}}
            initialInstitutionVerified={classProfile?.institution_verified ?? false}
            initialHasVerificationDocument={classProfile?.verification_document_path != null}
          />
        ),
      }}
      defaultTab="overview"
    />
  );
}
