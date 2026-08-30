"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { createAnnouncement, deleteAnnouncement } from "@/lib/dashboard/announcements-actions";

export type InstituteAnnouncementRow = {
  id: string;
  title: string;
  body: string;
  createdLabel: string;
};

const textareaClass =
  "min-h-28 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm";

export function AnnouncementsTab({ announcements }: { announcements: InstituteAnnouncementRow[] }) {
  const t = useTranslations("instituteDashboard.announcements");
  const tc = useTranslations("instituteDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handlePost() {
    if (!title.trim() || !body.trim()) return;
    setPosting(true);
    setError(null);
    const result = await createAnnouncement({ ownerType: "class", title, body });
    setPosting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setTitle("");
    setBody("");
    setPosted(true);
    setTimeout(() => setPosted(false), 2500);
    refresh();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deleteAnnouncement(id);
    setDeletingId(null);
    if (!result.error) refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updatingList")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reloadPage")}
      />

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("form.title")}</h3>
        <div className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="announcement-title">{t("form.titleLabel")}</Label>
            <Input
              id="announcement-title"
              placeholder={t("form.titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="announcement-body">{t("form.bodyLabel")}</Label>
            <textarea
              id="announcement-body"
              className={textareaClass}
              placeholder={t("form.bodyPlaceholder")}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" onClick={handlePost} disabled={posting}>
              {t("form.submit")}
            </Button>
            {posted && <span className="animate-in fade-in-0 text-sm font-medium text-success duration-200">{t("posted")}</span>}
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      </div>

      {announcements.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">{t("empty")}</div>
      ) : (
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="flex flex-col divide-y divide-border">
            {announcements.map((a) => (
              <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                <div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="font-medium text-foreground">{a.title}</p>
                    <span className="text-xs text-muted-foreground">{a.createdLabel}</span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{a.body}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                >
                  {t("delete")}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
