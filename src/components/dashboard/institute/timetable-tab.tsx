import { useTranslations } from "next-intl";
import { WeeklyTimetable, type WeeklyTimetableSlot } from "@/components/dashboard/weekly-timetable";

export function TimetableTab({ slots }: { slots: WeeklyTimetableSlot[] }) {
  const t = useTranslations("instituteDashboard.timetable");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-primary">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <WeeklyTimetable slots={slots} emptyLabel={t("empty")} noClassesLabel={t("noClasses")} />
    </div>
  );
}
