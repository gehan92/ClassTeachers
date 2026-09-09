"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { classState } from "@/lib/dashboard/live-class-state";
import type { TeacherLiveClassRow } from "@/components/dashboard/teacher/live-classes-tab";
import type { TeacherExamRow } from "@/components/dashboard/teacher/exams-tab";
import type { TeacherAssignmentRow } from "@/components/dashboard/teacher/assignments-tab";

export type TeacherScheduleSlotRow = {
  id: string;
  batchId: string;
  /** 0 = Sunday .. 6 = Saturday, matching JS Date#getDay(). */
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  title: string;
};

// Monday-first display order, each value a dayOfWeek index (0=Sun..6=Sat).
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

type AgendaItemType = "live" | "exam" | "assignment" | "homework";
type AgendaItem = {
  id: string;
  type: AgendaItemType;
  title: string;
  subtitle: string;
  atIso: string;
  tab: string;
};

const AGENDA_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function collectAgendaItems(
  nowMs: number,
  liveClasses: TeacherLiveClassRow[],
  exams: TeacherExamRow[],
  assignments: TeacherAssignmentRow[],
  homework: TeacherAssignmentRow[],
): AgendaItem[] {
  const items: AgendaItem[] = [];

  for (const lc of liveClasses) {
    if (classState(lc, nowMs) === "ended") continue;
    const at = new Date(lc.scheduledAtIso).getTime();
    if (at - nowMs > AGENDA_WINDOW_MS) continue;
    items.push({ id: `live-${lc.id}`, type: "live", title: lc.title, subtitle: lc.batchTitle ?? "—", atIso: lc.scheduledAtIso, tab: "live" });
  }
  // Only published exams/assignments/homework are real commitments on a
  // teacher's own schedule — a draft has no fixed date a student can see yet.
  for (const e of exams) {
    if (!e.published || !e.scheduledAtIso) continue;
    const at = new Date(e.scheduledAtIso).getTime();
    if (at < nowMs || at - nowMs > AGENDA_WINDOW_MS) continue;
    items.push({ id: `exam-${e.id}`, type: "exam", title: e.title, subtitle: e.batchTitle ?? "—", atIso: e.scheduledAtIso, tab: "exams" });
  }
  for (const a of assignments) {
    if (!a.dueAtIso) continue;
    const at = new Date(a.dueAtIso).getTime();
    if (at < nowMs || at - nowMs > AGENDA_WINDOW_MS) continue;
    items.push({ id: `assignment-${a.id}`, type: "assignment", title: a.title, subtitle: a.batchTitle ?? "—", atIso: a.dueAtIso, tab: "assignments" });
  }
  for (const h of homework) {
    if (!h.dueAtIso) continue;
    const at = new Date(h.dueAtIso).getTime();
    if (at < nowMs || at - nowMs > AGENDA_WINDOW_MS) continue;
    items.push({ id: `homework-${h.id}`, type: "homework", title: h.title, subtitle: h.batchTitle ?? "—", atIso: h.dueAtIso, tab: "homework" });
  }

  return items.sort((a, b) => new Date(a.atIso).getTime() - new Date(b.atIso).getTime());
}

/**
 * Teacher-side counterpart to the student dashboard's Calendar tab — same
 * weekly-timetable-grid + upcoming-agenda shape, built from the same
 * batch_schedule_slots data (0118), just from the teacher's own point of
 * view: every batch they own, plus every institute batch they're assigned to
 * teach (0124 widened the schedule-slots RLS to match).
 */
export function ScheduleTab({
  scheduleSlots,
  liveClasses,
  exams,
  assignments,
  homework,
}: {
  scheduleSlots: TeacherScheduleSlotRow[];
  liveClasses: TeacherLiveClassRow[];
  exams: TeacherExamRow[];
  assignments: TeacherAssignmentRow[];
  homework: TeacherAssignmentRow[];
}) {
  const t = useTranslations("teacherDashboard.calendar");
  const td = useTranslations("scheduleSlotEditor");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }), []);
  const dayFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }), []);

  const slotsByDay = useMemo(() => {
    const map = new Map<number, TeacherScheduleSlotRow[]>();
    for (const day of WEEK_ORDER) map.set(day, []);
    for (const slot of scheduleSlots) {
      const list = map.get(slot.dayOfWeek);
      if (list) list.push(slot);
    }
    for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [scheduleSlots]);

  const agendaGroups = useMemo(() => {
    const items = collectAgendaItems(now, liveClasses, exams, assignments, homework);
    const byDay = new Map<string, AgendaItem[]>();
    for (const item of items) {
      const key = new Date(item.atIso).toDateString();
      const list = byDay.get(key) ?? [];
      list.push(item);
      byDay.set(key, list);
    }
    return [...byDay.entries()].map(([key, list]) => ({ key, label: dayFormatter.format(new Date(list[0].atIso)), items: list }));
  }, [now, liveClasses, exams, assignments, homework, dayFormatter]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="mb-1 text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("timetableHeading")}</h2>
        {scheduleSlots.length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">{t("timetableEmpty")}</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-white">
            <div className="grid min-w-[980px] grid-cols-7">
              {WEEK_ORDER.map((day, i) => (
                <div
                  key={day}
                  className={`flex flex-col gap-2 p-3 ${i !== 0 ? "border-l border-border" : ""}`}
                >
                  <div className="text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {td(`days.${DAY_KEYS[day]}`)}
                  </div>
                  <div className="flex flex-col gap-2">
                    {(slotsByDay.get(day) ?? []).length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">{t("noClasses")}</p>
                    ) : (
                      (slotsByDay.get(day) ?? []).map((slot) => (
                        <div key={slot.id} className="rounded-md bg-primary/5 p-2.5">
                          <p className="font-mono text-[11px] text-primary">
                            {slot.startTime}–{slot.endTime}
                          </p>
                          <p className="mt-0.5 text-[13px] font-medium text-foreground">{slot.title}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t("agendaHeading")}</h2>
        {agendaGroups.length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">{t("agendaEmpty")}</div>
        ) : (
          <div className="flex flex-col gap-5">
            {agendaGroups.map((group) => (
              <div key={group.key}>
                <h3 className="mb-2 text-sm font-medium text-foreground">{group.label}</h3>
                <div className="rounded-lg border border-border bg-white">
                  {group.items.map((item, i) => (
                    <Link
                      key={item.id}
                      href={{ pathname: "/teacher", query: { tab: item.tab } }}
                      className={`flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-secondary/40 ${i !== group.items.length - 1 ? "border-b border-border" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-16 shrink-0 font-mono text-[13px] text-muted-foreground">
                          {timeFormatter.format(new Date(item.atIso))}
                        </span>
                        <div>
                          <p className="font-medium text-foreground">{item.title}</p>
                          <p className="mt-0.5 text-[13px] text-muted-foreground">{item.subtitle}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                        {t(`itemType.${item.type}`)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
