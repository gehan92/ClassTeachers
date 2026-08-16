"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateInstituteProfile } from "@/lib/dashboard/actions";

export function SettingsTab({
  initialName,
  initialLocation,
  initialPhone,
  initialHourlyRate,
  initialMonthlyRate,
}: {
  initialName: string;
  initialLocation: string;
  initialPhone: string;
  initialHourlyRate: string;
  initialMonthlyRate: string;
}) {
  const t = useTranslations("instituteDashboard.settings");

  // "Established" year has no backing column on class_profiles — kept as
  // local-only until there's a schema decision for where it should live.
  const [details, setDetails] = useState({
    name: initialName,
    established: "",
    location: initialLocation,
    phone: initialPhone,
  });
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);

  const [rate, setRate] = useState({ hourly: initialHourlyRate, monthly: initialMonthlyRate });
  const [rateSaved, setRateSaved] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [savingRate, setSavingRate] = useState(false);

  async function handleSaveDetails() {
    setSavingDetails(true);
    setDetailsError(null);
    const result = await updateInstituteProfile({
      name: details.name,
      location: details.location,
      phone: details.phone,
      hourlyRate: rate.hourly,
      monthlyRate: rate.monthly,
    });
    setSavingDetails(false);
    if (result.error) {
      setDetailsError(result.error);
      return;
    }
    setDetailsSaved(true);
    setTimeout(() => setDetailsSaved(false), 2500);
  }

  async function handleSaveRate() {
    setSavingRate(true);
    setRateError(null);
    const result = await updateInstituteProfile({
      name: details.name,
      location: details.location,
      phone: details.phone,
      hourlyRate: rate.hourly,
      monthlyRate: rate.monthly,
    });
    setSavingRate(false);
    if (result.error) {
      setRateError(result.error);
      return;
    }
    setRateSaved(true);
    setTimeout(() => setRateSaved(false), 2500);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("logo.title")}</h3>
        <div className="flex items-center gap-4">
          <div className="flex size-19 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
            <School className="size-8" />
          </div>
          <Button variant="outline">{t("logo.upload")}</Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("details.title")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="institute-name">{t("details.nameLabel")}</Label>
            <Input
              id="institute-name"
              value={details.name}
              onChange={(e) => setDetails((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="institute-established">{t("details.establishedLabel")}</Label>
            <Input
              id="institute-established"
              value={details.established}
              onChange={(e) => setDetails((prev) => ({ ...prev, established: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="institute-location">{t("details.locationLabel")}</Label>
            <Input
              id="institute-location"
              value={details.location}
              onChange={(e) => setDetails((prev) => ({ ...prev, location: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="institute-phone">{t("details.phoneLabel")}</Label>
            <Input
              id="institute-phone"
              type="tel"
              value={details.phone}
              onChange={(e) => setDetails((prev) => ({ ...prev, phone: e.target.value }))}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleSaveDetails} disabled={savingDetails}>
            {t("save")}
          </Button>
          {detailsSaved && <span className="text-sm font-medium text-success">{t("saved")}</span>}
          {detailsError && <span className="text-sm font-medium text-destructive">{detailsError}</span>}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("rate.title")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="institute-rate-hourly">{t("rate.hourlyLabel")}</Label>
            <Input
              id="institute-rate-hourly"
              type="number"
              min={0}
              value={rate.hourly}
              onChange={(e) => setRate((prev) => ({ ...prev, hourly: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="institute-rate-monthly">{t("rate.monthlyLabel")}</Label>
            <Input
              id="institute-rate-monthly"
              type="number"
              min={0}
              value={rate.monthly}
              onChange={(e) => setRate((prev) => ({ ...prev, monthly: e.target.value }))}
            />
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{t("rate.helper")}</p>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleSaveRate} disabled={savingRate}>
            {t("save")}
          </Button>
          {rateSaved && <span className="text-sm font-medium text-success">{t("saved")}</span>}
          {rateError && <span className="text-sm font-medium text-destructive">{rateError}</span>}
        </div>
      </div>
    </div>
  );
}
