"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/features/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { createSiteAd } from "@/lib/dashboard/admin-actions";
import type { SiteAd, SiteAdPlacement, SiteAdPlan } from "@/types/dashboard-admin";

export function SiteAdsTab({ initialAds }: { initialAds: SiteAd[] }) {
  const t = useTranslations("adminDashboard.siteAds");
  const tc = useTranslations("adminDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [showForm, setShowForm] = useState(false);
  const [sponsor, setSponsor] = useState("");
  const [plan, setPlan] = useState<SiteAdPlan>("basic");
  const [placement, setPlacement] = useState<SiteAdPlacement>("search_results");
  const [expiresAt, setExpiresAt] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planLabels: Record<SiteAdPlan, string> = {
    basic: t("plans.basic"),
    featured: t("plans.featured"),
    homepage_spotlight: t("plans.spotlight"),
  };

  const placementLabels: Record<SiteAdPlacement, string> = {
    search_results: t("placements.searchResults"),
    homepage_banner: t("placements.homepageBanner"),
    homepage_spotlight: t("placements.homepageSpotlight"),
  };

  function resetForm() {
    setSponsor("");
    setPlan("basic");
    setPlacement("search_results");
    setExpiresAt("");
    setContent("");
    setShowForm(false);
  }

  async function handleAdd() {
    if (sponsor.trim().length === 0) return;
    setSaving(true);
    setError(null);
    const result = await createSiteAd({
      sponsor: sponsor.trim(),
      plan,
      placement,
      expiresAt: expiresAt || null,
      content: content.trim() || undefined,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    resetForm();
    refresh();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setShowForm((prev) => !prev)}>{t("newAdSlot")}</Button>
      </div>

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updatingList")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reloadPage")}
        className="mb-4"
      />

      {error && <p className="mb-4 text-sm font-medium text-destructive">{error}</p>}

      {showForm && (
        <div className="mb-4 rounded-lg border border-border bg-white p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="new-ad-sponsor" className="mb-1.5 block text-sm text-muted-foreground">
                {t("newAdForm.sponsorLabel")}
              </Label>
              <Input
                id="new-ad-sponsor"
                value={sponsor}
                onChange={(e) => setSponsor(e.target.value)}
                placeholder={t("newAdForm.sponsorPlaceholder")}
              />
            </div>
            <div>
              <Label htmlFor="new-ad-plan" className="mb-1.5 block text-sm text-muted-foreground">
                {t("newAdForm.planLabel")}
              </Label>
              <Select value={plan} onValueChange={(value) => setPlan(value as SiteAdPlan)}>
                <SelectTrigger id="new-ad-plan" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">{t("plans.basic")}</SelectItem>
                  <SelectItem value="featured">{t("plans.featured")}</SelectItem>
                  <SelectItem value="homepage_spotlight">{t("plans.spotlight")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="new-ad-placement" className="mb-1.5 block text-sm text-muted-foreground">
                {t("newAdForm.placementLabel")}
              </Label>
              <Select value={placement} onValueChange={(value) => setPlacement(value as SiteAdPlacement)}>
                <SelectTrigger id="new-ad-placement" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="search_results">{t("placements.searchResults")}</SelectItem>
                  <SelectItem value="homepage_banner">{t("placements.homepageBanner")}</SelectItem>
                  <SelectItem value="homepage_spotlight">{t("placements.homepageSpotlight")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="new-ad-expires" className="mb-1.5 block text-sm text-muted-foreground">
                {t("newAdForm.expiresLabel")}
              </Label>
              <Input
                id="new-ad-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="new-ad-content" className="mb-1.5 block text-sm text-muted-foreground">
              {t("newAdForm.contentLabel")}
            </Label>
            <Textarea
              id="new-ad-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("newAdForm.contentPlaceholder")}
              rows={2}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              {t("newAdForm.add")}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm} disabled={saving}>
              {t("newAdForm.cancel")}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-white p-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.sponsor")}</TableHead>
              <TableHead>{t("columns.plan")}</TableHead>
              <TableHead>{t("columns.placement")}</TableHead>
              <TableHead>{t("columns.expires")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialAds.map((ad) => (
              <TableRow key={ad.id}>
                <TableCell className="font-medium text-foreground">{ad.sponsor}</TableCell>
                <TableCell className="text-muted-foreground">{planLabels[ad.plan]}</TableCell>
                <TableCell className="text-muted-foreground">{placementLabels[ad.placement]}</TableCell>
                <TableCell className="text-muted-foreground">{ad.expiresDisplay}</TableCell>
                <TableCell>
                  <StatusBadge variant={ad.status === "expiring" ? "pending" : "active"}>
                    {ad.status === "expiring" ? t("status.expiring") : t("status.live")}
                  </StatusBadge>
                </TableCell>
              </TableRow>
            ))}
            {initialAds.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
