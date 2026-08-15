import { useTranslations } from "next-intl";
import { GraduationCap } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { StatusBadge } from "./status-badge";
import type { ClassBatch } from "@/types/class-batch";

export function ClassBatchCard({ batch }: { batch: ClassBatch }) {
  const t = useTranslations("classBatch");

  return (
    <div className="rounded-lg border border-border bg-white p-4.5">
      <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-display text-base text-primary">{batch.title}</div>
          <Link
            href={batch.teacherHref}
            className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-primary"
          >
            <GraduationCap className="size-3.5" />
            {batch.teacherName}
          </Link>
        </div>
        <StatusBadge variant={batch.status}>
          {batch.status === "started" ? t("started") : batch.statusNote ?? t("upcoming")}
        </StatusBadge>
      </div>

      <div className="mb-3.5 flex flex-wrap gap-1.5">
        {batch.scheduleChips.map((chip) => (
          <span
            key={chip}
            className="rounded-sm border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground/80"
          >
            {chip}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-dashed border-border pt-3.5">
        <span className="font-mono text-sm font-semibold text-primary">
          Rs. {batch.priceAmount.toLocaleString()}
          <small className="ml-0.5 text-[11px] font-normal text-muted-foreground">/{batch.priceInterval}</small>
        </span>
        <Link
          href={batch.teacherHref}
          className="rounded-sm border border-input px-3.5 py-1.5 text-[13px] font-semibold text-primary"
        >
          {t("viewTeacher")}
        </Link>
      </div>
    </div>
  );
}
