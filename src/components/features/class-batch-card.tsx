import { useTranslations } from "next-intl";
import { GraduationCap } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { BatchJoinButton } from "./batch-join-button";
import type { ClassBatch } from "@/types/class-batch";

export function ClassBatchCard({
  batch,
  join,
}: {
  batch: ClassBatch;
  /** Omitted entirely on the institute's own "preview my page" view — a
   * viewer can't request to join their own institute. */
  join?: { loggedIn: boolean; isStudent: boolean; status: "pending" | "accepted" | "declined" | null };
}) {
  const t = useTranslations("classBatch");
  const chips = [
    batch.mode === "online" ? t("modeOnline") : t("modePhysical"),
    ...(batch.scheduleNote ? [batch.scheduleNote] : []),
    ...(batch.location ? [batch.location] : []),
  ];

  return (
    <div className="rounded-lg border border-border bg-white p-4.5">
      <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-display text-base text-primary">{batch.title}</div>
          {batch.teacherName && (
            <div className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <GraduationCap className="size-3.5" />
              {batch.teacherName}
            </div>
          )}
        </div>
        <StatusBadge variant={batch.status}>{batch.status === "started" ? t("started") : t("upcoming")}</StatusBadge>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-sm border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground/80"
            >
              {chip}
            </span>
          ))}
        </div>
        {join && (
          <BatchJoinButton batchId={batch.id} loggedIn={join.loggedIn} isStudent={join.isStudent} initialStatus={join.status} />
        )}
      </div>

      {batch.ads.length > 0 && (
        <div className="mt-3 flex flex-col gap-2.5 border-t border-border pt-3">
          {batch.ads.map((ad) => (
            <div key={ad.id}>
              <p className="text-sm font-medium text-foreground">{ad.title}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{ad.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
