"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { groupByClass } from "@/lib/dashboard/group-by-class";
import { useClassFilter } from "@/lib/dashboard/use-class-filter";

export type StudentNoteRow = {
  id: string;
  title: string;
  ownerId: string;
  batchId: string | null;
  batchTitle: string | null;
  ownerName: string;
  pageCount: number | null;
};

export function NotesTab({ notes, studentName }: { notes: StudentNoteRow[]; studentName: string }) {
  const t = useTranslations("studentDashboard.notes");
  const tc = useTranslations("studentDashboard.common");
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const openNote = notes.find((note) => note.id === openNoteId) ?? null;
  const groupedNotes = useMemo(() => groupByClass(notes), [notes]);
  const { filterKey, clearFilter } = useClassFilter();
  const visibleGroups = filterKey ? groupedNotes.filter((g) => g.key === filterKey) : groupedNotes;

  return (
    <div>
      <div className="mb-5">
        <h1 className="mb-1 text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {openNote ? (
        <NoteViewer note={openNote} studentName={studentName} onClose={() => setOpenNoteId(null)} />
      ) : (
        <>
          {filterKey && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-secondary/30 px-4 py-2.5">
              <span className="text-sm text-foreground">
                {tc("filteredBanner", { heading: visibleGroups[0]?.heading ?? "" })}
              </span>
              <button type="button" onClick={clearFilter} className="text-sm font-semibold text-primary hover:underline">
                {tc("showAllClasses")}
              </button>
            </div>
          )}
          {visibleGroups.length === 0 ? (
            <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
              {t("emptyState")}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {visibleGroups.map((group) => (
                <div key={group.key}>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">{group.heading}</h3>
                  <div className="rounded-lg border border-border bg-white">
                    {group.rows.map((note) => (
                      <div key={note.id} className="flex items-center gap-3 border-b border-border p-4 last:border-b-0">
                        <FileText className="size-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">{note.title}</div>
                          {note.pageCount && (
                            <div className="text-xs text-muted-foreground">
                              {t("pagesLabel", { pages: note.pageCount })}
                            </div>
                          )}
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setOpenNoteId(note.id)}>
                          {t("openViewer")}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NoteViewer({
  note,
  studentName,
  onClose,
}: {
  note: StudentNoteRow;
  studentName: string;
  onClose: () => void;
}) {
  const t = useTranslations("studentDashboard.notes");
  const locale = useLocale();
  const todayLabel = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date());

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">{note.title}</div>
          <div className="text-xs text-muted-foreground">
            {note.ownerName}
            {note.batchTitle ? ` · ${note.batchTitle}` : ""}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onClose}>
          {t("closeViewer")}
        </Button>
      </div>

      <div className="relative mx-auto h-[85vh] max-w-5xl overflow-hidden rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
        <iframe
          // toolbar=0/navpanes=0 hide the browser's native PDF chrome (its
          // own download/print buttons contradict viewerDisabledNote below —
          // the real protection is the 60s signed URL, not those buttons);
          // view=FitH fills the frame's width instead of the tiny default
          // "fit whole page" zoom. Standard PDF Open Parameters, honored by
          // Chrome/Edge's PDFium viewer and Firefox's pdf.js.
          src={`/${locale}/student/notes/${note.id}/file#toolbar=0&navpanes=0&view=FitH`}
          title={note.title}
          className="size-full"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex select-none items-center justify-center rotate-[-25deg] text-4xl font-bold text-foreground opacity-10"
        >
          {studentName} · {todayLabel}
        </div>
      </div>
      <p className="mx-auto mt-3 max-w-160 text-center text-xs text-muted-foreground">
        {t("viewerDisabledNote")}
      </p>
    </div>
  );
}
