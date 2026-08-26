"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateTeacherAccount, updateNotificationPrefs, updateContactMode } from "@/lib/dashboard/actions";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";

const panelClass = "rounded-lg border border-border bg-white p-5";

export function SettingsTab({
  initialFullName,
  initialPhone,
  initialNotificationPrefs,
  initialContactMode,
  email,
}: {
  initialFullName: string;
  initialPhone: string;
  initialNotificationPrefs: Record<string, boolean>;
  initialContactMode: "phone" | "messaging_only";
  email: string;
}) {
  const t = useTranslations("teacherDashboard.settings");
  const tc = useTranslations("teacherDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();

  const [messagingOnly, setMessagingOnly] = useState(initialContactMode === "messaging_only");

  function handleToggleContactMode(checked: boolean) {
    setMessagingOnly(checked);
    updateContactMode(checked ? "messaging_only" : "phone");
  }

  const [notifications, setNotifications] = useState({
    enrolments: initialNotificationPrefs.enrolments ?? true,
    reviews: initialNotificationPrefs.reviews ?? true,
    submissions: initialNotificationPrefs.submissions ?? true,
  });

  function handleToggleNotification(key: "enrolments" | "reviews" | "submissions") {
    return (checked: boolean) => {
      setNotifications((n) => ({ ...n, [key]: checked }));
      updateNotificationPrefs({ [key]: checked });
    };
  }

  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState(initialPhone);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSaveChanges() {
    setSaving(true);
    setError(null);
    const result = await updateTeacherAccount({ fullName: fullName.trim(), phone });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    // Name shows up in the sidebar/header greeting elsewhere on the page —
    // those are server-rendered snapshots, so they need a refetch.
    refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">{t("heading")}</h1>

      <div className={panelClass}>
        <h3 className="mb-4 text-lg">{t("accountHeading")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="full-name">{t("fields.fullName")}</Label>
            <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">{t("fields.email")}</Label>
            <Input id="email" type="email" value={email} readOnly disabled />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">{t("fields.phone")}</Label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <Link href="/forgot-password" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          {t("changePassword")}
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" onClick={handleSaveChanges} disabled={saving || fullName.trim().length === 0}>
            {tc("save")}
          </Button>
          {saved && <span className="text-sm font-medium text-success">{tc("saved")}</span>}
          {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        </div>
        <RefreshStatus
          pending={isRefreshing}
          stuck={refreshStuck}
          pendingLabel={tc("updatingList")}
          stuckLabel={tc("updateStuck")}
          reloadLabel={tc("reloadPage")}
        />
      </div>

      <div className={panelClass}>
        <h3 className="mb-1 text-lg">{t("contactHeading")}</h3>
        <p className="mb-4 text-sm text-muted-foreground">{t("contactSubtitle")}</p>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="contact-messaging-only">{t("contactMessagingOnly")}</Label>
          <Switch id="contact-messaging-only" checked={messagingOnly} onCheckedChange={handleToggleContactMode} />
        </div>
      </div>

      <div className={panelClass}>
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
          <div className="flex items-center justify-between">
            <Label htmlFor="notif-submissions">{t("notifications.submissions")}</Label>
            <Switch
              id="notif-submissions"
              checked={notifications.submissions}
              onCheckedChange={handleToggleNotification("submissions")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
