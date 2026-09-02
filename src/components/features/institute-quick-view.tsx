"use client";

import { useTranslations } from "next-intl";
import { BadgeCheck, School } from "lucide-react";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { InstituteQuickView } from "@/types/class-profile";

/**
 * The institute-side counterpart to TeacherQuickProfile
 * (institute-teacher-quick-view.tsx) — same "already connected, credentials
 * only" popup shape, for when the viewer is a student peeking at an institute
 * they're already enrolled with rather than deciding whether to join one.
 * Deliberately excludes batches/reviews/promotions/phone — that's the public
 * /class/[id] page's job, not this one's.
 */
export function InstituteQuickProfile({ institute }: { institute: InstituteQuickView }) {
  const t = useTranslations("profilePage");
  const tl = useTranslations("listing");

  return (
    <>
      <DialogHeader className="border-b border-border">
        <div className="flex items-start gap-3">
          {institute.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed/public Supabase Storage URL, not a local/optimizable asset
            <img src={institute.photoUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary">
              <School className="size-6 text-secondary-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            <DialogTitle>{institute.name}</DialogTitle>
            {institute.location && <DialogDescription className="truncate">{institute.location}</DialogDescription>}
            {institute.verified && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <span title={tl("institutionVerified")}>
                  <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label={tl("institutionVerified")} />
                </span>
                <span className="text-xs text-foreground/80">{tl("institutionVerified")}</span>
              </div>
            )}
          </div>
        </div>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="mb-5">
          <div className="mb-1.5 font-medium text-muted-foreground">{t("about")}</div>
          <p className="m-0 text-sm text-foreground/85">{institute.description || t("noDescription")}</p>
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-4 border-t border-border pt-4 sm:grid-cols-2 text-sm">
          {institute.classType && (
            <div className="min-w-0">
              <div className="mb-1 text-muted-foreground">{t("classTypeLabel")}</div>
              <div className="font-medium text-foreground">
                {institute.classType === "physical"
                  ? t("classTypePhysical")
                  : institute.classType === "online"
                    ? t("classTypeOnline")
                    : t("classTypeBoth")}
              </div>
            </div>
          )}
          {institute.establishedText && (
            <div className="min-w-0">
              <div className="mb-1 text-muted-foreground">{t("establishedLabel")}</div>
              <div className="font-medium text-foreground">{institute.establishedText}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
