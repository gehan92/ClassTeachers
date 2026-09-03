"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateStudentAccount, updateNotificationPrefs, updatePhoneSharingPref } from "@/lib/dashboard/actions";

const panelClass = "rounded-lg border border-border bg-white p-5";

export function SettingsTab({
  initialPhone,
  initialSharePhoneWithTeachers,
  initialNotificationPrefs,
  email,
}: {
  initialPhone: string;
  initialSharePhoneWithTeachers: boolean;
  initialNotificationPrefs: Record<string, boolean>;
  email: string;
}) {
  const t = useTranslations("studentDashboard.settings");
  const tp = useTranslations("studentDashboard.profile");
  const tc = useTranslations("studentDashboard.common");

  const emailId = useId();
  const phoneId = useId();
  const sharePhoneId = useId();

  const [phone, setPhone] = useState(initialPhone);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSaveChanges() {
    setSaving(true);
    setError(null);
    const result = await updateStudentAccount({ phone });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const [sharePhone, setSharePhone] = useState(initialSharePhoneWithTeachers);
  const [phoneShareSaving, setPhoneShareSaving] = useState(false);
  const [phoneShareError, setPhoneShareError] = useState<string | null>(null);

  async function handleTogglePhoneShare(checked: boolean) {
    setSharePhone(checked);
    setPhoneShareSaving(true);
    setPhoneShareError(null);
    const result = await updatePhoneSharingPref(checked);
    setPhoneShareSaving(false);
    if (result.error) {
      setSharePhone(!checked);
      setPhoneShareError(result.error);
    }
  }

  // Every key here has a matching notify() call site passing this exact
  // prefKey (see src/lib/dashboard/notify.ts) — a toggle only belongs on
  // this list if it actually gates something the bell can fire.
  const NOTIFICATION_KEYS = [
    "examGraded",
    "joinRequestUpdates",
    "reviewReplies",
    "wantedAdResponses",
    "inquiryReplies",
  ] as const;
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIFICATION_KEYS.map((key) => [key, initialNotificationPrefs[key] ?? true])),
  );
  const [toggleError, setToggleError] = useState<string | null>(null);
  const notifIdPrefix = useId();

  // Optimistic toggle: flips immediately for responsiveness, then reverts
  // itself and shows an error if the save actually failed.
  async function handleToggleNotification(key: string, checked: boolean) {
    const previous = notifPrefs[key];
    setNotifPrefs((prev) => ({ ...prev, [key]: checked }));
    setToggleError(null);
    const result = await updateNotificationPrefs({ [key]: checked });
    if (result.error) {
      setNotifPrefs((prev) => ({ ...prev, [key]: previous }));
      setToggleError(result.error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">{t("heading")}</h1>

      <div className={panelClass}>
        <h3 className="mb-4 text-lg">{t("accountHeading")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={emailId}>{t("fields.email")}</Label>
            <Input id={emailId} type="email" value={email} readOnly disabled />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={phoneId}>{t("fields.phone")}</Label>
            <Input id={phoneId} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <Link href="/forgot-password" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          {t("changePassword")}
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" onClick={handleSaveChanges} disabled={saving}>
            {tc("save")}
          </Button>
          {saved && <span className="animate-in fade-in-0 text-sm font-medium text-success duration-200">{tc("saved")}</span>}
          {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        </div>
      </div>

      <div className={panelClass}>
        <h3 className="mb-1 text-lg">{t("contactHeading")}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{t("contactSubtitle")}</p>
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor={sharePhoneId}>{tp("sharePhoneLabel")}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">{tp("sharePhoneHint")}</p>
          </div>
          <Switch
            id={sharePhoneId}
            checked={sharePhone}
            disabled={phoneShareSaving}
            onCheckedChange={handleTogglePhoneShare}
          />
        </div>
        {phoneShareError && <p className="mt-2 text-sm font-medium text-destructive">{phoneShareError}</p>}
      </div>

      <div className={panelClass}>
        <h3 className="mb-4 text-lg">{tp("notificationsTitle")}</h3>
        <div className="flex flex-col gap-4">
          {NOTIFICATION_KEYS.map((key) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <Label htmlFor={`${notifIdPrefix}-${key}`}>{t(`notifications.${key}`)}</Label>
              <Switch
                id={`${notifIdPrefix}-${key}`}
                checked={notifPrefs[key]}
                onCheckedChange={(checked) => handleToggleNotification(key, checked)}
              />
            </div>
          ))}
        </div>
        {toggleError && <p className="mt-3 text-sm font-medium text-destructive">{toggleError}</p>}
      </div>
    </div>
  );
}
