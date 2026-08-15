import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OverviewTab } from "@/components/dashboard/institute/overview-tab";
import { TeachersTab } from "@/components/dashboard/institute/teachers-tab";
import { BatchesTab } from "@/components/dashboard/institute/batches-tab";
import { AdvertisementTab } from "@/components/dashboard/institute/advertisement-tab";
import { ReviewsTab } from "@/components/dashboard/institute/reviews-tab";
import { SettingsTab } from "@/components/dashboard/institute/settings-tab";

export default async function InstituteDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("instituteDashboard");

  return (
    <DashboardShell
      publicProfileHref="/class/c-1"
      publicProfileLabel={t("publicProfile")}
      userLabel="Horizon Learning Institute"
      userInitial="H"
      logoutLabel={t("logout")}
      demoRole="class"
      groups={[
        {
          label: t("groupInstitute"),
          items: [
            { key: "overview", label: t("tabs.overview") },
            { key: "teachers", label: t("tabs.teachers"), count: 6 },
            { key: "batches", label: t("tabs.batches"), count: 9 },
          ],
        },
        {
          label: t("groupManage"),
          items: [
            { key: "ads", label: t("tabs.ads") },
            { key: "reviews", label: t("tabs.reviews"), count: 211 },
            { key: "settings", label: t("tabs.settings") },
          ],
        },
      ]}
      panels={{
        overview: <OverviewTab />,
        teachers: <TeachersTab />,
        batches: <BatchesTab />,
        ads: <AdvertisementTab />,
        reviews: <ReviewsTab />,
        settings: <SettingsTab />,
      }}
      defaultTab="overview"
    />
  );
}
