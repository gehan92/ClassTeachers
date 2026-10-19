"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Info, TriangleAlert, CircleCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SiteAnnouncement = { text: string; tone: "info" | "warning" | "success" };

const toneStyles: Record<SiteAnnouncement["tone"], string> = {
  info: "bg-primary-light text-white",
  warning: "bg-cta text-primary-dark",
  success: "bg-success text-white",
};

const toneIcons = { info: Info, warning: TriangleAlert, success: CircleCheck };

/** Stable short id of the text, so dismissing one message doesn't hide the next one. */
function messageId(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return `cp_announcement_dismissed_${hash}`;
}

/**
 * The admin's site-wide message (Admin -> Settings -> Announcement), shown
 * on the public site and every dashboard. A visitor can close it; it stays
 * closed for that message in this browser tab session.
 */
export function SiteAnnouncementBar({ announcement, preview = false }: { announcement: SiteAnnouncement; preview?: boolean }) {
  const t = useTranslations("announcement");
  const [dismissed, setDismissed] = useState(false);
  const id = messageId(announcement.text);

  useEffect(() => {
    if (preview) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a per-session dismissal after hydration
      setDismissed(window.sessionStorage.getItem(id) === "1");
    } catch {
      // Storage unavailable — keep showing it.
    }
  }, [id, preview]);

  if (dismissed) return null;
  const Icon = toneIcons[announcement.tone];

  return (
    <div role="status" className={cn("shrink-0 px-4 py-2 text-sm", toneStyles[announcement.tone])}>
      <div className="mx-auto flex max-w-[1400px] items-center gap-2.5">
        <Icon className="size-4 shrink-0" aria-hidden />
        <p className="m-0 min-w-0 flex-1 leading-snug">{announcement.text}</p>
        {!preview && (
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              try {
                window.sessionStorage.setItem(id, "1");
              } catch {
                // Storage unavailable — it just reappears on the next page.
              }
            }}
            aria-label={t("dismiss")}
            className="flex size-7 shrink-0 items-center justify-center rounded-md opacity-80 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
