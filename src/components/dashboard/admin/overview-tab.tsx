import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OverviewTab({
  teachersCount,
  teachersDelta,
  institutesCount,
  institutesDelta,
  studentsCount,
  studentsDelta,
  revenueDisplay,
  pendingApprovalsCount,
  flaggedCount,
  expiringAdsCount,
  nextExpiringAd,
}: {
  teachersCount: number;
  teachersDelta: number;
  institutesCount: number;
  institutesDelta: number;
  studentsCount: number;
  studentsDelta: number;
  revenueDisplay: string;
  pendingApprovalsCount: number;
  flaggedCount: number;
  expiringAdsCount: number;
  nextExpiringAd: { sponsor: string; expiresDisplay: string } | null;
}) {
  const t = useTranslations("adminDashboard.overview");

  return (
    <div>
      <div className="mb-6">
        <DashboardHero
          title={t("title")}
          subtitle={t("subtitle")}
          actions={[
            { label: t("hero.reviewApprovals"), href: { pathname: "/admin", query: { tab: "approvals" } } },
            { label: t("hero.manageAds"), href: { pathname: "/admin", query: { tab: "siteAds" } }, variant: "cta" },
          ]}
          stats={[
            {
              label: t("stats.teachers"),
              value: teachersDelta > 0 ? `${teachersCount.toLocaleString()} (+${teachersDelta})` : teachersCount.toLocaleString(),
              href: { pathname: "/admin", query: { tab: "users" } },
            },
            {
              label: t("stats.institutes"),
              value: institutesDelta > 0 ? `${institutesCount.toLocaleString()} (+${institutesDelta})` : institutesCount.toLocaleString(),
              href: { pathname: "/admin", query: { tab: "users" } },
            },
            {
              label: t("stats.students"),
              value: studentsDelta > 0 ? `${studentsCount.toLocaleString()} (+${studentsDelta})` : studentsCount.toLocaleString(),
              href: { pathname: "/admin", query: { tab: "users" } },
            },
            { label: t("stats.revenue"), value: revenueDisplay, href: { pathname: "/admin", query: { tab: "subscriptions" } } },
          ]}
        />
      </div>

      <h3 className="mt-8 mb-4 text-lg">{t("attentionHeading")}</h3>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-white p-4.5">
          <h4 className="mb-1 font-semibold text-foreground">
            {t("attention.approvals.title", { count: pendingApprovalsCount })}
          </h4>
          <p className="mb-3 text-sm text-muted-foreground">
            {pendingApprovalsCount > 0 ? t("attention.approvals.body") : t("attention.approvals.empty")}
          </p>
          <Link
            href={{ pathname: "/admin", query: { tab: "approvals" } }}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            {t("attention.approvals.cta")}
          </Link>
        </div>
        <div className="rounded-lg border border-border bg-white p-4.5">
          <h4 className="mb-1 font-semibold text-foreground">
            {t("attention.flagged.title", { count: flaggedCount })}
          </h4>
          <p className="mb-3 text-sm text-muted-foreground">
            {flaggedCount > 0 ? t("attention.flagged.body") : t("attention.flagged.empty")}
          </p>
          <Link
            href={{ pathname: "/admin", query: { tab: "flagged" } }}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            {t("attention.flagged.cta")}
          </Link>
        </div>
        <div className="rounded-lg border border-border bg-white p-4.5">
          <h4 className="mb-1 font-semibold text-foreground">
            {t("attention.ads.title", { count: expiringAdsCount })}
          </h4>
          <p className="mb-3 text-sm text-muted-foreground">
            {nextExpiringAd
              ? t("attention.ads.body", { sponsor: nextExpiringAd.sponsor, expires: nextExpiringAd.expiresDisplay })
              : t("attention.ads.empty")}
          </p>
          <Link
            href={{ pathname: "/admin", query: { tab: "siteAds" } }}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            {t("attention.ads.cta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
