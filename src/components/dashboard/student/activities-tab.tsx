"use client";

import { useTranslations } from "next-intl";
import { Award, CalendarClock } from "lucide-react";
import { StatusBadge } from "@/components/features/status-badge";

export type StudentActivityRow = {
  id: string;
  name: string;
  description: string | null;
  scheduleNote: string | null;
  instituteName: string;
  joinedLabel: string;
  certificateIssued: boolean;
};

/** The extracurricular activities (sports, clubs, societies) a student's
 * institutes have enrolled them in — read-only; the institute manages it. */
export function ActivitiesTab({ activities }: { activities: StudentActivityRow[] }) {
  const t = useTranslations("studentDashboard.activities");

  return (
    <div>
      <div className="mb-5">
        <h1 className="mb-1 text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {activities.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-5">
          <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {activities.map((a) => (
            <div key={a.id} className="flex flex-col gap-2 rounded-lg border border-border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.instituteName}</p>
                </div>
                {a.certificateIssued && (
                  <StatusBadge variant="graded">
                    <Award className="size-3.5" aria-hidden />
                    {t("certificateIssued")}
                  </StatusBadge>
                )}
              </div>
              {a.description && <p className="text-sm text-foreground/80">{a.description}</p>}
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {a.scheduleNote && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3.5" aria-hidden />
                    {a.scheduleNote}
                  </span>
                )}
                <span>{t("joined", { date: a.joinedLabel })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
