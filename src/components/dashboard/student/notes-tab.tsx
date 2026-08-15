"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { studentNotes } from "@/lib/mock-data";
import type { StudentNote } from "@/types/dashboard-student";

const STUDENT_NAME = "Sithara Gunasekara";
const TODAY_LABEL = "14 Aug 2026";

export function NotesTab() {
  const t = useTranslations("studentDashboard.notes");
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const openNote = studentNotes.find((note) => note.id === openNoteId) ?? null;

  return (
    <div>
      <div className="mb-5">
        <h1 className="mb-1 text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {openNote ? (
        <NoteViewer note={openNote} onClose={() => setOpenNoteId(null)} />
      ) : (
        <div className="rounded-lg border border-border bg-white">
          {studentNotes.map((note) => (
            <div
              key={note.id}
              className="flex items-center gap-3 border-b border-border p-4 last:border-b-0"
            >
              <FileText className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{note.title}</div>
                <div className="text-xs text-muted-foreground">
                  {note.subject} · {note.teacherName} · {t("pagesLabel", { pages: note.pages })}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setOpenNoteId(note.id)}>
                {t("openViewer")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NoteViewer({ note, onClose }: { note: StudentNote; onClose: () => void }) {
  const t = useTranslations("studentDashboard.notes");

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">{note.title}</div>
          <div className="text-xs text-muted-foreground">
            {note.subject} · {note.teacherName}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onClose}>
          {t("closeViewer")}
        </Button>
      </div>

      <div className="relative mx-auto max-w-160 overflow-hidden rounded-lg border border-border bg-white p-8 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex select-none items-center justify-center rotate-[-25deg] text-4xl font-bold text-foreground opacity-10"
        >
          {STUDENT_NAME} · {TODAY_LABEL}
        </div>
        <div className="relative font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {note.subject} — {t("pagesLabel", { pages: note.pages })}
        </div>
        <h2 className="relative mt-1 mb-4 text-lg">{note.title}</h2>
        <p className="relative text-sm text-foreground/80">{t("viewerPageContent")}</p>
        <p className="relative mt-3 text-sm text-foreground/80">{t("viewerPageContent")}</p>
        <p className="relative mt-3 text-sm text-foreground/80">{t("viewerPageContent")}</p>
      </div>
      <p className="mx-auto mt-3 max-w-160 text-center text-xs text-muted-foreground">
        {t("viewerDisabledNote")}
      </p>
    </div>
  );
}
