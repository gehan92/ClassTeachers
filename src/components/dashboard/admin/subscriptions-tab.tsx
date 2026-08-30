"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/dashboard/stat-card";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { updatePlatformSetting } from "@/lib/dashboard/admin-actions";

export function SubscriptionsTab({
  freeCount,
  standardCount,
  premiumCount,
  standardMrrDisplay,
  premiumMrrDisplay,
  churnDisplay,
  initialStandardPrice,
  initialPremiumPrice,
}: {
  freeCount: number;
  standardCount: number;
  premiumCount: number;
  standardMrrDisplay: string;
  premiumMrrDisplay: string;
  churnDisplay: string;
  initialStandardPrice: string;
  initialPremiumPrice: string;
}) {
  const t = useTranslations("adminDashboard.subscriptions");
  const tCommon = useTranslations("adminDashboard");
  const tc = useTranslations("adminDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [standardPrice, setStandardPrice] = useState(initialStandardPrice);
  const [premiumPrice, setPremiumPrice] = useState(initialPremiumPrice);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const [standardResult, premiumResult] = await Promise.all([
      updatePlatformSetting({ key: "standard_price", value: standardPrice }),
      updatePlatformSetting({ key: "premium_price", value: premiumPrice }),
    ]);
    setSaving(false);
    if (standardResult.error || premiumResult.error) {
      setError(standardResult.error ?? premiumResult.error ?? null);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    refresh();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("stats.free")} value={freeCount} />
        <StatCard label={t("stats.standard")} value={standardCount} delta={standardMrrDisplay} />
        <StatCard label={t("stats.premium")} value={premiumCount} delta={premiumMrrDisplay} />
        <StatCard label={t("stats.churn")} value={churnDisplay} />
      </div>

      <div className="mt-6 rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("pricing.heading")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:max-w-lg">
          <div>
            <Label htmlFor="standard-price" className="mb-1.5 block text-sm text-muted-foreground">
              {t("pricing.standardLabel")}
            </Label>
            <Input
              id="standard-price"
              value={standardPrice}
              onChange={(e) => setStandardPrice(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div>
            <Label htmlFor="premium-price" className="mb-1.5 block text-sm text-muted-foreground">
              {t("pricing.premiumLabel")}
            </Label>
            <Input
              id="premium-price"
              value={premiumPrice}
              onChange={(e) => setPremiumPrice(e.target.value)}
              inputMode="numeric"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {t("pricing.save")}
          </Button>
          {saved && <span className="animate-in fade-in-0 text-sm font-medium text-success duration-200">{tCommon("saved")}</span>}
          {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        </div>
        <RefreshStatus
          pending={isRefreshing}
          stuck={refreshStuck}
          pendingLabel={tc("updatingList")}
          stuckLabel={tc("updateStuck")}
          reloadLabel={tc("reloadPage")}
          className="mt-2"
        />
      </div>
    </div>
  );
}
