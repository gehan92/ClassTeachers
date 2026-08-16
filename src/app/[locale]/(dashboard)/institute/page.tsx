import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OverviewTab } from "@/components/dashboard/institute/overview-tab";
import { TeachersTab } from "@/components/dashboard/institute/teachers-tab";
import { BatchesTab } from "@/components/dashboard/institute/batches-tab";
import { AdvertisementTab } from "@/components/dashboard/institute/advertisement-tab";
import { ReviewsTab } from "@/components/dashboard/institute/reviews-tab";
import { SettingsTab } from "@/components/dashboard/institute/settings-tab";
import { createClient } from "@/lib/supabase/server";
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
    supabase.from("profiles").select("full_name, phone").eq("id", userId).single(),
    supabase.from("class_profiles").select("*").eq("owner_id", userId).maybeSingle(),
  ]);

  const fullName = profile?.full_name ?? user!.email ?? "Institute";
  const userInitial = fullName.charAt(0).toUpperCase();
  const instituteId = classProfile?.id;

  const [{ data: classTeacherRows }, { count: studentsCount }, { data: reviewRows }, { data: priceRow }] =
    await Promise.all([
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
    ]);

  const teacherIds = (classTeacherRows ?? []).map((row) => row.teacher_id);

  let teachersAtGlance: TeachersAtGlance[] = [];
  if (teacherIds.length > 0) {
    const [{ data: teacherProfiles }, { data: teacherPersonProfiles }, { data: teacherEnrollments }, { data: teacherReviews }] =
      await Promise.all([
        supabase.from("teacher_profiles").select("id, headline, status").in("id", teacherIds),
        supabase.from("profiles").select("id, full_name").in("id", teacherIds),
        supabase.from("enrollments").select("owner_id").eq("owner_type", "teacher").in("owner_id", teacherIds),
        supabase.from("reviews").select("target_id, rating").eq("target_type", "teacher").in("target_id", teacherIds),
      ]);

    const nameById = new Map((teacherPersonProfiles ?? []).map((p) => [p.id, p.full_name]));
    const headlineById = new Map((teacherProfiles ?? []).map((p) => [p.id, p.headline]));
    const statusById = new Map((teacherProfiles ?? []).map((p) => [p.id, p.status]));

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
  }

  const averageRating = reviewRows?.length
    ? (reviewRows.reduce((sum, r) => sum + r.rating, 0) / reviewRows.length).toFixed(1)
    : null;

  const [{ data: batchRows }, { data: batchEnrollmentRows }] = await Promise.all([
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
      publicProfileHref={instituteId ? `/class/${instituteId}` : undefined}
      publicProfileLabel={t("publicProfile")}
      userLabel={fullName}
      userInitial={userInitial}
      logoutLabel={t("logout")}
      demoRole="class"
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
        teachers: <TeachersTab />,
        batches: <BatchesTab batches={batches} />,
        ads: <AdvertisementTab />,
        reviews: <ReviewsTab />,
        settings: (
          <SettingsTab
            initialName={classProfile?.name ?? fullName}
            initialLocation={classProfile?.location ?? ""}
            initialPhone={profile?.phone ?? ""}
            initialHourlyRate={priceRow?.hourly_rate?.toString() ?? ""}
            initialMonthlyRate={priceRow?.monthly_rate?.toString() ?? ""}
          />
        ),
      }}
      defaultTab="overview"
    />
  );
}
