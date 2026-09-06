"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";

export type ScheduleSlotDraft = { dayOfWeek: number; startTime: string; endTime: string };

// Index matches day_of_week (0 = Sunday .. 6 = Saturday, JS Date#getDay()).
const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

/**
 * Shared between the teacher and institute batch-edit forms — same "one
 * class, many possible day/time slots" editor either way, since both sides
 * write to batch_schedule_slots (0118) through the same setBatchScheduleSlots
 * action. Purely a local draft: the caller owns the actual save button and
 * calls setBatchScheduleSlots itself alongside its own updateBatch call.
 */
export function ScheduleSlotEditor({
  idPrefix,
  slots,
  onChange,
}: {
  idPrefix: string;
  slots: ScheduleSlotDraft[];
  onChange: (slots: ScheduleSlotDraft[]) => void;
}) {
  const t = useTranslations("scheduleSlotEditor");

  function updateSlot(index: number, patch: Partial<ScheduleSlotDraft>) {
    onChange(slots.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addSlot() {
    onChange([...slots, { dayOfWeek: 1, startTime: "16:00", endTime: "17:00" }]);
  }

  function removeSlot(index: number) {
    onChange(slots.filter((_, i) => i !== index));
  }

  return (
    <div className="grid gap-1.5 sm:col-span-2">
      <Label>{t("label")}</Label>
      {slots.length === 0 && <p className="text-xs text-muted-foreground">{t("empty")}</p>}
      <div className="flex flex-col gap-2">
        {slots.map((slot, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Select value={String(slot.dayOfWeek)} onValueChange={(v) => updateSlot(i, { dayOfWeek: Number(v ?? 1) })}>
              <SelectTrigger id={`${idPrefix}-day-${i}`} className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_KEYS.map((key, dayIndex) => (
                  <SelectItem key={key} value={String(dayIndex)}>
                    {t(`days.${key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="time"
              className="w-28"
              value={slot.startTime}
              onChange={(e) => updateSlot(i, { startTime: e.target.value })}
              aria-label={t("startTime")}
            />
            <span className="text-sm text-muted-foreground">–</span>
            <Input
              type="time"
              className="w-28"
              value={slot.endTime}
              onChange={(e) => updateSlot(i, { endTime: e.target.value })}
              aria-label={t("endTime")}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => removeSlot(i)} aria-label={t("removeSlot")}>
              <X className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addSlot}>
        <Plus className="size-3.5" />
        {t("addSlot")}
      </Button>
    </div>
  );
}
