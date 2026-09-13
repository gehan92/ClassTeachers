import { useTranslations } from "next-intl";

export type WeeklyTimetableSlot = {
  batchTitle: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

// Monday-first display order, each value a dayOfWeek index (0=Sun..6=Sat) —
// same convention as the student dashboard's own Calendar tab timetable grid.
const TIMETABLE_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * Read-only weekly grid of recurring meeting slots (batch_schedule_slots,
 * 0118). Shared between the teacher Classes tab's "calendar view" (one
 * teacher's own batches) and the institute Timetable tab (every batch across
 * the institute) — same grid, different slot sets passed in.
 */
export function WeeklyTimetable({
  slots,
  emptyLabel,
  noClassesLabel,
}: {
  slots: WeeklyTimetableSlot[];
  emptyLabel: string;
  noClassesLabel: string;
}) {
  const td = useTranslations("scheduleSlotEditor");

  const slotsByDay = new Map<number, { batchTitle: string; startTime: string; endTime: string }[]>();
  for (const day of TIMETABLE_DAY_ORDER) slotsByDay.set(day, []);
  for (const slot of slots) {
    const list = slotsByDay.get(slot.dayOfWeek);
    if (list) list.push({ batchTitle: slot.batchTitle, startTime: slot.startTime, endTime: slot.endTime });
  }
  for (const list of slotsByDay.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (slots.length === 0) {
    return <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      <div className="grid min-w-[980px] grid-cols-7">
        {TIMETABLE_DAY_ORDER.map((day, i) => (
          <div key={day} className={`flex flex-col gap-2 p-3 ${i !== 0 ? "border-l border-border" : ""}`}>
            <div className="text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {td(`days.${["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][day]}`)}
            </div>
            <div className="flex flex-col gap-2">
              {(slotsByDay.get(day) ?? []).length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">{noClassesLabel}</p>
              ) : (
                (slotsByDay.get(day) ?? []).map((slot, i2) => (
                  <div key={i2} className="rounded-md bg-primary/5 p-2.5">
                    <p className="font-mono text-[11px] text-primary">
                      {slot.startTime}–{slot.endTime}
                    </p>
                    <p className="mt-0.5 text-[13px] font-medium text-foreground">{slot.batchTitle}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
