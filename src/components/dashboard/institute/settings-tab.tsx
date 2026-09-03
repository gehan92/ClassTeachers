"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateNotificationPrefs } from "@/lib/dashboard/actions";
import { ReferEarnPanel, type ReferralRow } from "@/components/dashboard/refer-earn-panel";

/**
 * Account-wide settings only — the profile-ish fields (logo, details, rate,
 * verified tier, publish status) now live in their own Profile tab, same
 * split the teacher dashboard already has between profile-tab.tsx and this
 * file.
 */
export function SettingsTab({
  initialNotificationPrefs,
  referralCode,
  referrals,
}: {
  initialNotificationPrefs: Record<string, boolean>;
  referralCode: string;
  referrals: ReferralRow[];
}) {
  const t = useTranslations("instituteDashboard.settings");

  const [notifications, setNotifications] = useState({
    enrolments: initialNotificationPrefs.enrolments ?? true,
    reviews: initialNotificationPrefs.reviews ?? true,
    listingDecisions: initialNotificationPrefs.listingDecisions ?? true,
    newInquiries: initialNotificationPrefs.newInquiries ?? true,
  });

  function handleToggleNotification(key: "enrolments" | "reviews" | "listingDecisions" | "newInquiries") {
    return (checked: boolean) => {
      setNotifications((n) => ({ ...n, [key]: checked }));
      updateNotificationPrefs({ [key]: checked });
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <ReferEarnPanel referralCode={referralCode} referrals={referrals} />

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
          <div className="flex items-center justify-between">
            <Label htmlFor="notif-listingDecisions">{t("notifications.listingDecisions")}</Label>
            <Switch
              id="notif-listingDecisions"
              checked={notifications.listingDecisions}
              onCheckedChange={handleToggleNotification("listingDecisions")}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="notif-newInquiries">{t("notifications.newInquiries")}</Label>
            <Switch
              id="notif-newInquiries"
              checked={notifications.newInquiries}
              onCheckedChange={handleToggleNotification("newInquiries")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
