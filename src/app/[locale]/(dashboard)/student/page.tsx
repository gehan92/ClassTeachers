import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OverviewTab } from "@/components/dashboard/student/overview-tab";
import { ClassesTab } from "@/components/dashboard/student/classes-tab";
import { LiveClassesTab } from "@/components/dashboard/student/live-classes-tab";
import { NotesTab } from "@/components/dashboard/student/notes-tab";
import { ExamsTab } from "@/components/dashboard/student/exams-tab";
import { ReviewsTab } from "@/components/dashboard/student/reviews-tab";
import { ProfileTab } from "@/components/dashboard/student/profile-tab";
import { CURRENT_STUDENT } from "@/lib/mock-data";

export default async function StudentDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("studentDashboard");

  return (
    <DashboardShell
      userLabel={CURRENT_STUDENT.name}
      userInitial="S"
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
            { key: "exams", label: t("tabs.exams"), count: 2 },
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
        overview: <OverviewTab />,
        classes: <ClassesTab />,
        live: <LiveClassesTab />,
        notes: <NotesTab />,
        exams: <ExamsTab />,
        reviews: <ReviewsTab />,
        profile: <ProfileTab />,
      }}
      defaultTab="overview"
    />
  );
}
