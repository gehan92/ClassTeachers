import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OverviewTab } from "@/components/dashboard/institute/overview-tab";
import { TeachersTab, type InstituteTeacherRow } from "@/components/dashboard/institute/teachers-tab";
import { BatchesTab } from "@/components/dashboard/institute/batches-tab";
import { AdvertisementTab } from "@/components/dashboard/institute/advertisement-tab";
import { ReviewsTab } from "@/components/dashboard/institute/reviews-tab";
import { SettingsTab } from "@/components/dashboard/institute/settings-tab";
import { InquiriesTab, type InquiryRow, type InquiryMessageRow } from "@/components/dashboard/inquiries-tab";
import { WantedAdsBrowseTab, type WantedAdBrowseRow } from "@/components/dashboard/wanted-ads-browse-tab";
import { createClient } from "@/lib/supabase/server";
import { createDateFormatter } from "@/lib/format-date";
import type { TeachersAtGlance } from "@/types/dashboard-institute";
import type { InstituteBatchRow } from "@/components/dashboard/institute/batches-tab";
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

  const [{ data: profile }, { data: classProfile }, { data: referralCodeValue }, { data: myReferralRows }] =
    await Promise.all([
      supabase.from("profiles").select("full_name, phone, notification_prefs").eq("id", userId).single(),
      supabase.from("class_profiles").select("*").eq("owner_id", userId).maybeSingle(),
      // Refer & Earn panel (Settings tab) — lazily assigns a code the first
      // time it's asked for (referrals, 0089), nothing to backfill up front.
      supabase.rpc("ensure_referral_code"),
      supabase.rpc("list_my_referrals"),
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
    { data: instituteEnrollmentRows },
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
      ? supabase.from("class_teachers").select("teacher_id, is_visible, status").eq("class_id", instituteId)
      : Promise.resolve({ data: [] as { teacher_id: string; is_visible: boolean; status: "pending" | "accepted" | "declined" }[] }),
    // Row count would now overcount — a student can hold more than one
    // class at this institute (0092), so this needs the distinct student
    // behind those rows, not the row count itself.
    instituteId
      ? supabase.from("enrollments").select("student_id").eq("owner_type", "class").eq("owner_id", instituteId)
      : Promise.resolve({ data: [] as { student_id: string }[] }),
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
          .select("id, title, mode, location, schedule_note, teacher_label, taught_by_teacher_id")
          .eq("owner_type", "class")
          .eq("owner_id", instituteId)
          .order("created_at", { ascending: false })
      : Promise.resolve({
          data: [] as {
            id: string;
            title: string;
            mode: "online" | "physical";
            location: string | null;
            schedule_note: string | null;
            teacher_label: string | null;
            taught_by_teacher_id: string | null;
          }[],
        }),
    instituteId
      ? supabase.from("enrollments").select("batch_id").eq("owner_type", "class").eq("owner_id", instituteId)
      : Promise.resolve({ data: [] as { batch_id: string | null }[] }),
  ]);

  const teacherIds = (classTeacherRows ?? []).map((row) => row.teacher_id);
  const acceptedTeacherIds = (classTeacherRows ?? [])
    .filter((row) => row.status === "accepted")
    .map((row) => row.teacher_id);

  const isVisibleById = new Map((classTeacherRows ?? []).map((row) => [row.teacher_id, row.is_visible]));
  const rosterStatusById = new Map((classTeacherRows ?? []).map((row) => [row.teacher_id, row.status]));
  const studentsCount = new Set((instituteEnrollmentRows ?? []).map((row) => row.student_id)).size;

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
    teacherNameById = nameById;
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
        rosterStatus: rosterStatusById.get(teacherId) === "pending" ? "pending" : "accepted",
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
    // Real roster link wins when set; falls back to the old free-text label
    // for batches created before 0091 that haven't been re-saved since.
    teacherLabel: (b.taught_by_teacher_id && teacherNameById.get(b.taught_by_teacher_id)) || b.teacher_label,
    studentCount: batchStudentCounts.get(b.id) ?? 0,
  }));

  // Only an accepted roster teacher can be assigned to a class — a pending
  // invite hasn't agreed to anything yet.
  const rosterTeacherOptions = acceptedTeacherIds.map((id) => ({
    id,
    name: teacherNameById.get(id) ?? "—",
  }));

  const referrals: ReferralRow[] = (myReferralRows ?? []).map((row) => ({
    id: row.id,
    name: row.referred_name,
    status: row.reward_status,
    dateLabel: dateFormatter.format(new Date(row.created_at)),
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
            teachersCount={acceptedTeacherIds.length}
            studentsCount={studentsCount}
            averageRating={averageRating}
            batchesCount={batches.length}
            teachersAtGlance={teachersAtGlance}
          />
        ),
        teachers: <TeachersTab teachers={instituteTeachers} />,
        batches: <BatchesTab batches={batches} teacherOptions={rosterTeacherOptions} />,
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
            referralCode={referralCodeValue ?? ""}
            referrals={referrals}
          />
        ),
      }}
      defaultTab="overview"
    />
  );
}
