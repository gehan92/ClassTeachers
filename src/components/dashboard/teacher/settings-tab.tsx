"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const panelClass = "rounded-lg border border-border bg-white p-5";

export function SettingsTab() {
  const t = useTranslations("teacherDashboard.settings");
  const tc = useTranslations("teacherDashboard.common");

  const [notifications, setNotifications] = useState({
    enrolments: true,
    reviews: true,
    submissions: true,
  });

  const [account, setAccount] = useState({
    email: "piyal.kumara@example.com",
    phone: "077 123 4567",
  });
  const [saved, setSaved] = useState(false);

  function handleSaveChanges() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">{t("heading")}</h1>

      <div className={panelClass}>
        <h3 className="mb-4 text-lg">{t("accountHeading")}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">{t("fields.email")}</Label>
            <Input
              id="email"
              type="email"
              value={account.email}
              onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">{t("fields.phone")}</Label>
            <Input
              id="phone"
              type="tel"
              value={account.phone}
              onChange={(e) => setAccount((a) => ({ ...a, phone: e.target.value }))}
            />
          </div>
        </div>
        <Link href="/forgot-password" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          {t("changePassword")}
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" onClick={handleSaveChanges}>
            {tc("save")}
          </Button>
          {saved && <span className="text-sm font-medium text-success">{tc("saved")}</span>}
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
              onCheckedChange={(checked) => setNotifications((n) => ({ ...n, enrolments: checked }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="notif-reviews">{t("notifications.reviews")}</Label>
            <Switch
              id="notif-reviews"
              checked={notifications.reviews}
              onCheckedChange={(checked) => setNotifications((n) => ({ ...n, reviews: checked }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="notif-submissions">{t("notifications.submissions")}</Label>
            <Switch
              id="notif-submissions"
              checked={notifications.submissions}
              onCheckedChange={(checked) => setNotifications((n) => ({ ...n, submissions: checked }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
