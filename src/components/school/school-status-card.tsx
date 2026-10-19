"use client";

import { useTranslations } from "next-intl";
import { Ban, Clock3, OctagonAlert } from "lucide-react";
import { TabLink } from "@/components/dashboard/tab-link";
import { cn } from "@/lib/utils";
import type { SchoolDetails } from "@/types/school";

/**
 * What's going on with the school's approval, shown on Home and on the
 * School details tab until it's approved. Nothing renders once approved.
 */
export function SchoolStatusCard({ school, showFixLink = true }: { school: SchoolDetails; showFixLink?: boolean }) {
  const t = useTranslations("school.status");
  if (school.status === "approved") return null;

  const tone = school.status === "pending" ? "wait" : "stop";
  const Icon = school.status === "pending" ? Clock3 : school.status === "rejected" ? OctagonAlert : Ban;

  return (
    <div
      role="status"
      className={cn(
        "flex gap-3.5 rounded-xl border p-4 sm:p-5",
        tone === "wait" ? "border-cta/40 bg-cta/10" : "border-destructive/30 bg-destructive/5",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          tone === "wait" ? "bg-cta/25 text-accent-deep" : "bg-destructive/10 text-destructive",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-lg text-primary">{t(`${school.status}.title`)}</h2>
        <p className="mt-1 text-sm leading-relaxed text-foreground/80">{t(`${school.status}.body`, { date: school.submittedAt })}</p>
        {school.decisionReason && school.status !== "pending" && (
          <p className="mt-3 rounded-md border border-destructive/20 bg-white px-3 py-2 text-sm text-foreground">
            <span className="font-semibold">{t("reasonLabel")}</span> {school.decisionReason}
          </p>
        )}
        {school.status === "rejected" && showFixLink && (
          <TabLink
            tab="schoolProfile"
            className="mt-3 inline-flex rounded-sm bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-light"
          >
            {t("rejected.action")}
          </TabLink>
        )}
      </div>
    </div>
  );
}
