"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/features/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setPlatformFeature } from "@/lib/dashboard/admin-actions";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import type { PlatformFeatureState } from "@/types/dashboard-admin";

type FeatureKey = PlatformFeatureState["key"];

/**
 * Platform-wide on/off switches. Turning something OFF asks for
 * confirmation first since it affects every user at once; turning it back
 * ON is immediate. Each switch is enforced server-side in the action it
 * guards (see src/lib/platform-features.ts), not just hidden in the UI.
 */
export function PlatformSwitchesTab({ initialFeatures }: { initialFeatures: PlatformFeatureState[] }) {
  const t = useTranslations("adminDashboard.platformSwitches");
  const { refresh } = useDashboardRefresh();
  const [features, setFeatures] = useState(initialFeatures);
  const [pendingKey, setPendingKey] = useState<FeatureKey | null>(null);
  const [confirmOffKey, setConfirmOffKey] = useState<FeatureKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const copy: Record<FeatureKey, { name: string; description: string; offEffect: string }> = {
    signups: { name: t("signups.name"), description: t("signups.description"), offEffect: t("signups.offEffect") },
    aiPdfImport: {
      name: t("aiPdfImport.name"),
      description: t("aiPdfImport.description"),
      offEffect: t("aiPdfImport.offEffect"),
    },
    wantedAds: { name: t("wantedAds.name"), description: t("wantedAds.description"), offEffect: t("wantedAds.offEffect") },
    liveClasses: {
      name: t("liveClasses.name"),
      description: t("liveClasses.description"),
      offEffect: t("liveClasses.offEffect"),
    },
  };

  async function apply(key: FeatureKey, enabled: boolean) {
    setPendingKey(key);
    setError(null);
    const result = await setPlatformFeature({ feature: key, enabled });
    setPendingKey(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setFeatures((prev) => prev.map((f) => (f.key === key ? { ...f, enabled } : f)));
    refresh();
  }

  function handleToggle(key: FeatureKey, enabled: boolean) {
    if (!enabled) {
      setConfirmOffKey(key);
      return;
    }
    void apply(key, true);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {error && <p className="mb-4 text-sm font-medium text-destructive">{error}</p>}

      <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-white">
        {features.map((feature) => (
          <div key={feature.key} className="flex items-start justify-between gap-4 p-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{copy[feature.key].name}</span>
                <StatusBadge variant={feature.enabled ? "active" : "flagged"}>
                  {feature.enabled ? t("on") : t("off")}
                </StatusBadge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{copy[feature.key].description}</p>
            </div>
            <Switch
              checked={feature.enabled}
              disabled={pendingKey === feature.key}
              onCheckedChange={(checked) => handleToggle(feature.key, checked)}
              aria-label={copy[feature.key].name}
            />
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{t("footnote")}</p>

      <Dialog open={confirmOffKey !== null} onOpenChange={(open) => !open && setConfirmOffKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmOffKey ? t("confirmTitle", { name: copy[confirmOffKey].name }) : ""}</DialogTitle>
            <DialogDescription>{confirmOffKey ? copy[confirmOffKey].offEffect : ""}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOffKey(null)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const key = confirmOffKey;
                setConfirmOffKey(null);
                if (key) void apply(key, false);
              }}
            >
              {t("confirmButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
