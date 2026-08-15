import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { StatCard } from "@/components/dashboard/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OverviewTab() {
  const t = useTranslations("adminDashboard.overview");

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("stats.teachers")} value="1,860" delta="+42 this week" />
        <StatCard label={t("stats.institutes")} value="214" delta="+3 this week" />
        <StatCard label={t("stats.students")} value="28,940" delta="+680 this week" />
        <StatCard label={t("stats.revenue")} value="Rs. 1.94M" delta="+9%" />
      </div>

      <h3 className="mt-8 mb-4 text-lg">{t("attentionHeading")}</h3>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-white p-4.5">
          <h4 className="mb-1 font-semibold text-foreground">{t("attention.approvals.title")}</h4>
          <p className="mb-3 text-sm text-muted-foreground">{t("attention.approvals.body")}</p>
          <Link
            href={{ pathname: "/admin", query: { tab: "approvals" } }}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            {t("attention.approvals.cta")}
          </Link>
        </div>
        <div className="rounded-lg border border-border bg-white p-4.5">
          <h4 className="mb-1 font-semibold text-foreground">{t("attention.flagged.title")}</h4>
          <p className="mb-3 text-sm text-muted-foreground">{t("attention.flagged.body")}</p>
          <Link
            href={{ pathname: "/admin", query: { tab: "flagged" } }}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            {t("attention.flagged.cta")}
          </Link>
        </div>
        <div className="rounded-lg border border-border bg-white p-4.5">
          <h4 className="mb-1 font-semibold text-foreground">{t("attention.ads.title")}</h4>
          <p className="mb-3 text-sm text-muted-foreground">{t("attention.ads.body")}</p>
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
