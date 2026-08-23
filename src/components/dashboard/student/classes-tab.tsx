"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { requestToJoin } from "@/lib/dashboard/batches-actions";

export type MyClassRow = {
  enrollmentId: string;
  ownerId: string;
  batchId: string | null;
  batchTitle: string | null;
  ownerName: string;
  ownerType: "teacher" | "class";
  mode: "online" | "physical" | null;
  scheduleNote: string | null;
  status: "pending" | "accepted" | "declined";
};

export type AvailableBatchRow = {
  id: string;
  title: string;
  ownerName: string;
  mode: "online" | "physical";
  location: string | null;
  scheduleNote: string | null;
};

export function ClassesTab({
  myClasses,
  availableBatches,
}: {
  myClasses: MyClassRow[];
  availableBatches: AvailableBatchRow[];
}) {
  const t = useTranslations("studentDashboard.classes");
  const locale = useLocale();
  const router = useRouter();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(batchId: string) {
    setJoiningId(batchId);
    setError(null);
    const result = await requestToJoin(batchId);
    setJoiningId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const acceptedClasses = myClasses.filter((item) => item.status === "accepted");
  const pendingClasses = myClasses.filter((item) => item.status === "pending");

  return (
    <div>
      <div className="mb-5">
        <h1 className="mb-1 text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {pendingClasses.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-foreground">{t("pendingTitle")}</h2>
          <div className="flex flex-col gap-4">
            {pendingClasses.map((item) => (
              <div
                key={item.enrollmentId}
                className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{item.ownerName}</span>
                    <span className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                      {item.ownerType === "teacher" ? t("typeTeacher") : t("typeClass")}
                    </span>
                  </div>
                  {item.batchTitle && <div className="text-sm text-muted-foreground">{item.batchTitle}</div>}
                </div>
                <span className="text-sm font-medium text-muted-foreground">{t("pendingStatus")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {acceptedClasses.length === 0 ? (
        <div className="mb-8 rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
          {t("emptyState")}
        </div>
      ) : (
        <div className="mb-8 flex flex-col gap-4">
          {acceptedClasses.map((item) => {
            const filterQuery = `owner=${encodeURIComponent(item.ownerId)}&batch=${encodeURIComponent(item.batchId ?? "general")}`;
            return (
              <div
                key={item.enrollmentId}
                className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">{item.ownerName}</span>
                    <span className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                      {item.ownerType === "teacher" ? t("typeTeacher") : t("typeClass")}
                    </span>
                  </div>
                  {item.batchTitle && <div className="text-sm text-muted-foreground">{item.batchTitle}</div>}
                  {item.scheduleNote && <div className="mt-1 text-xs text-muted-foreground">{item.scheduleNote}</div>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {/* Full page navigation, not the SPA <Link> — the dashboard
                      shell only reads ?tab= on mount (see dashboard-shell.tsx),
                      so a client-side nav to the same route wouldn't actually
                      switch tabs. This forces a fresh mount that picks up
                      both tab and the owner/batch filter correctly. */}
                  <a
                    href={`/${locale}/student?tab=notes&${filterQuery}`}
                    className="rounded-sm border border-input px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-secondary/40"
                  >
                    {t("viewNotes")}
                  </a>
                  <a
                    href={`/${locale}/student?tab=assignments&${filterQuery}`}
                    className="rounded-sm border border-input px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-secondary/40"
                  >
                    {t("viewAssignments")}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold text-foreground">{t("browseTitle")}</h2>
      {error && <p className="mb-3 text-sm font-medium text-destructive">{error}</p>}
      {availableBatches.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
          {t("browseEmpty")}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {availableBatches.map((batch) => (
            <div
              key={batch.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="font-semibold text-foreground">{batch.title}</div>
                <div className="text-sm text-muted-foreground">{batch.ownerName}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {batch.mode === "online" ? t("modeOnline") : t("modePhysical")}
                  {batch.location ? ` · ${batch.location}` : ""}
                  {batch.scheduleNote ? ` · ${batch.scheduleNote}` : ""}
                </div>
              </div>
              <Button
                size="sm"
                disabled={joiningId === batch.id}
                onClick={() => handleJoin(batch.id)}
                className="shrink-0"
              >
                {t("requestToJoin")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
