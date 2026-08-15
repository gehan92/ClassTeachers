"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/dashboard/stat-card";

export function SubscriptionsTab() {
  const t = useTranslations("adminDashboard.subscriptions");
  const tCommon = useTranslations("adminDashboard");
  const [standardPrice, setStandardPrice] = useState("2500");
  const [premiumPrice, setPremiumPrice] = useState("4900");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("stats.free")} value="1,240" />
        <StatCard label={t("stats.standard")} value="690" delta="Rs. 8.3M MRR" />
        <StatCard label={t("stats.premium")} value="144" delta="Rs. 4.1M MRR" />
        <StatCard label={t("stats.churn")} value="2.1%" delta="+0.3pp" deltaDown />
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
          <Button onClick={handleSave}>{t("pricing.save")}</Button>
          {saved && <span className="text-sm font-medium text-success">{tCommon("saved")}</span>}
        </div>
      </div>
    </div>
  );
}
