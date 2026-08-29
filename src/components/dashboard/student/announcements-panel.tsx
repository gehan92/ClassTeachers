import { useTranslations } from "next-intl";

export type AnnouncementRow = {
  id: string;
  instituteName: string;
  title: string;
  body: string;
  createdLabel: string;
};

/**
 * Institute Blueprint step 6 — the student side of "one announcement
 * reaching students across every class." Read-only, no per-student
 * read/unread tracking (MVP) — just the institute's latest notices,
 * scoped to institutes this student is actually accepted into.
 */
export function AnnouncementsPanel({ announcements }: { announcements: AnnouncementRow[] }) {
  const t = useTranslations("studentDashboard.announcements");
  if (announcements.length === 0) return null;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-border bg-white p-5">
      <h3 className="text-lg text-foreground">{t("heading")}</h3>
      <div className="flex flex-col divide-y divide-border">
        {announcements.map((a) => (
          <div key={a.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium text-foreground">{a.title}</p>
              <span className="text-xs text-muted-foreground">
                {a.instituteName} · {a.createdLabel}
              </span>
            </div>
            <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{a.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
