"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/features/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { siteAds } from "@/lib/mock-data";
import type { SiteAd, SiteAdPlan } from "@/types/dashboard-admin";

export function SiteAdsTab() {
  const t = useTranslations("adminDashboard.siteAds");
  const [ads, setAds] = useState<SiteAd[]>(siteAds);
  const [showForm, setShowForm] = useState(false);
  const [sponsor, setSponsor] = useState("");
  const [plan, setPlan] = useState<SiteAdPlan>("basic");
  const [placement, setPlacement] = useState("");
  const [expiresDisplay, setExpiresDisplay] = useState("");

  const planLabels: Record<SiteAdPlan, string> = {
    basic: t("plans.basic"),
    featured: t("plans.featured"),
    spotlight: t("plans.spotlight"),
  };

  function resetForm() {
    setSponsor("");
    setPlan("basic");
    setPlacement("");
    setExpiresDisplay("");
    setShowForm(false);
  }

  function handleAdd() {
    if (sponsor.trim().length === 0) return;
    setAds((prev) => [
      ...prev,
      {
        id: `ad-${Date.now()}`,
        sponsor: sponsor.trim(),
        plan,
        placement: placement.trim(),
        expiresDisplay: expiresDisplay.trim(),
        status: "live",
      },
    ]);
    resetForm();
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
                  <SelectItem value="spotlight">{t("plans.spotlight")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="new-ad-placement" className="mb-1.5 block text-sm text-muted-foreground">
                {t("newAdForm.placementLabel")}
              </Label>
              <Input
                id="new-ad-placement"
                value={placement}
                onChange={(e) => setPlacement(e.target.value)}
                placeholder={t("newAdForm.placementPlaceholder")}
              />
            </div>
            <div>
              <Label htmlFor="new-ad-expires" className="mb-1.5 block text-sm text-muted-foreground">
                {t("newAdForm.expiresLabel")}
              </Label>
              <Input
                id="new-ad-expires"
                value={expiresDisplay}
                onChange={(e) => setExpiresDisplay(e.target.value)}
                placeholder={t("newAdForm.expiresPlaceholder")}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={handleAdd}>
              {t("newAdForm.add")}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm}>
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
            {ads.map((ad) => (
              <TableRow key={ad.id}>
                <TableCell className="font-medium text-foreground">{ad.sponsor}</TableCell>
                <TableCell className="text-muted-foreground">{planLabels[ad.plan]}</TableCell>
                <TableCell className="text-muted-foreground">{ad.placement}</TableCell>
                <TableCell className="text-muted-foreground">{ad.expiresDisplay}</TableCell>
                <TableCell>
                  <StatusBadge variant={ad.status === "expiring" ? "pending" : "active"}>
                    {ad.status === "expiring" ? t("status.expiring") : t("status.live")}
                  </StatusBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
