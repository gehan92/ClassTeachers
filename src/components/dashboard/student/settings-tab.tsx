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

  const [newNotes, setNewNotes] = useState(initialNotificationPrefs.newNotes ?? true);
  const [liveReminders, setLiveReminders] = useState(initialNotificationPrefs.liveReminders ?? true);
  const [examGraded, setExamGraded] = useState(initialNotificationPrefs.examGraded ?? true);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const newNotesId = useId();
  const liveRemindersId = useId();
  const examGradedId = useId();

  // Optimistic toggle: flips immediately for responsiveness, then reverts
  // itself (`current` is the pre-toggle value, captured fresh each render)
  // and shows an error if the save actually failed.
  function handleToggleNotification(key: string, current: boolean, setter: (value: boolean) => void) {
    return async (checked: boolean) => {
      setter(checked);
      setToggleError(null);
      const result = await updateNotificationPrefs({ [key]: checked });
      if (result.error) {
        setter(current);
        setToggleError(result.error);
      }
    };
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
          {saved && <span className="text-sm font-medium text-success">{tc("saved")}</span>}
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
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={newNotesId}>{tp("notifNewNotes")}</Label>
            <Switch
              id={newNotesId}
              checked={newNotes}
              onCheckedChange={handleToggleNotification("newNotes", newNotes, setNewNotes)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={liveRemindersId}>{tp("notifLiveReminders")}</Label>
            <Switch
              id={liveRemindersId}
              checked={liveReminders}
              onCheckedChange={handleToggleNotification("liveReminders", liveReminders, setLiveReminders)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={examGradedId}>{tp("notifExamGraded")}</Label>
            <Switch
              id={examGradedId}
              checked={examGraded}
              onCheckedChange={handleToggleNotification("examGraded", examGraded, setExamGraded)}
            />
          </div>
        </div>
        {toggleError && <p className="mt-3 text-sm font-medium text-destructive">{toggleError}</p>}
      </div>
    </div>
  );
}
