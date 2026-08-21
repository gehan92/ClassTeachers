import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OverviewTab } from "@/components/dashboard/admin/overview-tab";
import { ApprovalsTab } from "@/components/dashboard/admin/approvals-tab";
import { UsersTab } from "@/components/dashboard/admin/users-tab";
import { SubscriptionsTab } from "@/components/dashboard/admin/subscriptions-tab";
import { SiteAdsTab } from "@/components/dashboard/admin/site-ads-tab";
import { FlaggedReviewsTab } from "@/components/dashboard/admin/flagged-reviews-tab";
import { createClient } from "@/lib/supabase/server";
import { roleDashboardPath } from "@/lib/auth/routes";

export default async function AdminDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("adminDashboard");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // proxy.ts only checks that a session exists, not the role — unlike
  // student/teacher/institute (where a wrong-role visitor just sees their
  // own empty data), admin tabs are meant to expose every user's data, so
  // this route needs its own explicit role check rather than relying on
  // table-level scoping to make cross-role access harmless.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "admin") {
    redirect(`/${locale}${roleDashboardPath[profile?.role ?? "student"]}`);
  }

  const userInitial = profile.full_name.charAt(0).toUpperCase();

  return (
    <DashboardShell
      brandBadge="ADMIN"
      userLabel={profile.full_name}
      userInitial={userInitial}
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
