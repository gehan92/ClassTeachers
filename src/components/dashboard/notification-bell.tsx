"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/dashboard/notifications-actions";
import { cn } from "@/lib/utils";

export type NotificationRow = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  tab: string | null;
  readAt: string | null;
  createdAt: string;
};

type Translator = (key: string, params?: Record<string, string>) => string;

function messageFor(t: Translator, n: NotificationRow): string {
  const data = n.data ?? {};
  const str = (v: unknown, fallback = "—") => (v === null || v === undefined ? fallback : String(v));
  switch (n.type) {
    case "join_request_received":
      return data.batchTitle
        ? t("types.join_request_received", { studentName: str(data.studentName), batchTitle: str(data.batchTitle) })
        : t("types.join_request_received_general", { studentName: str(data.studentName) });
    case "join_request_accepted":
      return t("types.join_request_accepted", { ownerName: str(data.ownerName) });
    case "join_request_declined":
      return t("types.join_request_declined", { ownerName: str(data.ownerName) });
    case "exam_graded":
      return t("types.exam_graded", { examTitle: str(data.examTitle), grade: str(data.grade) });
    case "review_posted":
      return t("types.review_posted", { rating: str(data.rating) });
    case "review_replied":
      return t("types.review_replied");
    case "new_inquiry":
      return t("types.new_inquiry", { senderName: str(data.senderName) });
    case "inquiry_message":
      return t("types.inquiry_message");
    case "inquiry_reply":
      return t("types.inquiry_reply");
    case "wanted_ad_response":
      return t("types.wanted_ad_response", {
        responderType: t(data.responderType === "class" ? "responderTypes.class" : "responderTypes.teacher"),
      });
    case "listing_decision":
      return t("types.listing_decision", {
        decision: t(data.decision === "approved" ? "decisions.approved" : "decisions.rejected"),
      });
    case "listing_resubmitted":
      return t("types.listing_resubmitted", { kind: t(data.kind === "class" ? "kinds.class" : "kinds.teacher") });
    case "review_flagged":
      return t("types.review_flagged");
    default:
      return t("types.generic");
  }
}

/**
 * Replaces the old "jump to one hardcoded tab, show its count" bell —
 * this is a real list backed by the notifications table (0105), covering
 * every dashboard including Admin (which never had a bell at all). Read
 * state is optimistic (readIds) since notifications only otherwise refresh
 * via RealtimeRefresh's router.refresh() on a matching DB change, which
 * would be a jarring way to reflect "I just clicked this."
 */
export function NotificationBell({
  notifications,
  onNavigate,
}: {
  notifications: NotificationRow[];
  onNavigate: (tab: string) => void;
}) {
  const t = useTranslations("notifications") as unknown as Translator;
  const locale = useLocale();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = notifications.filter((n) => !n.readAt && !readIds.has(n.id)).length;
  const dateFormatter = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  function handleClickItem(n: NotificationRow) {
    if (!n.readAt && !readIds.has(n.id)) {
      setReadIds((prev) => new Set(prev).add(n.id));
      markNotificationRead(n.id);
    }
    if (n.tab) onNavigate(n.tab);
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    setReadIds(new Set(notifications.map((n) => n.id)));
    await markAllNotificationsRead();
    setMarkingAll(false);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={t("heading")}
            className="relative flex size-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
          />
        }
      >
        <Bell className="size-4.5" />
        {unreadCount > 0 && (
          <span
            key={unreadCount}
            className="absolute -top-0.5 -right-0.5 flex size-4 animate-in zoom-in-50 items-center justify-center rounded-full bg-cta font-mono text-[9px] font-bold text-cta-foreground duration-200"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[90vw] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <span className="text-sm font-semibold text-foreground">{t("heading")}</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              {t("markAllRead")}
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="max-h-96 overflow-y-auto py-1">
            {notifications.map((n, i) => {
              const isUnread = !n.readAt && !readIds.has(n.id);
              return (
                <DropdownMenuItem
                  key={n.id}
                  onClick={() => handleClickItem(n)}
                  style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}
                  className={cn(
                    "flex-col items-start gap-0.5 whitespace-normal rounded-md px-3 py-2 animate-in fade-in-0 slide-in-from-top-1 fill-mode-both duration-200",
                    isUnread && "bg-primary/5",
                  )}
                >
                  <div className="flex w-full items-start gap-2">
                    {isUnread && <span className="mt-1.5 size-1.5 shrink-0 animate-in zoom-in-50 rounded-full bg-cta duration-300" />}
                    <span className={cn("flex-1 text-[13px] leading-snug text-foreground", !isUnread && "text-muted-foreground")}>
                      {messageFor(t, n)}
                    </span>
                  </div>
                  <span className="pl-3.5 font-mono text-[11px] text-muted-foreground">
                    {dateFormatter.format(new Date(n.createdAt))}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
