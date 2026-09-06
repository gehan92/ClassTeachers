"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { classState } from "@/lib/dashboard/live-class-state";
import type { StudentLiveClassRow } from "@/components/dashboard/student/live-classes-tab";
import type { StudentExamRow } from "@/components/dashboard/student/exams-tab";
import type { StudentAssignmentRow } from "@/components/dashboard/student/assignments-tab";

export type StudentScheduleSlotRow = {
  id: string;
  batchId: string;
  /** 0 = Sunday .. 6 = Saturday, matching JS Date#getDay(). */
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  title: string;
  ownerName: string;
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

function isMissed(row: StudentAssignmentRow, nowMs: number): boolean {
  return !row.submission && row.dueAtIso !== null && new Date(row.dueAtIso).getTime() < nowMs;
}

function collectAgendaItems(
  nowMs: number,
  liveClasses: StudentLiveClassRow[],
  exams: StudentExamRow[],
  assignments: StudentAssignmentRow[],
  homework: StudentAssignmentRow[],
): AgendaItem[] {
  const items: AgendaItem[] = [];

  for (const lc of liveClasses) {
    if (classState(lc, nowMs) === "ended") continue;
    const at = new Date(lc.scheduledAtIso).getTime();
    if (at - nowMs > AGENDA_WINDOW_MS) continue;
    items.push({ id: `live-${lc.id}`, type: "live", title: lc.title, subtitle: lc.teacherName, atIso: lc.scheduledAtIso, tab: "classes" });
  }
  for (const e of exams) {
    if (!e.scheduledAtIso || e.submission?.status === "graded") continue;
    const at = new Date(e.scheduledAtIso).getTime();
    if (at - nowMs > AGENDA_WINDOW_MS || nowMs - at > AGENDA_WINDOW_MS) continue;
    items.push({ id: `exam-${e.id}`, type: "exam", title: e.title, subtitle: e.teacherName, atIso: e.scheduledAtIso, tab: "exams" });
  }
  for (const a of assignments) {
    if (a.submission || !a.dueAtIso || isMissed(a, nowMs)) continue;
    const at = new Date(a.dueAtIso).getTime();
    if (at - nowMs > AGENDA_WINDOW_MS) continue;
    items.push({ id: `assignment-${a.id}`, type: "assignment", title: a.title, subtitle: a.teacherName, atIso: a.dueAtIso, tab: "assignments" });
  }
  for (const h of homework) {
    if (h.submission || !h.dueAtIso || isMissed(h, nowMs)) continue;
    const at = new Date(h.dueAtIso).getTime();
    if (at - nowMs > AGENDA_WINDOW_MS) continue;
    items.push({ id: `homework-${h.id}`, type: "homework", title: h.title, subtitle: h.teacherName, atIso: h.dueAtIso, tab: "homework" });
  }

  return items.sort((a, b) => new Date(a.atIso).getTime() - new Date(b.atIso).getTime());
}

/**
 * New Calendar tab (Gehan asked for a calendar + a real weekly timetable +
 * reminders, all together, in their own tab rather than crammed onto
 * Overview). Two sections, deliberately not a month grid — this app has no
 * calendar library and every existing schedule surface (institute's own
 * CalendarTab) is already a day-grouped agenda list, so the "reminders"
 * half follows that same convention. The "timetable" half is the one place
 * that IS a real grid, since that's specifically what a recurring weekly
 * schedule (batch_schedule_slots, 0118) needs to read at a glance.
 */
export function CalendarTab({
  scheduleSlots,
  liveClasses,
  exams,
  assignments,
  homework,
}: {
  scheduleSlots: StudentScheduleSlotRow[];
  liveClasses: StudentLiveClassRow[];
  exams: StudentExamRow[];
  assignments: StudentAssignmentRow[];
  homework: StudentAssignmentRow[];
}) {
  const t = useTranslations("studentDashboard.calendar");
  const td = useTranslations("scheduleSlotEditor");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }), []);
  const dayFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }), []);

  const slotsByDay = useMemo(() => {
    const map = new Map<number, StudentScheduleSlotRow[]>();
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
                          <p className="text-[11px] text-muted-foreground">{slot.ownerName}</p>
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
                      href={{ pathname: "/student", query: { tab: item.tab } }}
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
