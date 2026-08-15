import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OverviewTab } from "@/components/dashboard/teacher/overview-tab";
import { ProfileTab } from "@/components/dashboard/teacher/profile-tab";
import { NotesTab } from "@/components/dashboard/teacher/notes-tab";
import { ClassesTab } from "@/components/dashboard/teacher/classes-tab";
import { QuestionBankTab } from "@/components/dashboard/teacher/question-bank-tab";
import { ExamsTab } from "@/components/dashboard/teacher/exams-tab";
import { LiveClassesTab } from "@/components/dashboard/teacher/live-classes-tab";
import { StudentsTab } from "@/components/dashboard/teacher/students-tab";
import { AttendanceTab } from "@/components/dashboard/teacher/attendance-tab";
import { ReviewsTab } from "@/components/dashboard/teacher/reviews-tab";
import { AdvertisementTab } from "@/components/dashboard/teacher/advertisement-tab";
import { SettingsTab } from "@/components/dashboard/teacher/settings-tab";

export default async function TeacherDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("teacherDashboard");

  return (
    <DashboardShell
      publicProfileHref="/teacher/t-1"
      publicProfileLabel={t("publicProfile")}
      userLabel="Mr. Piyal Kumara"
      userInitial="P"
      logoutLabel={t("logout")}
      demoRole="teacher"
      groups={[
        {
          label: t("groupTeach"),
          items: [
            { key: "overview", label: t("tabs.overview") },
            { key: "profile", label: t("tabs.profile") },
            { key: "notes", label: t("tabs.notes"), count: 12 },
            { key: "classes", label: t("tabs.classes"), count: 3 },
            { key: "questionBank", label: t("tabs.questionBank"), count: 12 },
            { key: "exams", label: t("tabs.exams"), count: 3 },
            { key: "live", label: t("tabs.live") },
          ],
        },
        {
          label: t("groupManage"),
          items: [
            { key: "students", label: t("tabs.students"), count: 86 },
            { key: "attendance", label: t("tabs.attendance") },
            { key: "reviews", label: t("tabs.reviews"), count: 128 },
            { key: "ads", label: t("tabs.ads") },
            { key: "settings", label: t("tabs.settings") },
          ],
        },
      ]}
      panels={{
        overview: <OverviewTab />,
        profile: <ProfileTab />,
        notes: <NotesTab />,
        classes: <ClassesTab />,
        questionBank: <QuestionBankTab />,
        exams: <ExamsTab />,
        live: <LiveClassesTab />,
        students: <StudentsTab />,
        attendance: <AttendanceTab />,
        reviews: <ReviewsTab />,
        ads: <AdvertisementTab />,
        settings: <SettingsTab />,
      }}
      defaultTab="overview"
    />
  );
}
