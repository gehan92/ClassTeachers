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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SiteAnnouncementBar } from "@/components/layout/site-announcement-bar";
import { setPlatformFeature } from "@/lib/dashboard/admin-actions";
import { updateAnnouncement } from "@/lib/dashboard/admin-insights-actions";
import { cn } from "@/lib/utils";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import type { PlatformFeatureState } from "@/types/dashboard-admin";

type FeatureKey = PlatformFeatureState["key"];
type Tone = "info" | "warning" | "success";
export type AnnouncementSettings = { enabled: boolean; text: string; tone: Tone };
const TONES: Tone[] = ["info", "warning", "success"];
const MAX_LENGTH = 240;

/**
 * Platform-wide on/off switches. Turning something OFF asks for
 * confirmation first since it affects every user at once; turning it back
 * ON is immediate. Each switch is enforced server-side in the action it
 * guards (see src/lib/platform-features.ts), not just hidden in the UI.
 */
export function PlatformSwitchesTab({
  initialFeatures,
  initialAnnouncement,
}: {
  initialFeatures: PlatformFeatureState[];
  initialAnnouncement: AnnouncementSettings;
}) {
  const t = useTranslations("adminDashboard.platformSwitches");
  const { refresh } = useDashboardRefresh();
  const [features, setFeatures] = useState(initialFeatures);
  const [pendingKey, setPendingKey] = useState<FeatureKey | null>(null);
  const [confirmOffKey, setConfirmOffKey] = useState<FeatureKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState(initialAnnouncement);
  const [savedAnnouncement, setSavedAnnouncement] = useState(initialAnnouncement);
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [announcementSaved, setAnnouncementSaved] = useState(false);
  const announcementDirty =
    announcement.enabled !== savedAnnouncement.enabled ||
    announcement.text.trim() !== savedAnnouncement.text.trim() ||
    announcement.tone !== savedAnnouncement.tone;

  async function saveAnnouncement(next: AnnouncementSettings) {
    setAnnouncementSaving(true);
    setAnnouncementError(null);
    setAnnouncementSaved(false);
    const result = await updateAnnouncement(next);
    setAnnouncementSaving(false);
    if (result.error) {
      setAnnouncementError(result.error);
      return;
    }
    setAnnouncement(next);
    setSavedAnnouncement(next);
    setAnnouncementSaved(true);
    refresh();
  }

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

      <section className="mb-8 rounded-lg border border-border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">{t("announcement.title")}</h2>
              <StatusBadge variant={savedAnnouncement.enabled ? "active" : "flagged"}>
                {savedAnnouncement.enabled ? t("announcement.live") : t("off")}
              </StatusBadge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t("announcement.description")}</p>
          </div>
          <Switch
            checked={announcement.enabled}
            disabled={announcementSaving}
            onCheckedChange={(checked) => {
              setAnnouncementSaved(false);
              setAnnouncement((prev) => ({ ...prev, enabled: checked }));
            }}
            aria-label={t("announcement.title")}
          />
        </div>

        <div className="mt-4 grid gap-1.5">
          <Label htmlFor="announcement-text">{t("announcement.messageLabel")}</Label>
          <Textarea
            id="announcement-text"
            value={announcement.text}
            maxLength={MAX_LENGTH}
            rows={2}
            placeholder={t("announcement.placeholder")}
            onChange={(e) => {
              setAnnouncementSaved(false);
              setAnnouncement((prev) => ({ ...prev, text: e.target.value }));
            }}
          />
          <span className="text-right text-[11px] text-muted-foreground tabular-nums">
            {announcement.text.length} / {MAX_LENGTH}
          </span>
        </div>

        <fieldset className="mt-2">
          <legend className="mb-2 text-sm font-medium text-foreground">{t("announcement.toneLabel")}</legend>
          <div className="flex flex-wrap gap-2">
            {TONES.map((tone) => (
              <button
                key={tone}
                type="button"
                aria-pressed={announcement.tone === tone}
                onClick={() => {
                  setAnnouncementSaved(false);
                  setAnnouncement((prev) => ({ ...prev, tone }));
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  announcement.tone === tone ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`announcement.tones.${tone}`)}
              </button>
            ))}
          </div>
        </fieldset>

        {announcement.text.trim().length > 0 && (
          <div className="mt-4">
            <span className="mb-1.5 block font-mono text-[11px] tracking-wide text-muted-foreground uppercase">{t("announcement.preview")}</span>
            <div className="overflow-hidden rounded-md border border-border">
              <SiteAnnouncementBar preview announcement={{ text: announcement.text.trim(), tone: announcement.tone }} />
            </div>
          </div>
        )}

        {announcementError && <p className="mt-3 text-sm font-medium text-destructive">{announcementError}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => saveAnnouncement(announcement)} disabled={announcementSaving || !announcementDirty}>
            {announcementSaving ? t("announcement.saving") : announcement.enabled ? t("announcement.publish") : t("announcement.save")}
          </Button>
          {announcementSaved && !announcementDirty && (
            <span className="text-sm text-success" role="status">
              {savedAnnouncement.enabled ? t("announcement.published") : t("announcement.savedOff")}
            </span>
          )}
        </div>
      </section>

      <h2 className="mb-3 text-sm font-semibold text-foreground">{t("switchesHeading")}</h2>
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
