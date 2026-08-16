"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateStudentProfile } from "@/lib/dashboard/actions";

export function ProfileTab({
  initialName,
  initialPhone,
  email,
}: {
  initialName: string;
  initialPhone: string;
  email: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <ProfilePanel initialName={initialName} initialPhone={initialPhone} email={email} />
      <NotificationsPanel />
    </div>
  );
}

function ProfilePanel({
  initialName,
  initialPhone,
  email,
}: {
  initialName: string;
  initialPhone: string;
  email: string;
}) {
  const t = useTranslations("studentDashboard.profile");
  const nameId = useId();
  const gradeId = useId();
  const emailId = useId();
  const phoneId = useId();

  // "Grade" has no backing column in `profiles` yet — kept as local-only
  // input until there's a schema decision for where it should live.
  const [name, setName] = useState(initialName);
  const [grade, setGrade] = useState("");
  const [phone, setPhone] = useState(initialPhone);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateStudentProfile({ fullName: name, phone });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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

function NotificationsPanel() {
  const t = useTranslations("studentDashboard.profile");
  const [newNotes, setNewNotes] = useState(true);
  const [liveReminders, setLiveReminders] = useState(true);
  const [examGraded, setExamGraded] = useState(true);
  const newNotesId = useId();
  const liveRemindersId = useId();
  const examGradedId = useId();

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <h3 className="mb-4 text-lg">{t("notificationsTitle")}</h3>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={newNotesId}>{t("notifNewNotes")}</Label>
          <Switch id={newNotesId} checked={newNotes} onCheckedChange={setNewNotes} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={liveRemindersId}>{t("notifLiveReminders")}</Label>
          <Switch id={liveRemindersId} checked={liveReminders} onCheckedChange={setLiveReminders} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={examGradedId}>{t("notifExamGraded")}</Label>
          <Switch id={examGradedId} checked={examGraded} onCheckedChange={setExamGraded} />
        </div>
      </div>
    </div>
  );
}
