"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaginationFooter } from "@/components/dashboard/pagination-footer";
import { usePagination } from "@/lib/hooks/use-pagination";
import { groupByClass } from "@/lib/dashboard/group-by-class";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";

export type StudentNoteRow = {
  id: string;
  title: string;
  batchId: string | null;
  batchTitle: string | null;
  ownerName: string;
  ownerId: string;
  ownerType: "teacher" | "class";
  pageCount: number | null;
};

export function NotesTab({
  notes,
  studentName,
  hideHeading,
  scope = "workspace",
}: {
  notes: StudentNoteRow[];
  studentName: string;
  hideHeading?: boolean;
  /** "workspace" (default) is the per-class Accordion panel — already scoped
   * to one class, so its class-grouping is static (nothing to collapse).
   * "history" is the flat, top-level sidebar tab, spanning every class —
   * each class's group becomes its own collapsible Accordion item there. */
  scope?: "workspace" | "history";
}) {
  const t = useTranslations("studentDashboard.notes");
  const tc = useTranslations("studentDashboard.common");
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const openNote = notes.find((note) => note.id === openNoteId) ?? null;
  const { currentPage, totalPages, setPage, offset, pageSize } = usePagination(notes.length);
  const pagedNotes = notes.slice(offset, offset + pageSize);
  const groupedNotes = useMemo(() => groupByClass(pagedNotes), [pagedNotes]);

  return (
    <div>
      {!hideHeading && (
        <div className="mb-5">
          <h1 className="mb-1 text-2xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      )}

      {openNote ? (
        <NoteViewer note={openNote} studentName={studentName} onClose={() => setOpenNoteId(null)} />
      ) : notes.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
          {t("emptyState")}
        </div>
      ) : scope === "history" ? (
        <div className="flex flex-col gap-3">
          <Accordion multiple defaultValue={groupedNotes.map((g) => g.key)} className="rounded-lg border border-border bg-white px-4">
            {groupedNotes.map((group) => (
              <AccordionItem key={group.key} value={group.key}>
                <AccordionTrigger className="text-sm font-semibold text-foreground">{group.heading}</AccordionTrigger>
                <AccordionPanel>
                  <div className="flex flex-col divide-y divide-border rounded-md border border-border">
                    {group.rows.map((note) => (
                      <NoteRow key={note.id} note={note} onOpen={() => setOpenNoteId(note.id)} />
                    ))}
                  </div>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
          <PaginationFooter
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            showingLabel={tc("pagination.showingCount", { shown: pagedNotes.length, total: notes.length })}
            previousLabel={tc("pagination.previous")}
            nextLabel={tc("pagination.next")}
            pageInfoLabel={tc("pagination.pageInfo", { page: currentPage, totalPages })}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groupedNotes.map((group) => (
            <div key={group.key}>
              <h3 className="mb-2 text-sm font-semibold text-foreground">{group.heading}</h3>
              <div className="divide-y divide-border rounded-lg border border-border bg-white">
                {group.rows.map((note) => (
                  <NoteRow key={note.id} note={note} onOpen={() => setOpenNoteId(note.id)} />
                ))}
              </div>
            </div>
          ))}
          <PaginationFooter
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            showingLabel={tc("pagination.showingCount", { shown: pagedNotes.length, total: notes.length })}
            previousLabel={tc("pagination.previous")}
            nextLabel={tc("pagination.next")}
            pageInfoLabel={tc("pagination.pageInfo", { page: currentPage, totalPages })}
          />
        </div>
      )}
    </div>
  );
}

function NoteRow({ note, onOpen }: { note: StudentNoteRow; onOpen: () => void }) {
  const t = useTranslations("studentDashboard.notes");
  return (
    <div className="flex items-center gap-3 p-4">
      <FileText className="size-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{note.title}</div>
        {note.pageCount && (
          <div className="text-xs text-muted-foreground">{t("pagesLabel", { pages: note.pageCount })}</div>
        )}
      </div>
      <Button size="sm" variant="outline" onClick={onOpen}>
        {t("openViewer")}
      </Button>
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
