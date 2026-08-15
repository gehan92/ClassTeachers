import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OverviewTab } from "@/components/dashboard/admin/overview-tab";
import { ApprovalsTab } from "@/components/dashboard/admin/approvals-tab";
import { UsersTab } from "@/components/dashboard/admin/users-tab";
import { SubscriptionsTab } from "@/components/dashboard/admin/subscriptions-tab";
import { SiteAdsTab } from "@/components/dashboard/admin/site-ads-tab";
import { FlaggedReviewsTab } from "@/components/dashboard/admin/flagged-reviews-tab";

export default async function AdminDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("adminDashboard");

  return (
    <DashboardShell
      brandBadge="ADMIN"
      userLabel="Gehan (Admin)"
      userInitial="G"
      logoutLabel={t("logout")}
      demoRole="admin"
      groups={[
        {
          label: t("groupPlatform"),
          items: [
            { key: "overview", label: t("tabs.overview") },
            { key: "approvals", label: t("tabs.approvals"), count: 5 },
            { key: "users", label: t("tabs.users") },
          ],
        },
        {
          label: t("groupMonetization"),
          items: [
            { key: "subscriptions", label: t("tabs.subscriptions") },
            { key: "siteAds", label: t("tabs.siteAds") },
          ],
        },
        {
          label: t("groupTrust"),
          items: [{ key: "flagged", label: t("tabs.flagged"), count: 2 }],
        },
      ]}
      panels={{
        overview: <OverviewTab />,
        approvals: <ApprovalsTab />,
        users: <UsersTab />,
        subscriptions: <SubscriptionsTab />,
        siteAds: <SiteAdsTab />,
        flagged: <FlaggedReviewsTab />,
      }}
      defaultTab="overview"
    />
  );
}
