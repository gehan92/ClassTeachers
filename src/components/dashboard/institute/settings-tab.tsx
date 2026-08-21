"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateInstituteProfile, setListingPublished } from "@/lib/dashboard/actions";
import { uploadAvatar } from "@/lib/dashboard/avatar-actions";

export function SettingsTab({
  initialName,
  initialLocation,
  initialEstablished,
  initialPhone,
  initialHourlyRate,
  initialMonthlyRate,
  initialPublished,
  initialPhotoUrl,
}: {
  initialName: string;
  initialLocation: string;
  initialEstablished: string;
  initialPhone: string;
  initialHourlyRate: string;
  initialMonthlyRate: string;
  initialPublished: boolean;
  initialPhotoUrl: string | null;
}) {
  const t = useTranslations("instituteDashboard.settings");

  const [logoUrl, setLogoUrl] = useState(initialPhotoUrl);
  const [logoSaved, setLogoSaved] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  function handleUploadLogo() {
    logoInputRef.current?.click();
  }

  async function handleLogoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setLogoUploading(true);
    setLogoError(null);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("ownerType", "class");
    const result = await uploadAvatar(formData);
    setLogoUploading(false);
    if (result.error || !result.url) {
      setLogoError(result.error ?? "Couldn't upload the image. Please try again.");
      return;
    }
    setLogoUrl(result.url);
    setLogoSaved(true);
    setTimeout(() => setLogoSaved(false), 2500);
  }

  const [published, setPublished] = useState(initialPublished);
  const [publishSaving, setPublishSaving] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  async function handleTogglePublished(checked: boolean) {
    setPublishSaving(true);
    setPublishError(null);
    const result = await setListingPublished({ kind: "class", published: checked });
    setPublishSaving(false);
    if (result.error) {
      setPublishError(result.error);
      return;
    }
    setPublished(checked);
  }

  const [details, setDetails] = useState({
    name: initialName,
    established: initialEstablished,
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
      established: details.established,
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
      established: details.established,
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
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-19 rounded-2xl object-cover" />
          ) : (
            <div className="flex size-19 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
              <School className="size-8" />
            </div>
          )}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleLogoSelected}
          />
          <Button type="button" variant="outline" onClick={handleUploadLogo} disabled={logoUploading}>
            {t("logo.upload")}
          </Button>
          {logoSaved && <span className="text-sm font-medium text-success">{t("saved")}</span>}
          {logoError && <span className="text-sm font-medium text-destructive">{logoError}</span>}
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

      <div className="rounded-lg border border-border bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg">{t("publish.title")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("publish.helper")}</p>
          </div>
          <Switch checked={published} onCheckedChange={handleTogglePublished} disabled={publishSaving} />
        </div>
        <p className={`mt-3 text-sm font-medium ${published ? "text-success" : "text-muted-foreground"}`}>
          {published ? t("publish.live") : t("publish.draft")}
        </p>
        {publishError && <p className="mt-2 text-sm font-medium text-destructive">{publishError}</p>}
      </div>
    </div>
  );
}
