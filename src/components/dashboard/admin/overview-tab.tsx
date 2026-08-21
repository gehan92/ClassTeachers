import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { StatCard } from "@/components/dashboard/stat-card";
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
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("stats.teachers")}
          value={teachersCount.toLocaleString()}
          delta={teachersDelta > 0 ? t("stats.thisWeek", { count: teachersDelta }) : undefined}
        />
        <StatCard
          label={t("stats.institutes")}
          value={institutesCount.toLocaleString()}
          delta={institutesDelta > 0 ? t("stats.thisWeek", { count: institutesDelta }) : undefined}
        />
        <StatCard
          label={t("stats.students")}
          value={studentsCount.toLocaleString()}
          delta={studentsDelta > 0 ? t("stats.thisWeek", { count: studentsDelta }) : undefined}
        />
        <StatCard label={t("stats.revenue")} value={revenueDisplay} />
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
