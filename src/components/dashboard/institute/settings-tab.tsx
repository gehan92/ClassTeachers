"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck, School, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateInstituteProfile, setListingPublished, resubmitListing, updateNotificationPrefs } from "@/lib/dashboard/actions";
import { uploadAvatar } from "@/lib/dashboard/avatar-actions";
import { uploadVerificationDocument } from "@/lib/dashboard/verification-actions";
import type { ProfileStatus } from "@/types/database";

export function SettingsTab({
  initialName,
  initialLocation,
  initialEstablished,
  initialPhone,
  initialHourlyRate,
  initialMonthlyRate,
  initialStatus,
  initialOwnerPublished,
  initialPhotoUrl,
  initialNotificationPrefs,
  initialInstitutionVerified,
  initialHasVerificationDocument,
}: {
  initialName: string;
  initialLocation: string;
  initialEstablished: string;
  initialPhone: string;
  initialHourlyRate: string;
  initialMonthlyRate: string;
  initialStatus: ProfileStatus;
  initialOwnerPublished: boolean;
  initialPhotoUrl: string | null;
  initialNotificationPrefs: Record<string, boolean>;
  initialInstitutionVerified: boolean;
  initialHasVerificationDocument: boolean;
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

  const [hasDocument, setHasDocument] = useState(initialHasVerificationDocument);
  const [verified, setVerified] = useState(initialInstitutionVerified);
  const [docUploading, setDocUploading] = useState(false);
  const [docSaved, setDocSaved] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  function handleUploadDocument() {
    docInputRef.current?.click();
  }

  async function handleDocumentSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setDocUploading(true);
    setDocError(null);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadVerificationDocument("class", formData);
    setDocUploading(false);
    if (result.error) {
      setDocError(result.error);
      return;
    }
    setHasDocument(true);
    setVerified(false);
    setDocSaved(true);
    setTimeout(() => setDocSaved(false), 2500);
  }

  const [status, setStatus] = useState(initialStatus);
  const [published, setPublished] = useState(initialOwnerPublished);
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

  async function handleResubmit() {
    setPublishSaving(true);
    setPublishError(null);
    const result = await resubmitListing({ kind: "class" });
    setPublishSaving(false);
    if (result.error) {
      setPublishError(result.error);
      return;
    }
    setStatus("pending");
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

  const [notifications, setNotifications] = useState({
    enrolments: initialNotificationPrefs.enrolments ?? true,
    reviews: initialNotificationPrefs.reviews ?? true,
  });

  function handleToggleNotification(key: "enrolments" | "reviews") {
    return (checked: boolean) => {
      setNotifications((n) => ({ ...n, [key]: checked }));
      updateNotificationPrefs({ [key]: checked });
    };
  }

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
        <h3 className="mb-1 text-lg">{t("publish.title")}</h3>

        {status === "pending" && <p className="text-sm text-muted-foreground">{t("publish.pending")}</p>}

        {status === "rejected" && (
          <div>
            <p className="mb-3 text-sm text-destructive">{t("publish.rejected")}</p>
            <Button type="button" size="sm" variant="outline" onClick={handleResubmit} disabled={publishSaving}>
              {t("publish.resubmit")}
            </Button>
          </div>
        )}

        {status === "suspended" && <p className="text-sm text-destructive">{t("publish.suspended")}</p>}

        {status === "approved" && (
          <>
            <p className="mb-3 text-sm text-muted-foreground">{t("publish.helper")}</p>
            <div className="flex items-center justify-between gap-4">
              <p className={`text-sm font-medium ${published ? "text-success" : "text-muted-foreground"}`}>
                {published ? t("publish.live") : t("publish.hidden")}
              </p>
              <Switch checked={published} onCheckedChange={handleTogglePublished} disabled={publishSaving} />
            </div>
          </>
        )}

        {publishError && <p className="mt-2 text-sm font-medium text-destructive">{publishError}</p>}
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-1 text-lg">{t("verifiedTier.heading")}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{t("verifiedTier.subtitle")}</p>

        <Label className="mb-1.5 block">{t("verifiedTier.documentLabel")}</Label>
        <p className="mb-2.5 text-xs text-muted-foreground">{t("verifiedTier.documentHint")}</p>
        <input
          ref={docInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleDocumentSelected}
        />
        <div className="flex flex-wrap items-center gap-2.5">
          <Button type="button" variant="outline" size="sm" onClick={handleUploadDocument} disabled={docUploading}>
            <Upload className="size-4" />
            {hasDocument ? t("verifiedTier.replaceDocument") : t("verifiedTier.uploadDocument")}
          </Button>
          {docSaved && <span className="text-sm font-medium text-success">{t("saved")}</span>}
          {docError && <span className="text-sm font-medium text-destructive">{docError}</span>}
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          {verified ? (
            <>
              <BadgeCheck className="size-3.5 shrink-0 text-primary" />
              {t("verifiedTier.verifiedNote")}
            </>
          ) : hasDocument ? (
            t("verifiedTier.pendingNote")
          ) : (
            t("verifiedTier.notVerifiedNote")
          )}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("notificationsHeading")}</h3>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="notif-enrolments">{t("notifications.enrolments")}</Label>
            <Switch
              id="notif-enrolments"
              checked={notifications.enrolments}
              onCheckedChange={handleToggleNotification("enrolments")}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="notif-reviews">{t("notifications.reviews")}</Label>
            <Switch
              id="notif-reviews"
              checked={notifications.reviews}
              onCheckedChange={handleToggleNotification("reviews")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
