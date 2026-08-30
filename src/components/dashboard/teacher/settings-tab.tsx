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
import { ReferEarnPanel, type ReferralRow } from "@/components/dashboard/refer-earn-panel";
import { respondToRosterInvite } from "@/lib/dashboard/institute-actions";

const panelClass = "rounded-lg border border-border bg-white p-5";

export type InstituteInviteRow = {
  classId: string;
  instituteName: string;
  dateLabel: string;
};

export function SettingsTab({
  initialFullName,
  initialPhone,
  initialNotificationPrefs,
  initialContactMode,
  email,
  referralCode,
  referrals,
  instituteInvites: initialInstituteInvites,
}: {
  initialFullName: string;
  initialPhone: string;
  initialNotificationPrefs: Record<string, boolean>;
  initialContactMode: "phone" | "messaging_only";
  email: string;
  referralCode: string;
  referrals: ReferralRow[];
  instituteInvites: InstituteInviteRow[];
}) {
  const t = useTranslations("teacherDashboard.settings");
  const tc = useTranslations("teacherDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();

  const [handledInviteIds, setHandledInviteIds] = useState<Set<string>>(new Set());
  const instituteInvites = initialInstituteInvites.filter((invite) => !handledInviteIds.has(invite.classId));
  const [respondingClassId, setRespondingClassId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  async function handleInviteResponse(classId: string, accept: boolean) {
    setRespondingClassId(classId);
    setInviteError(null);
    const result = await respondToRosterInvite(classId, accept);
    setRespondingClassId(null);
    if (result.error) {
      setInviteError(result.error);
      return;
    }
    setHandledInviteIds((prev) => new Set(prev).add(classId));
    refresh();
  }

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
          {saved && <span className="animate-in fade-in-0 text-sm font-medium text-success duration-200">{tc("saved")}</span>}
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

      {instituteInvites.length > 0 && (
        <div className={panelClass}>
          <h3 className="mb-1 text-lg">{t("instituteInvites.heading")}</h3>
          <p className="mb-3 text-sm text-muted-foreground">{t("instituteInvites.subtitle")}</p>
          {inviteError && <p className="mb-3 text-sm font-medium text-destructive">{inviteError}</p>}
          <div className="flex flex-col divide-y divide-border">
            {instituteInvites.map((invite) => (
              <div
                key={invite.classId}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-medium text-foreground">{invite.instituteName}</p>
                  <p className="text-sm text-muted-foreground">{invite.dateLabel}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleInviteResponse(invite.classId, true)}
                    disabled={respondingClassId === invite.classId}
                  >
                    {t("instituteInvites.accept")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleInviteResponse(invite.classId, false)}
                    disabled={respondingClassId === invite.classId}
                  >
                    {t("instituteInvites.decline")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ReferEarnPanel referralCode={referralCode} referrals={referrals} />

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
