"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { updateStudentProfile, updateNotificationPrefs } from "@/lib/dashboard/actions";

export function ProfileTab({
  initialName,
  initialPhone,
  initialGrade,
  initialNotificationPrefs,
  email,
}: {
  initialName: string;
  initialPhone: string;
  initialGrade: string;
  initialNotificationPrefs: Record<string, boolean>;
  email: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <ProfilePanel initialName={initialName} initialPhone={initialPhone} initialGrade={initialGrade} email={email} />
      <NotificationsPanel initialPrefs={initialNotificationPrefs} />
    </div>
  );
}

function ProfilePanel({
  initialName,
  initialPhone,
  initialGrade,
  email,
}: {
  initialName: string;
  initialPhone: string;
  initialGrade: string;
  email: string;
}) {
  const t = useTranslations("studentDashboard.profile");
  const nameId = useId();
  const gradeId = useId();
  const emailId = useId();
  const phoneId = useId();
  const { refresh } = useDashboardRefresh();

  const [name, setName] = useState(initialName);
  const [grade, setGrade] = useState(initialGrade);
  const [phone, setPhone] = useState(initialPhone);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateStudentProfile({ fullName: name, phone, gradeLevel: grade });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    // The dashboard shell's header avatar/name comes from the server page,
    // not this component's own state — without a refresh it keeps showing
    // the old name until a hard reload.
    refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <h3 className="mb-4 text-lg">{t("profileTitle")}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={nameId} className="mb-1.5">
            {t("nameLabel")}
          </Label>
          <Input id={nameId} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={gradeId} className="mb-1.5">
            {t("gradeLabel")}
          </Label>
          <Input id={gradeId} value={grade} onChange={(e) => setGrade(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={emailId} className="mb-1.5">
            {t("emailLabel")}
          </Label>
          <Input id={emailId} type="email" value={email} readOnly disabled />
        </div>
        <div>
          <Label htmlFor={phoneId} className="mb-1.5">
            {t("phoneLabel")}
          </Label>
          <Input id={phoneId} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {t("saveChanges")}
        </Button>
        {saved && <span className="text-sm font-medium text-success">{t("saved")}</span>}
        {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
          {t("changePassword")}
        </Link>
      </div>
    </div>
  );
}

function NotificationsPanel({ initialPrefs }: { initialPrefs: Record<string, boolean> }) {
  const t = useTranslations("studentDashboard.profile");
  const [newNotes, setNewNotes] = useState(initialPrefs.newNotes ?? true);
  const [liveReminders, setLiveReminders] = useState(initialPrefs.liveReminders ?? true);
  const [examGraded, setExamGraded] = useState(initialPrefs.examGraded ?? true);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const newNotesId = useId();
  const liveRemindersId = useId();
  const examGradedId = useId();

  // Optimistic toggle: flips immediately for responsiveness, then reverts
  // itself (`current` is the pre-toggle value, captured fresh each render)
  // and shows an error if the save actually failed — previously the switch
  // just stayed flipped regardless of whether updateNotificationPrefs
  // succeeded, since its result was never checked.
  function handleToggle(key: string, current: boolean, setter: (value: boolean) => void) {
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
    <div className="rounded-lg border border-border bg-white p-5">
      <h3 className="mb-4 text-lg">{t("notificationsTitle")}</h3>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={newNotesId}>{t("notifNewNotes")}</Label>
          <Switch
            id={newNotesId}
            checked={newNotes}
            onCheckedChange={handleToggle("newNotes", newNotes, setNewNotes)}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={liveRemindersId}>{t("notifLiveReminders")}</Label>
          <Switch
            id={liveRemindersId}
            checked={liveReminders}
            onCheckedChange={handleToggle("liveReminders", liveReminders, setLiveReminders)}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={examGradedId}>{t("notifExamGraded")}</Label>
          <Switch
            id={examGradedId}
            checked={examGraded}
            onCheckedChange={handleToggle("examGraded", examGraded, setExamGraded)}
          />
        </div>
      </div>
      {toggleError && <p className="mt-3 text-sm font-medium text-destructive">{toggleError}</p>}
    </div>
  );
}
